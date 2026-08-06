# Handoff — #46 Responsive lobby layout → Debugger Ready

**Date:** 2026-08-06  
**Ticket:** #46  
**Status move:** Coding → **Debugger Ready** (local tracker read-back)  
**HEAD after push:** see commit on `main`

## Built

- `src/lobby.css` — responsive stylesheet: phone column + wrapping shop grid; `@media (min-width: 1024px)` multi-column `.lobby-panels`
- `src/lobby.ts` — `#lobby-hero` first fold (brand + play + cancel); semantic classes; imports CSS; callbacks unchanged
- `tests/lobby-layout.test.ts` — hero structure, queue cancel in hero, XSS breakout guard, CSS media-query contract

## Gate (Verification-command)

```bash
npm test -- tests/lobby-layout.test.ts && npm run typecheck && npm run lint && npm run build
```

Result: **PASS** (4/4 lobby-layout tests; INV-3 bundle OK — raw 626529 / gzip 165992).

## Self-check

| Criterion | Evidence |
|-----------|----------|
| All lobby sections present | `showLobby` markup: hero, panels, chassis, skins, activity |
| Hero = brand + play | `#lobby-hero` + test |
| Shop wrapping grid | `.lobby-shop-grid` + CSS grid |
| Laptop multi-column | `@media (min-width: 1024px)` `flex-direction: row` on `.lobby-panels` + test |
| Stylesheet / classes | `lobby.css` imported; class assertions |
| Escape / callbacks | breakout test; event wiring preserved |
| INV-3 | `npm run build` OK |

INV-L1/L2 browser proof is **#47** (not this ticket).

## Not in this commit

Unrelated dirty INV-W2 helper edits may remain in `src/game.ts`, `src/heldWeapons.ts`, `tests/held-weapons.test.ts` — do not mix into debugger review of #46.

## Next

`/debugger` on **#46**. Then `/reviewer`. After #46 Done, promote **#47** to Agent Ready.
