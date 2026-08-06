# 46 — Responsive lobby layout (phone + laptop)

**Status:** Done  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/prd/RESPONSIVE-LOBBY.md`  
**Bounce count:** 0  
**Verdict:** PASS (score ~82 diagnostic) — gate green; criteria 1–7 satisfied in `lobby.ts` / `lobby.css` / `lobby-layout.test.ts`. INV-L1/L2 browser proof deferred to #47 by ticket design (not a miss).  
**Independence:** same `/work` session authored the diff — contamination disclosed; recommend fresh eyes on #47.

## What to build

Polish the existing ROBOT ARENA lobby so phone and laptop both look intentional and
usable: brand + Play Online / Play Local (+ Cancel when queueing) in the first phone
viewport; remaining sections scroll below; chassis/gun skins wrap without page-level
horizontal overflow; laptop keeps multi-column layout with improved spacing, max-width,
typography, and card alignment. No HUD / touch / results / spectate changes.

## Acceptance criteria

- [x] Lobby still exposes Play Online, Play Local, Cancel (when queueing), character, loadout, settings, chassis, gun skins, recent matches, and season leaderboard.
- [x] Phone-oriented layout: a hero/first-fold region contains the brand title and play actions; other sections are not required to sit in that first fold.
- [x] Shop chassis and gun-skin cards use a wrapping grid (no reliance on page-level horizontal scroll).
- [x] Laptop-oriented layout keeps a multi-column arrangement for the upper panels (not forced to a permanent single stack at ≥1024px).
- [x] Lobby styles use semantic classes / a stylesheet with responsive rules (not only hard-coded desktop inline widths).
- [x] Existing lobby callbacks and escaped text behavior remain intact (no shop/play regressions in unit coverage).
- [x] INV-3: `npm run build` still passes the initial-bundle gate.

## Invariants

INV-L1 / INV-L2 (structure prepared here; browser proof is ticket #47), INV-3, INV-7 (do not break existing smoke selectors `#btn-local` / `#btn-online`).

## Verification-command

```bash
npm test -- tests/lobby-layout.test.ts && npm run typecheck && npm run lint && npm run build
```

## Priority

High — user-facing broken mobile lobby; frontier ahead of #44.
