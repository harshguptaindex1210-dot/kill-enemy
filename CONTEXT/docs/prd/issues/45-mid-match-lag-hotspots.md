# 45 — Mid-match lag hotspots (INV-1)

**Status:** Agent Ready  
**Blocked by:** 44 — Local held-weapon skins  
**Spec:** `CONTEXT/docs/prd/HELD-WEAPONS-LAG.md`

## What to build

With local held weapons from ticket 44 attached, mid-match hitching under load (bots, loot, zone, airdrops) in Local and Online is reduced by measuring then fixing proven render/sim hotspots until INV-1 frame floors hold. Do not force default quality to low. Do not ship a full LOD/instancing rewrite.

## Acceptance criteria

- [ ] A written hotspot note (in the ticket comment or handoff) lists the measured bottlenecks from a loaded match with held weapons on — before shipping unmotivated changes.
- [ ] After fixes, `npm run bench:render` low preset median fps ≥ 30 (INV-1).
- [ ] After fixes, `npm run bench:render` medium preset median fps ≥ 60 on the reference bench harness (INV-1).
- [ ] Default settings quality remains `medium` unless the user already chose otherwise (no forced low default).
- [ ] Held-weapon visibility from ticket 44 still passes (INV-W1/W2 regression check).
- [ ] Initial bundle still meets INV-3 (`npm run build`).

## Verification-command

```bash
npm test -- tests/held-weapons.test.ts && npm run bench:render -- low && npm run bench:render -- medium && npm run typecheck && npm run lint && npm run build
```

## Invariants

INV-1, INV-3, INV-W1, INV-W2.
