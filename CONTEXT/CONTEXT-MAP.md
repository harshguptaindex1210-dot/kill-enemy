# CONTEXT Map — Robot Arena (Shooter Game)

Where things live. Load `CONTEXT/CONTEXT.md` first.

## Docs (root)

| File | Purpose |
|------|---------|
| `README.md` | What / run / play / scripts / gate |
| `ARCHITECTURE.md` | Modules, data flow, online protocol |
| `DEPLOY.md` | Docker Nakama, env, leaderboard |
| `GAMEPLAY.md` | Controls, loot, zone, vehicles |

## Docs (`CONTEXT/`)

| Path | Purpose |
|------|---------|
| `CONTEXT/CONTEXT.md` | Decisions, INV-1..7 + INV-W1/W2 + verification table |
| `CONTEXT/docs/protocol.md` | Wire protocol (op-codes, quantization) |
| `CONTEXT/docs/DEPLOY.md` | Mirror pointer — prefer root `DEPLOY.md` |
| `CONTEXT/docs/prd.md` | Production-grade PRD |
| `CONTEXT/docs/prd/HELD-WEAPONS-LAG.md` | Spec: local held weapons + mid-match lag |
| `CONTEXT/docs/prd/RESPONSIVE-LOBBY.md` | Spec: phone + laptop lobby polish |
| `CONTEXT/docs/prd/tickets-responsive-lobby.md` | Local ticket index (#46 Agent Ready, #47 Planned) |
| `CONTEXT/docs/prd/tickets-held-weapons-lag.md` | Local ticket index (#44/#45 Planned; deferred behind #46) |
| `CONTEXT/docs/prd/issues/` | Per-ticket bodies for local tracker |
| `CONTEXT/handoffs/` | Per-effort handoffs (newest: `2026-08-06-1645-kill-enemy-session.md`) |

## Source (`src/`)

See [ARCHITECTURE.md](../ARCHITECTURE.md). Highlights:

| File | Purpose |
|------|---------|
| `main.ts` | Lobby glue; lazy-loads online stack |
| `gameplay.ts` | `MatchSim` — local authoritative rules |
| `game.ts` | Local match renderer + results |
| `net/client.ts` | Unified local/online client |
| `net/protocol.ts` | Wire encode/decode |
| `netcode.ts` | RollbackEngine |
| `nakama/modules/*.lua` | Server match + leaderboard |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/bundle-size.js` | INV-3 initial-bundle gate |
| `scripts/smoke.mjs` | INV-7 browser smoke |
| `scripts/simulate-game.ts` | Headless match sim |
| `scripts/nakama-sim.ts` | 2-client Nakama driver |
| `scripts/luac-check.js` | Lua check |
| `scripts/bench-render.js` | INV-1 FPS bench |

## CI (`.github/workflows/ci.yml`)

`check`: typecheck → lint → test → build (includes bundle gate).  
`browser-smoke`: build → `node scripts/smoke.mjs`.

## Final gate

```bash
npm ci && npm run gate
```
