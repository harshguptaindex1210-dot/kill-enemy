# Deploy — Nakama + online play

## Prerequisites

- Node 20+
- Docker Desktop (for online mode)
- Chrome/Chromium (for `npm run smoke`)

## App only (local bots)

```bash
npm ci
npm run dev
# Lobby → Play Local
```

## Full stack (online)

```bash
docker compose up -d
# postgres:5432  nakama:7350 (API) / 7351 (console)
npm ci
npm run luac:check
npm run dev
# Lobby → Play Online
```

Lua modules in `nakama/modules/` mount to `/nakama/data` (`docker-compose.yml`).
Runtime path: `NAKAMA_CORE__RUNTIME_PATH=/nakama/data`.

## Matchmaking

1. Client: guest auth → socket → `addMatchmaker('*', min=1, max=10)`.
2. Server `matchmaker_matched`: `match_create("battle_royale", { bot_count = 10 - humans, mode = "online" })`.
3. Label: `battle-royale|online`.
4. Countdown top-up fills empty slots to **10**.
5. Cancel: `removeMatchmaker(ticket)`. Disconnect → lobby (INV-5).

## Leaderboard

| Item | Value |
|------|--------|
| ID | `robot_arena_season_1` |
| Module | `nakama/modules/leaderboard.lua` |
| RPCs | `submit_score`, `list_leaderboard` |
| Client | `src/net/leaderboard.ts` (lazy-loads Nakama) |

Score ranking: better placement → higher Nakama score (`1000 - placement`).

## Environment

| Setting | Default | Where |
|---------|---------|--------|
| Host / port | `127.0.0.1:7350` | `src/net/nakama.ts` `getClient()` |
| Server key | `defaultkey` | Dev only — change for production |
| DB | `postgres://nakama:nakama@postgres:5432/nakama` | `docker-compose.yml` |

## Production notes

- Rotate the Nakama server key; do not ship `defaultkey`.
- Put Nakama behind TLS; point the client host/port/SSL flags accordingly.
- Rebuild/restart the Nakama container after editing Lua modules.
- Initial JS gate (INV-3) is enforced by `npm run build` → `scripts/bundle-size.js`
  (HTML-initial assets only; online chunks are async).

## Verify

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run sim:nakama          # skips cleanly if Docker Nakama is down
npm run smoke               # after build
```

Or: `npm run gate`.
