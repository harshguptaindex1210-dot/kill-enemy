# Kill Enemy — Browser Battle Royale

A browser-based 3D battle-royale game set in a robot apocalypse. Titanfall-style
humanoid robots fight with guns, melee, and grenades on a 1×1 km map. Built with
Three.js + Vite + TypeScript; authoritative multiplayer via Nakama.

## Play Kill Enemy

| Use | Link |
|-----|------|
| **Phone / share with friends** | https://harshguptaindex1210-dot.github.io/kill-enemy/?v=98feab2 |
| **Laptop / bookmark / direct** | https://harshguptaindex1210-dot.github.io/kill-enemy/?v=98feab2 |

On a phone in portrait you may see “Rotate your device to landscape” — turn the phone sideways to play.

Share message: *Play Kill Enemy — free browser battle royale: https://harshguptaindex1210-dot.github.io/kill-enemy/*

> This repo deploys the game to `/kill-enemy/` on GitHub Pages. Prefer the direct path above (not the site root) so phones and laptops always land on the game.

## What it is

- **10-player BR** — Play Local (bots only) or Play Online (Nakama + bot fill).
- **Server-authoritative** combat/movement with client rollback + remote interpolation.
- Storm zone, loot pads, airdrops, vehicles, melee, grenades, spectate, ads between matches.
- Local progression + seasonal leaderboard + match history.

## Run

```bash
npm install
npm run dev          # open the printed URL
```

| Mode | How |
|------|-----|
| **Play Local** | No server. Click *Play Local* in the lobby. |
| **Play Online** | `docker compose up -d`, then *Play Online* (matchmaking + bots to 10). |

Full online setup: [DEPLOY.md](./DEPLOY.md).

## Play

Controls, items, zone, vehicles: [GAMEPLAY.md](./GAMEPLAY.md).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + Vite build + INV-3 initial-bundle gate |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run smoke` | Puppeteer smoke (`npm run build` first) |
| `npm run sim:game` | Headless full-match simulation |
| `npm run sim:nakama` | 2-client Nakama sim (requires a running Docker stack; enforced by CI) |
| `npm run luac:check` | Lua syntax / structure check |
| `npm run gate` | Final gate: typecheck + lint + test + build + sim + smoke |
| `npm run bench:render` | Headless FPS benchmark (low + medium) |

## Docs

| Doc | Contents |
|-----|----------|
| [GAMEPLAY.md](./GAMEPLAY.md) | Controls, loot, zone, vehicles |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Modules, data flow, online protocol |
| [DEPLOY.md](./DEPLOY.md) | Docker Nakama, env, leaderboard |
| [CONTEXT/CONTEXT.md](./CONTEXT/CONTEXT.md) | Decisions + invariants INV-1..7 |
| [CONTEXT/docs/protocol.md](./CONTEXT/docs/protocol.md) | Wire op-codes / snapshots |

## Gate (clean checkout)

```bash
npm ci
npm run gate
```

Expect: typecheck, lint, tests, build (bundle OK), `sim:game`, browser smoke — all green.
