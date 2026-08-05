# 59 — Fix right-click aim input (H3)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H3)

## What to build

`src/input.ts:58` reads `keys.has('MouseRight')`, but mouse buttons fire `mousedown` events (not `keydown`), and only button 0 is handled. Right-click aim/FPS toggle is dead.

## Acceptance criteria

- [ ] Holding right mouse button (button 2) while pointer-locked sets the `aim` input.
- [ ] Releasing it clears `aim`.
- [ ] Right-click does not trigger when pointer is not locked.
- [ ] A test asserts `getInput()` returns `aim=true` while button 2 is held and `aim=false` after release.

## Verification-command

```bash
npm test -- tests/input.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-1 (no added per-frame cost), INV-4 (aim is a client input, server validates).
