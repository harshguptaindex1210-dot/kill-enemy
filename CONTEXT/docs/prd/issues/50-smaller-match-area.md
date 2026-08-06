# 50 — Smaller match area

**Status:** Done  
**Blocked by:** None  
**Bounce count:** 0

## What to build

Shrink the playable match arena (map bounds, zone phases, visual ground) so matches feel tighter and players encounter each other sooner.

## Acceptance criteria

- [ ] Shared `MAP_BOUND` constant drives gameplay clamping and zone phase radii (single source of truth).
- [ ] Map bound is ≤ 300m from center (down from 480m).
- [ ] Zone phase radii scale with the smaller map; first-phase safe radius after initial shrink is proportionally smaller.
- [ ] Scene ground/fog/POI layout fits the reduced arena.
- [ ] Nakama `match_handler.lua` uses matching bounds.
- [ ] Zone and gameplay boundary tests updated.

## Invariants

INV-5 (match still terminates via zone within 25 min — phase durations unchanged).

## Verification-command

```bash
npm test -- tests/zone.test.ts tests/gameplay.test.ts && npm run typecheck && npm run lint && npm run build
```

## Priority

Medium — user-requested tighter arena.
