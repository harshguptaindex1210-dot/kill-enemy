# 46 — Responsive lobby layout (phone + laptop)

**Status:** Agent Ready  
**Blocked by:** None — can start immediately  
**Spec:** `CONTEXT/docs/prd/RESPONSIVE-LOBBY.md`

## What to build

Polish the existing ROBOT ARENA lobby so phone and laptop both look intentional and
usable: brand + Play Online / Play Local (+ Cancel when queueing) in the first phone
viewport; remaining sections scroll below; chassis/gun skins wrap without page-level
horizontal overflow; laptop keeps multi-column layout with improved spacing, max-width,
typography, and card alignment. No HUD / touch / results / spectate changes.

## Acceptance criteria

- [ ] Lobby still exposes Play Online, Play Local, Cancel (when queueing), character, loadout, settings, chassis, gun skins, recent matches, and season leaderboard.
- [ ] Phone-oriented layout: a hero/first-fold region contains the brand title and play actions; other sections are not required to sit in that first fold.
- [ ] Shop chassis and gun-skin cards use a wrapping grid (no reliance on page-level horizontal scroll).
- [ ] Laptop-oriented layout keeps a multi-column arrangement for the upper panels (not forced to a permanent single stack at ≥1024px).
- [ ] Lobby styles use semantic classes / a stylesheet with responsive rules (not only hard-coded desktop inline widths).
- [ ] Existing lobby callbacks and escaped text behavior remain intact (no shop/play regressions in unit coverage).
- [ ] INV-3: `npm run build` still passes the initial-bundle gate.

## Invariants

INV-L1 / INV-L2 (structure prepared here; browser proof is ticket #47), INV-3, INV-7 (do not break existing smoke selectors `#btn-local` / `#btn-online`).

## Verification-command

```bash
npm test -- tests/lobby-layout.test.ts && npm run typecheck && npm run lint && npm run build
```

## Files / modules likely touched

- `src/lobby.ts`
- new lobby CSS (e.g. `src/lobby.css` imported from lobby or main)
- `tests/lobby-layout.test.ts`
- possibly `index.html` / font link only if needed for type polish (prefer existing stack if already branded)

## Priority

High — user-facing broken mobile lobby; frontier ahead of #44.
