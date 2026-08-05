# 55 — Drive zone UI from the authoritative sim zone (H2)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H2)

## What to build

`MatchGame` never calls `zoneSys.update()` — only `updateFromZone()` (moves the ring mesh). `ZoneSystem.phaseTime` therefore stays 0 and its `innerRadius` is frozen at 480. The minimap circle (`game.ts:916`), zone timer (`game.ts:862`), and in-storm indicator (`game.ts:886`) all read the render-only `zoneSys` and never change.

## Acceptance criteria

- [ ] Minimap storm circle radius tracks the shrinking zone (`game.ts:916` reads the live zone).
- [ ] HUD zone timer counts down using live phase duration/time.
- [ ] In-storm indicator uses the live safe radius (shows once the player is outside the real storm).
- [ ] A test asserts zone UI values derive from a ZoneLogic whose `update(dt)` has advanced, not a static instance.

## Verification-command

```bash
npm test -- tests/zone.test.ts tests/game.test.ts tests/gameplay.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-1 (no added per-frame cost), INV-5 (zone still terminates matches).
