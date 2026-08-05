# 60 — Invalidate stale socket on disconnect (H6)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H6)

## What to build

`connectSocket` (`src/net/nakama.ts:49`) returns the module-cached socket without checking it's still connected. After `MatchClient.dispose()` disconnects it, a later online session reuses the dead socket and fails to join.

## Acceptance criteria

- [ ] `connectSocket` returns a fresh socket if the cached one is disconnected/closed.
- [ ] On disconnect, the module socket reference is cleared so the next `connectSocket` reconnects.
- [ ] A test asserts a second `connectSocket` call after a disconnect creates a new socket (no stale reuse).

## Verification-command

```bash
npm test -- tests/nakama.test.ts tests/online-snapshots.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-5 (reconnect path returns to lobby, no silent hang), INV-2.
