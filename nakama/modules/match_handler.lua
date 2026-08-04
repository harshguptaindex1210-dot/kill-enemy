-- Authoritative battle-royale match handler (#38).
-- Mirrors src/gameplay.ts + src/netcode.ts movement/combat at 20 Hz.

local nk = require("nakama")

-- ── constants (match TypeScript sim) ─────────────────────────────────────
local TICK_HZ           = 20
local TICK_DT           = 1.0 / TICK_HZ
local TICK_MS           = 1000 / TICK_HZ
local MAX_MATCH_MS      = 25 * 60 * 1000
local REWIND_TICKS      = 2          -- 100 ms lag comp at 20 Hz
local MAP_BOUND         = 480
local GROUND_Y          = 0
local STAND_H           = 1.8
local PLAYER_Y          = GROUND_Y + STAND_H / 2
local WALK_SPEED        = 6
local SPRINT_SPEED      = 9
local GRAVITY           = 20
local JUMP_V            = 5
local MOUSE_SENS        = 0.002
local PICKUP_RANGE      = 2.5
local LOOT_RESPAWN_MS   = 30000

-- INV-4 sanity clamps
local MAX_VEL           = 15
local MAX_POS_DELTA     = 2.0
local MIN_FIRE_MS       = 80         -- rifle 0.1s floor

local RIFLE_DMG         = 25
local RIFLE_RANGE       = 500
local RIFLE_FIRE_MS     = 100
local RIFLE_MAG         = 30

local OP_INPUT          = 1
local OP_SNAPSHOT       = 2

local ZONE_PHASES = {
  { radius = 400, dps = 1,  duration = 200 },
  { radius = 300, dps = 2,  duration = 150 },
  { radius = 200, dps = 4,  duration = 120 },
  { radius = 100, dps = 8,  duration = 90  },
  { radius = 30,  dps = 16, duration = 60  },
}
local SHRINK_DURATION   = 30

local POIS = {
  { name = "Town",    x = 300,  z = 0   },
  { name = "Factory", x = 0,    z = 300 },
  { name = "Docks",   x = -300, z = 0   },
  { name = "Hilltop", x = 0,    z = -300},
}

-- ── helpers ───────────────────────────────────────────────────────────────
local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local function hypot2(x, z)
  return math.sqrt(x * x + z * z)
end

local function dist2d(ax, az, bx, bz)
  local dx, dz = ax - bx, az - bz
  return math.sqrt(dx * dx + dz * dz)
end

local function wrap_angle(a)
  while a > math.pi do a = a - math.pi * 2 end
  while a < -math.pi do a = a + math.pi * 2 end
  return a
end

local function seeded_rng(seed)
  local s = seed % 4294967296
  return function()
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  end
end

local function q100(v)
  return math.floor(v * 100 + 0.5)
end

local function clamp_pos(x, z)
  return clamp(x, -MAP_BOUND, MAP_BOUND), clamp(z, -MAP_BOUND, MAP_BOUND)
end

local function clamp_vel(vx, vy, vz)
  local sp = math.sqrt(vx * vx + vy * vy + vz * vz)
  if sp > MAX_VEL then
    local s = MAX_VEL / sp
    return vx * s, vy * s, vz * s
  end
  return vx, vy, vz
end

-- ── zone ──────────────────────────────────────────────────────────────────
local function zone_safe_radius(state)
  local phase = ZONE_PHASES[state.zone_phase]
  if not phase then return 0 end
  local start = state.zone_phase == 1 and MAP_BOUND or ZONE_PHASES[state.zone_phase - 1].radius
  local t = clamp(state.zone_phase_time / SHRINK_DURATION, 0, 1)
  return start + (phase.radius - start) * t
end

local function zone_dps(state)
  local phase = ZONE_PHASES[state.zone_phase]
  return phase and phase.dps or 0
end

local function update_zone(state, dt)
  local phase = ZONE_PHASES[state.zone_phase]
  if not phase then return end
  state.zone_time = state.zone_time + dt
  state.zone_phase_time = state.zone_phase_time + dt
  if state.zone_phase_time >= phase.duration and state.zone_phase < #ZONE_PHASES then
    state.zone_phase = state.zone_phase + 1
    state.zone_phase_time = 0
  end
end

local function outside_zone(state, x, z)
  return dist2d(x, z, state.zone_cx, state.zone_cz) > zone_safe_radius(state)
end

-- ── loot ──────────────────────────────────────────────────────────────────
local LOOT_TIERS = {
  Town    = { {t="weapon",s="rifle",a=1}, {t="ammo",s="rifle",a=30} },
  Factory = { {t="weapon",s="pistol",a=1}, {t="armor",s="vest",a=50} },
  Docks   = { {t="heal",s="medkit",a=50}, {t="ammo",s="rifle",a=30} },
  Hilltop = { {t="weapon",s="rifle",a=1}, {t="heal",s="medkit",a=25} },
}

local function generate_loot(seed)
  local rng = seeded_rng(seed)
  local loot = {}
  local id = 1
  for _, poi in ipairs(POIS) do
    local tier = LOOT_TIERS[poi.name] or LOOT_TIERS.Town
    for _ = 1, 4 do
      local item = tier[math.floor(rng() * #tier) + 1]
      local angle = rng() * math.pi * 2
      local dist = 8 + rng() * 22
      loot[id] = {
        id = id,
        x = poi.x + math.cos(angle) * dist,
        z = poi.z + math.sin(angle) * dist,
        type = item.t,
        subtype = item.s,
        amount = item.a,
        collected = false,
        respawn_at = 0,
      }
      id = id + 1
    end
  end
  return loot
end

local function try_pickup_loot(state, p)
  for _, l in pairs(state.loot) do
    if not l.collected and state.time_ms >= l.respawn_at then
      if dist2d(p.x, p.z, l.x, l.z) <= PICKUP_RANGE then
        l.collected = true
        l.respawn_at = state.time_ms + LOOT_RESPAWN_MS
        if l.type == "armor" then
          p.armor = clamp(p.armor + l.amount, 0, 100)
        elseif l.type == "heal" then
          p.health = clamp(p.health + l.amount, 0, 100)
        elseif l.type == "ammo" then
          p.ammo = clamp(p.ammo + l.amount, 0, 999)
        end
        return true
      end
    end
  end
  return false
end

-- ── spawn ─────────────────────────────────────────────────────────────────
local function spawn_point(index, count, rng)
  local spread = math.min(count, 10)
  local a = (index / spread) * math.pi * 2 + rng() * 0.2
  local radius = 300 + (index % 3) * 50
  return math.cos(a) * radius, PLAYER_Y, math.sin(a) * radius
end

local function make_player(user_id, x, y, z)
  return {
    user_id = user_id,
    x = x, y = y, z = z,
    px = x, py = y, pz = z,  -- previous tick for delta clamp
    vx = 0, vy = 0, vz = 0,
    yaw = 0, pitch = 0,
    health = 100, armor = 0,
    alive = true,
    kills = 0,
    ammo = RIFLE_MAG,
    last_fire_ms = -RIFLE_FIRE_MS,
    on_ground = true,
    history = {},  -- ring buffer of {x,y,z} for lag comp
  }
end

local function push_history(p)
  table.insert(p.history, { x = p.x, y = p.y, z = p.z })
  while #p.history > REWIND_TICKS + 1 do
    table.remove(p.history, 1)
  end
end

local function rewind_pos(p)
  if #p.history >= REWIND_TICKS then
    local h = p.history[#p.history - REWIND_TICKS + 1]
    return h.x, h.y, h.z
  end
  return p.x, p.y, p.z
end

-- ── movement (mirrors src/netcode.ts + src/player.ts) ─────────────────────
local function apply_input(p, input, dt)
  p.yaw = wrap_angle(p.yaw - (input.mouseX or 0) * MOUSE_SENS)
  p.pitch = clamp((input.pitch or p.pitch) - (input.mouseY or 0) * MOUSE_SENS, -1.5, 1.5)

  local speed = (input.sprint and SPRINT_SPEED) or WALK_SPEED
  local fx = -math.sin(p.yaw)
  local fz = -math.cos(p.yaw)
  local rx = fz
  local rz = -fx

  local mx, mz = 0, 0
  if input.forward  then mx = mx + fx; mz = mz + fz end
  if input.backward then mx = mx - fx; mz = mz - fz end
  if input.left     then mx = mx - rx; mz = mz - rz end
  if input.right    then mx = mx + rx; mz = mz + rz end

  local len = hypot2(mx, mz)
  if len > 0 then mx = mx / len * speed; mz = mz / len * speed end

  p.vx = mx
  p.vz = mz
  if input.jump and p.on_ground then
    p.vy = JUMP_V
    p.on_ground = false
  end
  p.vy = p.vy - GRAVITY * dt

  p.px, p.py, p.pz = p.x, p.y, p.z
  p.x = p.x + p.vx * dt
  p.y = p.y + p.vy * dt
  p.z = p.z + p.vz * dt

  -- position-delta clamp (INV-4)
  local dx = p.x - p.px
  local dy = p.y - p.py
  local dz = p.z - p.pz
  local delta = math.sqrt(dx*dx + dy*dy + dz*dz)
  if delta > MAX_POS_DELTA then
    local s = MAX_POS_DELTA / delta
    p.x = p.px + dx * s
    p.y = p.py + dy * s
    p.z = p.pz + dz * s
  end

  if p.y < PLAYER_Y then
    p.y = PLAYER_Y
    p.vy = 0
    p.on_ground = true
  end

  p.vx, p.vy, p.vz = clamp_vel(p.vx, p.vy, p.vz)
  p.x, p.z = clamp_pos(p.x, p.z)
end

-- ── server-side bot AI (mirrors src/bots.ts decideBotInput) ──────────────
local BOT_SIGHT_RANGE = 70
local BOT_FIRE_INTERVAL = 900

local function bot_input(state, p)
  local nearest, nearest_d = nil, nil
  for uid, o in pairs(state.players) do
    if uid ~= p.user_id and o.alive then
      local d = dist2d(p.x, p.z, o.x, o.z)
      if not nearest or d < nearest_d then
        nearest, nearest_d = o, d
      end
    end
  end

  local input = {
    forward = false, backward = false, left = false, right = false,
    sprint = false, jump = false, aim = false, fire = false, reload = false,
    mouseX = 0, mouseY = 0,
  }

  local tx, tz = state.zone_cx, state.zone_cz
  local goal = "zone"
  if nearest and nearest_d <= BOT_SIGHT_RANGE then
    goal = "combat"
    tx, tz = nearest.x, nearest.z
  end

  if goal == "combat" then
    local dz = tz - p.z
    local dx = tx - p.x
    local dist = math.max(dist2d(p.x, p.z, tx, tz), 0.1)
    if dist > 14 then input.forward = true end
    if dist < 8 then input.backward = true end
    -- turn toward target
    local target_yaw = math.atan2(-dx, -dz)
    input.mouseX = -(wrap_angle(target_yaw - p.yaw)) / 0.002
    if not p.last_shot_ms or state.time_ms - p.last_shot_ms >= BOT_FIRE_INTERVAL then
      input.fire = true
      p.last_shot_ms = state.time_ms
    end
  else
    local dist = math.max(dist2d(p.x, p.z, tx, tz), 0.1)
    if dist > 5 then input.forward = true end
    local target_yaw = math.atan2(-(tx - p.x), -(tz - p.z))
    input.mouseX = -(wrap_angle(target_yaw - p.yaw)) / 0.002
  end
  return input
end

-- ── hitscan (100 ms rewind) ───────────────────────────────────────────────
local function ray_hit(ax, ay, az, dx, dy, dz, tx, ty, tz, radius)
  local len = math.sqrt(dx*dx + dy*dy + dz*dz)
  if len < 0.001 then return false end
  dx, dy, dz = dx/len, dy/len, dz/len
  local t = (tx - ax)*dx + (ty - ay)*dy + (tz - az)*dz
  if t < 0 or t > len then return false end
  local hx = ax + dx * t
  local hy = ay + dy * t
  local hz = az + dz * t
  local d = math.sqrt((hx - tx) * (hx - tx) + (hy - ty) * (hy - ty) + (hz - tz) * (hz - tz))
  return d <= radius + 0.4
end

local function try_fire(state, shooter, input)
  if not input.fire then return end
  local now = state.time_ms
  if now - shooter.last_fire_ms < math.max(MIN_FIRE_MS, RIFLE_FIRE_MS) then return end
  if shooter.ammo <= 0 then return end
  shooter.last_fire_ms = now
  shooter.ammo = shooter.ammo - 1

  local ox = shooter.x
  local oy = shooter.y + 1.2
  local oz = shooter.z
  local dx = -math.sin(shooter.yaw) * math.cos(shooter.pitch)
  local dy = -math.sin(shooter.pitch)
  local dz = -math.cos(shooter.yaw) * math.cos(shooter.pitch)

  for uid, target in pairs(state.players) do
    if uid ~= shooter.user_id and target.alive then
      local tx, ty, tz = rewind_pos(target)
      if ray_hit(ox, oy, oz, dx * RIFLE_RANGE, dy * RIFLE_RANGE, dz * RIFLE_RANGE, tx, ty, tz, 0.4) then
        local dmg = RIFLE_DMG
        if target.armor > 0 then
          local absorbed = math.min(target.armor, dmg)
          target.armor = target.armor - absorbed
          dmg = dmg - absorbed
        end
        target.health = target.health - dmg
        if target.health <= 0 then
          target.alive = false
          shooter.kills = shooter.kills + 1
          state.alive_count = state.alive_count - 1
        end
      end
    end
  end
end

-- ── snapshot (quantized ints, clients never send state) ───────────────────
local function build_snapshot(state)
  local entities = {}
  for uid, p in pairs(state.players) do
    entities[uid] = {
      px = q100(p.x), py = q100(p.y), pz = q100(p.z),
      vx = q100(p.vx), vy = q100(p.vy), vz = q100(p.vz),
      hp = p.health, ar = p.armor, al = p.alive and 1 or 0,
      yaw = q100(p.yaw),
    }
  end
  local loot_arr = {}
  for _, l in pairs(state.loot) do
    if not l.collected then
      table.insert(loot_arr, { id = l.id, px = q100(l.x), pz = q100(l.z), t = l.type })
    end
  end
  return nk.json_encode({
    tick = state.tick,
    time_ms = state.time_ms,
    phase = state.match_phase,
    alive = state.alive_count,
    zone = {
      cx = q100(state.zone_cx), cz = q100(state.zone_cz),
      r  = q100(zone_safe_radius(state)),
      dps = zone_dps(state),
      phase = state.zone_phase,
    },
    entities = entities,
    loot = loot_arr,
    winner = state.winner_id,
  })
end

local function broadcast_snapshot(dispatcher, state)
  local payload = build_snapshot(state)
  dispatcher.broadcast_message(OP_SNAPSHOT, payload, nil, nil, true)
end

-- ── match callbacks ───────────────────────────────────────────────────────
local function match_init(context, params)
  params = params or {}
  local seed = tonumber(params.map_seed) or 12345
  local bot_count = tonumber(params.bot_count) or 0
  local mode = params.mode or "online"
  local rng = seeded_rng(seed)

  local state = {
    match_id = context.match_id,
    label = "battle-royale|" .. mode,
    tick = 0,
    time_ms = 0,
    open = true,
    map_seed = seed,
    bot_count = bot_count,
    mode = mode,
    players = {},
    pending_inputs = {},
    loot = generate_loot(seed),
    zone_cx = 0, zone_cz = 0,
    zone_phase = 1,
    zone_phase_time = 0,
    zone_time = 0,
    match_phase = "countdown",
    phase_start_ms = 0,
    alive_count = 0,
    winner_id = nil,
    airdrop_tick = 0,
  }

  nk.logger_info(string.format("match_init seed=%d bots=%d mode=%s", seed, bot_count, mode))

  -- pre-spawn AI bots (server-side, no client input)
  for i = 1, bot_count do
    local bid = string.format("bot_%d", i)
    local sx, sy, sz = spawn_point(i, bot_count + 1, rng)
    state.players[bid] = make_player(bid, sx, sy, sz)
    state.alive_count = state.alive_count + 1
  end

  return state, TICK_MS, "battle-royale"
end

local function match_join_attempt(context, dispatcher, tick, state, presence, metadata)
  if not state.open then return state, false end
  if state.alive_count >= 10 then return state, false end
  return state, true
end

local function match_join(context, dispatcher, tick, state, presences)
  local count = 0
  for _ in pairs(state.players) do count = count + 1 end
  local rng = seeded_rng(state.map_seed + count)

  for _, presence in ipairs(presences) do
    if not state.players[presence.user_id] then
      local sx, sy, sz = spawn_point(count, 10, rng)
      state.players[presence.user_id] = make_player(presence.user_id, sx, sy, sz)
      state.alive_count = state.alive_count + 1
      count = count + 1
      nk.logger_info(string.format("join %s at %.0f,%.0f", presence.user_id, sx, sz))
    end
  end

  state.open = count < 10 and state.match_phase ~= "ended"
  return state
end

local function match_leave(context, dispatcher, tick, state, presences)
  for _, presence in ipairs(presences) do
    local p = state.players[presence.user_id]
    if p and p.alive then
      p.alive = false
      state.alive_count = state.alive_count - 1
    end
    state.players[presence.user_id] = nil
    state.pending_inputs[presence.user_id] = nil
  end
  state.open = state.alive_count < 10
  return state
end

local function match_loop(context, dispatcher, tick, state, messages)
  state.tick = tick
  state.time_ms = tick * TICK_MS

  -- phase transitions (mirrors match.ts)
  if state.match_phase == "countdown" then
    if state.time_ms - state.phase_start_ms >= 5000 then
      state.match_phase = "dropping"
      state.phase_start_ms = state.time_ms
    end
  elseif state.match_phase == "dropping" then
    if state.time_ms - state.phase_start_ms >= 3000 then
      state.match_phase = "playing"
      state.phase_start_ms = state.time_ms
    end
  end

  if state.match_phase == "playing" then
    -- consume client inputs only (INV-4)
    for _, msg in ipairs(messages) do
      if msg.op_code == OP_INPUT then
        local ok, input = pcall(nk.json_decode, msg.data)
        if ok and input then
          state.pending_inputs[msg.sender.user_id] = input
        end
      end
    end

    update_zone(state, TICK_DT)

    for uid, p in pairs(state.players) do
      if p.alive then
        push_history(p)
        local is_bot = string.sub(uid, 1, 4) == "bot_"
        local input = is_bot and bot_input(state, p) or (state.pending_inputs[uid] or {})
        apply_input(p, input, TICK_DT)
        try_fire(state, p, input)
        try_pickup_loot(state, p)

        if outside_zone(state, p.x, p.z) then
          local dmg = zone_dps(state) * TICK_DT
          p.health = p.health - dmg
          if p.health <= 0 then
            p.alive = false
            state.alive_count = state.alive_count - 1
          end
        end
      end
    end

    state.pending_inputs = {}

    -- win detection
    if state.alive_count <= 1 then
      for uid, p in pairs(state.players) do
        if p.alive then state.winner_id = uid; break end
      end
      state.match_phase = "ended"
      state.open = false
    end

    -- max duration (INV-5)
    if state.time_ms >= MAX_MATCH_MS then
      state.match_phase = "ended"
      state.open = false
    end
  end

  broadcast_snapshot(dispatcher, state)
  return state
end

local function match_terminate(context, dispatcher, tick, state, grace_seconds)
  nk.logger_info(string.format("match %s terminate tick=%d", state.match_id, tick))
  return state
end

local function match_signal(context, dispatcher, tick, state, data)
  return state
end

-- matchmaker hook: create authoritative match when players matched (#40).
-- Fill with server-side bots so lobbies cap at 10 total.
local function matchmaker_matched(context, matched_users)
  nk.logger_info(string.format("matchmaker matched %d users", #matched_users))
  local humans = math.min(#matched_users, 10)
  local bots = 10 - humans
  local seed = math.floor(nk.time() % 100000)
  local match_id = nk.match_create("battle_royale", {
    map_seed = seed,
    bot_count = bots,
    mode = "online",
  })
  return match_id
end

nk.register_match("battle_royale", {
  match_init = match_init,
  match_join_attempt = match_join_attempt,
  match_join = match_join,
  match_leave = match_leave,
  match_loop = match_loop,
  match_terminate = match_terminate,
  match_signal = match_signal,
})

nk.register_matchmaker_matched(matchmaker_matched)

-- RPC for clients / nakama-sim to create authoritative matches
local function rpc_create_match(context, payload)
  local params = {}
  if payload and payload ~= "" then
    local ok, decoded = pcall(nk.json_decode, payload)
    if ok and decoded then params = decoded end
  end
  local match_id = nk.match_create("battle_royale", params)
  return nk.json_encode({ match_id = match_id })
end

nk.register_rpc(rpc_create_match, "create_match")
