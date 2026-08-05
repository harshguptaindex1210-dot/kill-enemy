# 53 — Deliver online snapshots via socket.onmatchdata (C1)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (C1)

## What to build

`MatchClient.connect()` (online branch, `src/net/client.ts:86`) creates the socket but never registers `socket.onmatchdata`. Server broadcasts `OP_SNAPSHOT` (`nakama/modules/match_handler.lua:419`), but no handler decodes it, so `handleSnapshot`/interp/rollback never run online. Wire the socket match-data handler so online matches actually receive snapshots.

## Acceptance criteria

- [ ] `MatchClient.connect()` (online) registers an `onmatchdata` handler on the socket.
- [ ] The handler decodes `OP_SNAPSHOT` payloads with `decodeSnapshot` (opcode 2, `src/net/protocol.ts`).
- [ ] The decoded snapshot feeds `handleSnapshot` (interp + rollback + `cb.onSnapshot`).
- [ ] A unit test delivers a synthetic OP_SNAPSHOT through the client socket callback and asserts `interp.latest`/rollback update — no live Nakama needed.
- [ ] Input path unchanged: `sendMatchInput` still sends opcode 1 (OP_INPUT).
- [ ] Existing protocol tests still pass.

## Verification-command

```bash
npm test -- tests/online-snapshots.test.ts tests/nakama-protocol.test.ts tests/multiplayer.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-2 (snapshots delivered within rollback budget), INV-4 (client only sends inputs, never state).
