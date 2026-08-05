# Architecture — Robot Arena

## Stack

| Layer | Tech |
|-------|------|
| Client | TypeScript, Three.js, Vite |
| Local sim | `MatchSim` (`src/gameplay.ts`) — same rules as server |
| Online | Nakama 3.22 Lua match handler (`nakama/modules/`) |
| Netcode | 20 Hz snapshots, client prediction + rollback, remote interpolation |
| Persistence | `localStorage` + Nakama storage / leaderboard RPCs |

## Module map (`src/`)

| Area | Files | Role |
|------|-------|------|
| Boot | `main.ts`, `lobby.ts`, `ad.ts` | Lobby, mode select, ads, lazy online import |
| World | `scene.ts`, `renderer.ts`, `robot.ts`, `camera.ts` | Map, robots, camera |
| Input / player | `input.ts`, `player.ts` | WASD look, movement physics |
| Combat | `weapons.ts`, `melee.ts`, `grenades.ts`, `damageable.ts` | Hitscan, melee, AoE |
| BR systems | `zone.ts`, `loot.ts`, `inventory.ts`, `airdrop.ts`, `vehicle.ts` | Storm, loot, vehicles |
| Match | `match.ts`, `gameplay.ts`, `game.ts` | Lifecycle, sim, local renderer |
| Net | `netcode.ts`, `net/protocol.ts`, `net/client.ts`, `net/localServer.ts`, `net/interpolation.ts`, `net/onlineGame.ts`, `net/nakama.ts`, `net/matchmaking.ts`, `net/leaderboard.ts` | Protocol + online/local client path |
| Meta | `persistence.ts`, `settings.ts`, `hud.ts`, `feedback.ts`, `audio.ts` | Stats, HUD, SFX |

Server Lua: `nakama/modules/match_handler.lua` (match), `leaderboard.lua` (season board).

## Data flow

### Play Local

```
Lobby → MatchGame → MatchSim (in-process)
                 ↘ HUD / audio / results → lobby
```

Optional shared path: `MatchClient('local')` + `LocalServer` emit the same
`WireSnapshot` protocol as Nakama for one client code path.

### Play Online

```
Lobby → matchmaker → match_create(battle_royale, bot_count)
      → MatchClient joins → OP_INPUT @ 20 Hz
      → server match_loop → OP_SNAPSHOT (quantized)
      → RollbackEngine (self) + InterpolationBuffer (remotes)
      → OnlineMatchGame render → results / lobby on disconnect
```

Online stack is **lazy-loaded** (`import()`) so the initial HTML bundle stays
under INV-3 (`scripts/bundle-size.js` measures only `index.html` script + modulepreload).

## Online protocol (summary)

| Op | Dir | Payload |
|----|-----|---------|
| `1` OP_INPUT | C→S | JSON input frame (`seq`, move bools, mouse, fire…) |
| `2` OP_SNAPSHOT | S→C | Quantized ints (`value * 100`), entities, zone, loot, `acks` |

- Tick: **20 Hz** (50 ms). Lag-comp rewind: **100 ms**.
- Clients never send world state. INV-4 clamps on server (vel / pos-delta / fire-rate).
- Full detail: [CONTEXT/docs/protocol.md](./CONTEXT/docs/protocol.md).

## Match lifecycle

`lobby → countdown (5s) → dropping (3s) → playing → ended/results → lobby`

Hard stop ≤ **25 min** (`match.ts` / Lua `MAX_MATCH_MS`). Last alive wins;
timeout tie-breaks by kills/damage.

## Invariants

See [CONTEXT/CONTEXT.md](./CONTEXT/CONTEXT.md) for INV-1..7 and the verification-command table.
