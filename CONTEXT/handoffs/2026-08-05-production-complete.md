# Handoff — Production-grade BR complete (#23 map / #29–#43)

**Date:** 2026-08-05  
**HEAD:** see `git log -1` on `main` after this commit  
**Effort:** Production-grade completion (local + online BR)

## Outcome

All mapped issues for this effort are closed through **#43** (docs + final gate).
The game supports:

- Full BR loop (lobby → match → spectate/results → ad → lobby)
- Play Local (in-process bots) and Play Online (Nakama + bot fill to 10)
- Zone, loot, airdrops, vehicles, melee, grenades, audio, feedback, settings
- Rollback/interpolation online path; lazy-loaded to protect INV-3
- Seasonal leaderboard + local match history
- CI: typecheck, lint, test, build, browser smoke, and mandatory two-client Nakama integration

## Verification (ran for this handoff)

```bash
npm run typecheck
npm run lint
npm test
npm run build          # INV-3 initial bundle gate
npm run sim:game
npm run smoke          # after build
```

Or: `npm run gate`.

Documented commands for INV-1..7 live in `CONTEXT/CONTEXT.md` (verification table).

## Post-handoff verification update

The original local gate could not run `sim:nakama` without Docker. CI now starts the
Docker Nakama stack and requires `npm run sim:nakama` in the `nakama-integration`
job, so the #39 live two-client path is no longer an unverified optional check.

## Docs delivered (#43)

| Path | Contents |
|------|----------|
| `README.md` | What / run / play / scripts |
| `ARCHITECTURE.md` | Modules + data flow + protocol summary |
| `DEPLOY.md` | Docker Nakama, matchmaking, leaderboard, env |
| `GAMEPLAY.md` | Controls, items, zone, vehicles |
| `CONTEXT/CONTEXT.md` | INV verification-command table |
| `CONTEXT/CONTEXT-MAP.md` | Updated map |
| This handoff | Closing note |

## Remaining / out of scope

- Real ad SDK (stub only)
- Multi-browser Playwright matrix beyond Chromium smoke
- Production Nakama key/TLS hardening (called out in DEPLOY.md)
- Duos/squads, 50-player scale, multiple maps

## How to continue

1. `npm ci && npm run gate`
2. Online: `docker compose up -d` then Play Online
3. Read `README.md` → `ARCHITECTURE.md` → `CONTEXT/CONTEXT.md`
