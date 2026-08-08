# Handoff — mobile polish, graphics gauntlet, POI landmarks

**Date:** 2026-08-08  
**Mode:** `/work` judge lap (live URL verify + handoff refresh)  
**Branch:** `main` @ `baa301b`  
**Remote:** `origin` → `https://github.com/harshguptaindex1210-dot/kill-enemy.git`

## Current objective

Playable browser battle royale on **phone (landscape)** and **laptop/PC** with stable touch controls, BGMI-style outdoor visuals, distinct map landmarks, and reliable GitHub Pages deploy.

## Live URLs

| Use | URL |
|-----|-----|
| **Cache-bust (current)** | https://harshguptaindex1210-dot.github.io/kill-enemy/?v=baa301b |
| **Direct** | https://harshguptaindex1210-dot.github.io/kill-enemy/ |

**Deploy:** GitHub Pages **success** for `baa301b` (workflow run `31267536622`).

## Verification (green @ baa301b)

```text
npm test     → 402 passed (53 files), exit 0
npm run build → OK — raw 661441 / limit 662000, gzip 177362 / 200000
```

Live lobby loads at `?v=baa301b` (WebGL may fail in headless automation; real browsers OK).

## Shipped this session (since `e84ec80`)

| SHA | Summary |
|-----|---------|
| `baa301b` | POI district silhouettes (Town/Factory/Docks/Hilltop) via `poiVisuals.ts` |
| `293005b` | BGMI atmosphere: warm sky/fog, meadow grass, richer ground |
| `007ec7d` | Mobile jump latch + phone RESPAWN touch button (`#tb-rs`) |
| `0b6e6e2` | BGMI gauntlet pass, in-match settings, bot fire, map size 90 |
| `fd39bfa` | Minimap anchored top-left |

### Graphics gauntlet (bar: BGMI Erangel outdoor)

| Round | Slice | Status |
|-------|-------|--------|
| 1 | Sky, fog, lighting, remove debug grid | Shipped |
| 2 | Instanced grass + 128px ground texture | Shipped |
| 3 | Distinct POI landmarks | Shipped |
| 4 | Robot material polish / muzzle FX | **Next** (~559 B bundle headroom) |

### Mobile invariants (do not regress)

- Landscape gate; touch joystick + look; HEAL + **RESPAWN** on touch HUD
- Jump: 450ms latch, touch overlay z-index 10000
- 5 med-kits at start; minimap **top-left**
- Strafe right = right; settings v2 clears sticky invert

## Key paths

| Area | Paths |
|------|-------|
| Touch / jump / respawn | `src/input.ts`, `src/orientation.css` |
| Graphics / grass | `src/graphics.ts`, `src/scene.ts` |
| POI landmarks | `src/poiVisuals.ts` |
| Online demo | `src/net/onlineGame.ts`, `src/net/localServer.ts` |
| Tests | `tests/graphics.test.ts`, `tests/poiVisuals.test.ts`, `tests/touchJump.test.ts` |
| Bundle gate | `scripts/bundle-size.js` |

## Blockers & risks

1. **Bundle headroom ~559 bytes** — any new JS risks deploy failure. Prefer CSS or constant tweaks.
2. **GitHub Projects** — `read:project` scope missing; `/work` runs on handoff + local frontier.
3. **Pages = demo online** (`LocalServer`), not live Nakama.
4. **Founder name** client-side only (`HARSH FOUNDERCEO_01`).

## Next frontier (local queue)

1. **Graphics R4** — robot readability (material/emissive tweaks, zero-byte growth)
2. **User acceptance** — phone jump + respawn + POI flyover on `?v=baa301b`
3. **Bundle relief** — trim dead strings or split async chunk before major features
4. Optional: Nakama real multiplayer (`docker compose up -d`)

## Suggested skills

| Skill | When |
|-------|------|
| `gauntlet-loop` | Graphics R4 vs BGMI bar |
| `debugger` | Mobile input regression |
| `work` | Next ticket lap when board scope restored |
