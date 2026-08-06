# 47 — Lobby viewport smoke (INV-L1 / INV-L2)

**Status:** Agent Ready  
**Blocked by:** #46 — Responsive lobby layout (**Done**)  
**Spec:** `CONTEXT/docs/prd/RESPONSIVE-LOBBY.md`

## What to build

Add an automated Puppeteer check that boots the built (or preview) app at phone and
laptop viewports and asserts INV-L1 and INV-L2: lobby mounts, no page-level horizontal
overflow, Play Online visible in the first phone viewport, and laptop lobby mounts
without horizontal overflow while multi-column layout remains (not a forced single
stack at laptop width).

## Acceptance criteria

- [ ] `npm run smoke:lobby` exists and exits 0 on a green build.
- [ ] At ~390×844: `#lobby-overlay` present; `#btn-online` within the first viewport (bounding box top+height intersects y∈[0, viewportHeight] without scrolling); `documentElement.scrollWidth ≤ clientWidth`.
- [ ] At ~1280×720: `#lobby-overlay` present; `documentElement.scrollWidth ≤ clientWidth`.
- [ ] At ~1280×720: upper lobby panels are not forced into a single stacked column only (multi-column / side-by-side evidence via layout geometry or CSS class + computed style).
- [ ] No screenshot golden comparisons.
- [ ] Existing `npm run smoke` still passes (INV-7).

## Invariants

INV-L1, INV-L2, INV-7.

## Verification-command

```bash
npm run build && npm run smoke:lobby && npm run smoke
```

## Files / modules likely touched

- `scripts/smoke-lobby.mjs` (or similar)
- `package.json` script `smoke:lobby`
- optionally wire into `gate` / CI after green locally

## Priority

High — machine gate for the lobby polish; starts only after #46 is Done.
