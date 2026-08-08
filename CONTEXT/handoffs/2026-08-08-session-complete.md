# Handoff — mobile polish, controls, graphics, playability

**Date:** 2026-08-08  
**Mode:** multi-lap delivery (controls, mobile UX, graphics gauntlet, playability)  
**Branch:** `main` @ `e84ec80`  
**Remote:** `origin` → `https://github.com/harshguptaindex1210-dot/kill-enemy.git`

## Current objective

Ship a playable browser battle-royale on **phone (landscape)** and **laptop/PC** with stable controls, tactical visuals, and a reliable GitHub Pages deploy. User is actively testing on phone and laptop; expects working movement, look, minimap, med-kits, profile name, and founder perks.

## Live URLs

| Use | URL |
|-----|-----|
| **Phone / laptop (cache-bust)** | https://harshguptaindex1210-dot.github.io/kill-enemy/?v=e84ec80 |
| **Direct** | https://harshguptaindex1210-dot.github.io/kill-enemy/ |
| **Short redirect** | https://harshguptaindex1210-dot.github.io/ → `/kill-enemy/` (separate user-site repo `harshguptaindex1210-dot.github.io`) |

## Repository & important paths

| Area | Paths |
|------|-------|
| Boot / lobby | `src/main.ts`, `src/lobby.ts`, `src/lobby.css` |
| Match (local) | `src/game.ts`, `src/gameplay.ts` |
| Match (demo online) | `src/net/onlineGame.ts`, `src/net/localServer.ts`, `src/net/client.ts` |
| Input / touch | `src/input.ts`, `src/touchLook.ts`, `src/settings.ts`, `src/orientation.ts`, `src/orientation.css` |
| Player / movement | `src/player.ts`, `src/netcode.ts` |
| HUD / minimap | `src/hud.ts` |
| Graphics (Three.js) | `src/renderer.ts`, `src/scene.ts`, `src/graphics.ts`, `src/lobbyScene.ts` |
| Profile / founder | `src/profile.ts`, `src/persistence.ts` |
| Share URLs | `src/siteUrl.ts` |
| Bundle gate | `scripts/bundle-size.js` |
| Deploy | `.github/workflows/deploy.yml` |
| Context index | `CONTEXT/CONTEXT-MAP.md`, `CONTEXT/handoffs/` |

**Stack:** Already **Three.js** (`three@^0.166.1`) end-to-end. No custom WebGL migration needed.

## What changed this session

### Mobile & links
- Phone-only landscape gate (`index.html` + `orientation.ts/css`).
- Root URL redirect hardened in separate `harshguptaindex1210-dot.github.io` repo (mobile-safe fallback button).
- Share links point at direct `/kill-enemy/` URL (`src/siteUrl.ts`, README).

### Controls (critical fixes)
- **Look invert:** touch `mouseX` sign + settings v2 migration clearing sticky `invertLookHorizontal`; Invert Look toggle in lobby/settings.
- **Movement invert:** strafe `rightVec` corrected in `player.ts` + `netcode.ts` (`9ced9c8`) — joystick/A-D right goes right.
- Touch/mouse arbitration lockout in `input.ts` / `touchLook.ts`.

### Mobile UX
- Free Fire–style touch settings (sensitivity X/Y, button presets, HUD scale/opacity, sprint mode, left-fire).
- **HEAL** button on touch HUD; start with **5 med-kits** (`START_MEDKITS`).
- Car / Bike touch buttons (nearby vehicle enter/exit).
- Minimap **top-right** + visible local player marker (layered dot).

### Profile & founder
- Profile / Player Name panel in lobby (20-char max).
- Reserved founder name `HARSH FOUNDERCEO_01` (owner token; others rejected).
- Founder owner gets max level on load/sync.
- PIN lock was added then **removed** per user request (`ed0c914`); legacy PIN fields migrated out.

### Graphics (gauntlet loop)
- CoD/PUBG-inspired realism pass: lighting, fog, sky, terrain, lobby atmosphere, tactical HUD (`5d5058b`).
- No proprietary assets copied.

### Playability / Three.js consolidation (`e84ec80`)
- Bundle gate was failing after graphics commit (662184 > 662000); trimmed minimap stroke strings to pass.
- Online match GPU disposal fixed (`onlineGame.ts` dispose traverses scene).
- Lobby reuses `configureSunShadow()` from `graphics.ts`.

## Verification (latest known green)

```text
npm test     → 384 passed (50 files), exit 0
npm run build → OK — raw 661951 / limit 662000, gzip 177007 / 200000
```

**Deploy:** GitHub Pages success for `e84ec80` ([run 31242725142](https://github.com/harshguptaindex1210-dot/kill-enemy/actions/runs/31242725142) area; final playability push on same SHA family).

**CI caveats:**
- `nakama-integration` job fails (Docker infra) — not a unit-test regression.
- Occasional Prettier lint failures on unrelated files; Pages deploy still succeeds when build gate passes.

## Key commits (newest first)

| SHA | Summary |
|-----|---------|
| `e84ec80` | Playability: minimap marker restore, bundle gate pass, GPU dispose |
| `5d5058b` | Graphics: BR-style lighting, fog, tactical HUD |
| `9ced9c8` | Fix strafe right vector (A/D + joystick) |
| `c3fb804` / `c571cf3` | Mobile heal HUD, 5 medkits, clear sticky look invert |
| `7a55954` / `6be2d67` | Heal action + touch vehicle selectors |
| `6712b8c` | Minimap top-right + player marker fix |
| `ed0c914` | Remove founder PIN system |
| `2dbea53` / `7625160` | Founder name lock + max level |
| `be0351e` | Profile / player name UI |
| `293c13d` | Mobile hardening (9 bots, quality presets, vehicle action) |
| `fadd131` | Touch look + invert toggle |
| `baf94a0` | Yaw sign fix (touch/player/netcode/bots) |

Full history: `git log --oneline -30`

## Known blockers & risks

1. **Bundle gate headroom ~49 bytes** — any new JS risks deploy failure. Prefer CSS over inline strings; trim before adding features.
2. **No real server auth** — founder name lock is client-side (localStorage owner token). Not enforceable across all devices globally.
3. **GitHub Pages = demo online** (`VITE_ONLINE_DEMO=true`) — uses `LocalServer`, not live Nakama. Lua Nakama yaw fixes do not affect Pages play path.
4. **Phone cache** — users must hard-refresh or use `?v=<sha>` cache-bust links after deploy.
5. **GitHub Projects board** — `read:project` scope missing; `/work` laps run locally with issue comments instead.

## What remains / next

- [ ] User acceptance on phone after `?v=e84ec80` (movement + look + HEAL + minimap).
- [ ] Increase bundle headroom or split chunks if adding features (currently at ceiling).
- [ ] Real Nakama multiplayer deploy (local: `docker compose up -d`) — not on Pages.
- [ ] Optional: `/wayfinder` issues #69 cosmetics, #70 shop economy (deferred).
- [ ] Fix repo-wide Prettier CI if desired (cosmetic, blocks CI not Pages).
- [ ] Founder lock could move to server-side if Nakama auth is added later.

## Commands already run (representative)

```powershell
npm test
npm run build
git push origin main
gh run list --workflow=deploy.yml --limit 3
```

## Suggested skills for next agent

| Skill | When |
|-------|------|
| `work` | Next bug/feature lap with gates |
| `gauntlet-loop` | Further visual polish vs CoD/PUBG bar |
| `debugger` | Control/input regression |
| `push-handoff` | After verified ticket delivery |
| `github-projects-pipeline` | If board scope restored |

## User preferences (this session)

- Wants **direct game link** shown in-game, not root `harshguptaindex1210-dot.github.io/`.
- Phone: landscape only, Free Fire–style settings, 9 bots + 1 player, minimap top-right.
- Founder name: `HARSH FOUNDERCEO_01`, max level, no PIN (removed).
- Expects autonomous delivery: fix → test → git push → live link with `?v=<sha>`.
