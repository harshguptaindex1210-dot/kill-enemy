# Deploy — Nakama + online matchmaking (#40)

## Local stack

```bash
docker compose up -d          # postgres + Nakama 3.22 on :7350 / :7351
npm run luac:check            # Lua syntax (or structure fallback)
npm run sim:nakama            # 2 virtual clients vs server (skips if offline)
```

Lua modules live in `nakama/modules/` and are mounted to `/nakama/data` via `docker-compose.yml`.

## Matchmaking flow

1. Lobby **Play Online** → guest auth → socket → `addMatchmaker('*', min=1, max=10)`.
2. Server `matchmaker_matched` creates an authoritative `battle_royale` match with  
   `bot_count = 10 - humans` and label `battle-royale|online`.
3. Client joins that match id; countdown top-up fills any empty slots to **10**.
4. **Cancel** leaves the queue via `removeMatchmaker(ticket)`.
5. Disconnect / leave → client returns to lobby (INV-5).

**Play Local** is unchanged: in-process `MatchSim` with 9 bots, no Nakama.

## Leaderboard

Seasonal board `robot_arena_season_1` is created on runtime boot (`nakama/modules/leaderboard.lua`).  
RPCs: `submit_score`, `list_leaderboard`.

## Env

| Key | Default | Notes |
|-----|---------|-------|
| Nakama host | `127.0.0.1:7350` | `src/net/nakama.ts` `getClient()` |
| Server key | `defaultkey` | Dev only — rotate in prod |

## Verify

```bash
npm run typecheck && npm run lint && npm test && npm run build
node scripts/smoke.mjs          # after build; needs Chrome/Chromium
```
