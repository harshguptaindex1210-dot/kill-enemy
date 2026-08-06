# 51 — Lobby how-to-play panel

**Status:** Done  
**Blocked by:** #50 (serial drain order; independent but queued after map ticket)  
**Bounce count:** 0

## What to build

Add a right-side instructions panel in the lobby covering controls, keys, and gameplay basics. Preserve INV-L1/L2 responsive lobby behavior.

## Acceptance criteria

- [ ] Lobby shows a "How to Play" panel with movement, combat, loot/vehicle, and zone basics.
- [ ] On laptop (≥1024px) the panel sits to the right of the main lobby shell without page horizontal overflow.
- [ ] On phone the panel stacks in the scroll flow (not required in first viewport).
- [ ] Existing lobby layout tests pass; new test asserts instructions panel mounts.

## Invariants

INV-L1, INV-L2, INV-3, INV-7.

## Verification-command

```bash
npm test -- tests/lobby-layout.test.ts && npm run typecheck && npm run lint && npm run build
```

## Priority

Medium — onboarding for new players.
