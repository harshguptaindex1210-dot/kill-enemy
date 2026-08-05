# 57 — Remove lobby overlay when the online match starts (H7)

**Status:** Agent Ready  
**Blocked by:** 53  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H7)

## What to build

`launchOnlineMatch` (`src/main.ts:129`) starts `OnlineMatchGame` but never removes the `#lobby-overlay` DOM element (the local path removes it at `lobby.ts:193`). The opaque full-screen overlay (z-index 9998) covers the online match canvas, making online play invisible until the match ends.

## Acceptance criteria

- [ ] When an online match starts, the `#lobby-overlay` element is removed from the DOM.
- [ ] The overlay does not reappear until the match finishes and the app returns to the lobby.
- [ ] A test asserts the overlay is removed when the online match is launched.

## Verification-command

```bash
npm test -- tests/lobby.test.ts tests/online-snapshots.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-7 (lobby → match transition works), INV-5 (disconnect → lobby).
