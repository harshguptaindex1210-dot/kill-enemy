# Battle Royale Architecture Research

Sources (verified during planning): Gabriel Gambetta client-server game
architecture series, Riot Games VALORANT netcode engineering blog, AoE 1500-archer
talk, Nakama official authoritative multiplayer docs, PUBG/BR zone design knowledge.

## 1. Authoritative server, thin client

- The server owns truth: positions, health, loot, zone, damage, death, win.
- The client is a "dumb terminal": it sends inputs, renders snapshots, predicts locally.
- Reason: clients cannot be trusted with damage/loot/win decisions (cheaters, latency asymmetry).
- ROBOT ARENA consequence: Nakama Lua match handler is the authority for ONLINE mode.
  Local/bot mode reuses the exact same game logic (same module) so behavior matches.

## 2. Client-side prediction, reconciliation, interpolation

- Prediction: client applies its own input immediately to avoid input lag (>= 100ms
  at 60fps without it).
- Reconciliation: server snapshot arrives, client rewinds to snapshot tick, replays
  unacknowledged local inputs over it, re-renders. Corrects the predict-vs-true gap.
- Interpolation: render ENTITIES (non-self) between two buffered snapshots to smooth
  out 20Hz server updates -> 60fps visuals.
- ROBOT ARENA: netcode.ts already implements rollback (rewind+replay). Multiplayer
  ticket wires real server snapshots into the existing rollback engine. Self = predict,
  others = interpolate.

## 3. Tick rate and snapshot size

- Common FPS tick rates: 20-30Hz is acceptable for a BR; VALORANT uses 128Hz for
  competitive shooters. BRs (PUBG ~20Hz early) use lower rates because players are
  far apart and the sim is broad.
- Snapshots must be delta- or quantized-compressed. Send full state at 1-2Hz + deltas
  otherwise, or send quantized ints instead of floats.
- ROBOT ARENA: server ticks 20Hz (matches existing netcode tick of 1/20). Snapshot =
  players (pos quantized to int16, yaw int16, health u8, weapon u8, state flags),
  zone params, loot changes, event queue (shots/hits/deaths). Client buffers 2-3.

## 4. Hit registration and latency

- VALORANT: server-authoritative hitscan at fire time; hitboxes sampled at
  request-time. Small latency compensation (recently "the servers are the truth").
- For peer-level fairness, many games rewind to shooter's past state (lag compensation
  via stored history ~100ms).
- ROBOT ARENA (authoritative): server stores 100-150ms of player-position history;
  when a shot arrives, raycast against history at the shooter's timestamp. Bots share
  the same code path.

## 5. Zone (shrinking ring)

- PUBG pattern: phases of equal duration, each phase has: damage per second, safe
  radius, current radius, travel duration, target radius. Zone shrinks toward a
  random point inside the current safe circle after a delay.
- Outside zone: stacking damage by phase (phase N + 1 deals more).
- ROBOT ARENA: zone.ts already models 5 phases w/ damage; multiplayer ticket makes the
  server own the schedule and broadcast zone params each snapshot.

## 6. Loot and spawn logic

- Loot spawns: fixed number of item pads at map points, each spawns a random item from
  a weight table (weapons, ammo, armor, meds, grenades). Respawn after item picked up
  on a timer (or despawn near death-circle).
- Balance rule: total weapon density tuned to player count; higher-tier loot toward
  zone center as the match progresses.
- ROBOT ARENA: loot.ts exists; gameplay ticket wires pads + pickup + inventory + ammo.

## 7. Match flow and pacing

- Phases: lobby/countdown -> drop -> looting -> fighting -> (zone forces) -> final 1v1.
- Placement rewards: kill credit + placement XP, not just winner. Keeps non-winners
  engaged.
- ROBOT ARENA: match.ts has lobby/dropping/playing/ended + XP calc; gameplay ticket
  adds countdown, drop cam, dead/spectate/results sub-states, per-placement rewards.

## 8. Bots

- Bot AI must fill 10-player lobbies when humans are few. Bot levels: easy/med/hard
  with separate aim error, reaction, strafe, loot-priority profiles.
- Bots need awareness (hearing/vision cones), loot seeking, zone seeking, and combat
  behavior with a difficulty skill factor.
- Bots are treated as ordinary entities by the server so online/offline feel identical.
- ROBOT ARENA: main.ts has 5 simple "attack nearest" bots; gameplay ticket replaces
  them with the profiled bot AI driving the same player controls.

## 9. Persistence and progression

- Keep stats server-authoritative online; allow offline/local progression stored
  locally (localStorage) — clearly labelled "local profile".
- XP curve: level N needs a growing amount; placement + kills + damage feed XP.
- ROBOT ARENA: persistence.ts exists (localStorage + Nakama storage stub); wire into
  results screen with a real Nakama storage read/write path online.

## 10. Anti-cheat stance

- Solo dev, no anti-cheat in MVP (locked decision D-12). Server authority + input rate
  limits + sanity clamps (speed, fire rate, damage caps) are the cheap wins.
- ROBOT ARENA: server clamps velocity to sprint max * 1.25, fire rate per weapon def,
  position deltas per tick, and re-validates damage from hitscan itself.

## 11. Performance budget (existing invariant INV-1)

- 545KB raw / 140KB gz bundle target, CI gate <=512KB raw for source-dist. WebGL2.
- 10 players + 30 loot items + 5 vehicles + zone visuals on mid hardware = budget.
  Use shared geometries/materials, pool projectiles, remove dead meshes.
- The headless simulation (scripts/simulate-game.ts) must stay green.

## 12. Verification approach

- Every system gets unit tests (vitest) in the existing style; the simulate script is
  the integration harness; CI runs typecheck+lint+test+build+bundle gate.
- Nakama Lua handler gets logic tested by importing shared pure logic where possible
  and by a "simulated client" script (scripts/nakama-sim.ts) that runs against docker.
- Manual E2E: `npm run dev` local bot mode fully playable end to end.

## Key risks
- Nakama docker availability on this machine: scripted, documented, optional.
- Bundle growth past 512KB: measure after each milestone; lazy-load audio/menu screens.
- Rollback correctness under real 150ms: server history buffer + quantized snapshots.
