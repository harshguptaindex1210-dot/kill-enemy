# Nakama Authoritative Match Protocol (#38)

Server tick rate: **20 Hz** (50 ms). Clients send inputs only; server broadcasts authoritative snapshots every tick.

## Op codes

| Code | Direction | Payload |
|------|-----------|---------|
| `1` (`OP_INPUT`) | Client → Server | JSON input frame |
| `2` (`OP_SNAPSHOT`) | Server → Clients | JSON quantized snapshot |

## Input frame (`OP_INPUT`)

```json
{
  "seq": 42,
  "forward": true,
  "backward": false,
  "left": false,
  "right": false,
  "sprint": false,
  "jump": false,
  "aim": false,
  "mouseX": 120,
  "mouseY": -30,
  "fire": true,
  "reload": false
}
```

- `mouseX` / `mouseY`: raw mouse delta (same units as `src/player.ts`, sensitivity 0.002 on server).
- Server rejects state from clients; only movement bools, aim deltas, fire/reload are accepted.
- **INV-4 clamps** applied server-side: velocity ≤ 15 m/s, position delta ≤ 2 m/tick, fire interval ≥ 80 ms.

## Snapshot (`OP_SNAPSHOT`)

All world positions/velocities/yaws are **quantized int32** = `round(value * 100)`.

```json
{
  "tick": 120,
  "time_ms": 6000,
  "phase": "playing",
  "alive": 3,
  "zone": { "cx": 0, "cz": 0, "r": 35000, "dps": 2, "phase": 2 },
  "entities": {
    "user-uuid": {
      "px": 12000, "py": 90, "pz": -4500,
      "vx": 0, "vy": 0, "vz": -600,
      "hp": 100, "ar": 0, "al": 1, "yaw": 157
    }
  },
  "loot": [{ "id": 1, "px": 30000, "pz": 500, "t": "weapon" }],
  "winner": null
}
```

Decode: `value_metres = int / 100`.

## Lag compensation

Hitscan rewinds target positions **100 ms** (2 ticks at 20 Hz) using per-player position history ring buffer.

## Match lifecycle

1. `match_init(context, params)` — params: `map_seed`, `bot_count`, optional `zone_schedule`.
2. Countdown 5 s → dropping 3 s → playing.
3. Terminates when ≤1 alive or **25 min** elapsed (INV-5).

## Create match

RPC `create_match` with optional JSON params:

```json
{ "map_seed": 12345, "bot_count": 0 }
```

Returns `{ "match_id": "<uuid>" }`.

Or socket `createMatch("battle_royale")` after handler registered.

## Client integration (#39)

- Authenticate → connect socket → join/create match.
- Send `OP_INPUT` each local tick (20 Hz).
- Apply `OP_SNAPSHOT` via `RollbackEngine` + interpolation for remote entities (INV-2).
- Desync tolerance: ≤ 200 ms rollback window; convergence test uses ≤ 4 m position error at same tick.

## Verify

```bash
npm run luac:check
node scripts/nakama-sim.ts          # requires docker compose up
npm run typecheck && npm test
```
