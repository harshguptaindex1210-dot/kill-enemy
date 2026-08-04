-- Seasonal leaderboard (#41). Creates the leaderboard on boot and exposes
-- submit/list RPCs. Submissions are idempotent per writeId (INV-6): a storage
-- object keyed by writeId guards against double-counting on retry.

local nk = require("nakama")

local LEADERBOARD_ID = "robot_arena_season_1"

-- Create (or keep) the seasonal leaderboard. Sort 0 = descending, operator
-- "best" so only the best placement per owner is kept. Reset 0 = never resets.
local ok, err = pcall(nk.leaderboard_create, LEADERBOARD_ID, false, 0, "best", 0, "{}")
if not ok then
  nk.logger_warn(string.format("leaderboard_create: %s", err))
end

-- Idempotent submit: match result -> leaderboard record. Guards duplicate
-- writeIds via storage so a retried submission never double-counts (INV-6).
local function rpc_submit_score(context, payload)
  local ok, data = pcall(nk.json_decode, payload)
  if not ok or not data then
    error("invalid payload")
  end
  if not data.writeId or not data.placement then
    error("missing writeId or placement")
  end

  local placement = tonumber(data.placement)
  local kills = tonumber(data.kills) or 0
  local damage = tonumber(data.damage) or 0
  if not placement or placement < 1 or placement > 10 or kills < 0 or damage < 0 then
    error("invalid match result")
  end

  local dedupe = nk.storage_read({
    { collection = "leaderboard_dedupe", key = data.writeId, user_id = context.user_id },
  })
  if dedupe and #dedupe > 0 then
    return nk.json_encode({ submitted = true, duplicate = true })
  end

  nk.storage_write({
    {
      collection = "leaderboard_dedupe",
      key = data.writeId,
      user_id = context.user_id,
      value = { placement = placement, kills = kills, damage = damage },
      permission_read = 0,
      permission_write = 0,
    },
  })

  -- Nakama's descending "best" board keeps higher scores. Placement 1 must
  -- therefore rank ahead of placement 10.
  local score = 1000 - placement
  local subscore = kills
  local metadata = {
    placement = placement,
    damage = damage,
    won = data.won == true,
    mode = data.mode or "online",
  }
  nk.leaderboard_record_write(LEADERBOARD_ID, context.user_id, context.username, score, subscore, metadata)
  return nk.json_encode({ submitted = true, duplicate = false })
end

nk.register_rpc(rpc_submit_score, "submit_score")

-- Top-N leaderboard fetch.
local function rpc_list_leaderboard(context, payload)
  local limit = 10
  if payload and payload ~= "" then
    local ok, p = pcall(nk.json_decode, payload)
    if ok and p and p.limit then
      limit = tonumber(p.limit) or 10
    end
  end
  limit = math.max(1, math.min(limit, 10))
  local ok, records = pcall(nk.leaderboard_records_list, LEADERBOARD_ID, nil, limit)
  if not ok or not records then
    return nk.json_encode({ records = {} })
  end
  local out = {}
  for _, r in ipairs(records.records or {}) do
    table.insert(out, {
      ownerId = r.owner_id,
      username = r.username and r.username.username or r.owner_id,
      score = r.score,
      kills = r.subscore,
      placement = (r.metadata and r.metadata.placement) or r.score,
    })
  end
  return nk.json_encode({ records = out })
end

nk.register_rpc(rpc_list_leaderboard, "list_leaderboard")
