# 58 — Batch full look delta in flushInputs (H4)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H4)

## What to build

`flushInputs` (`src/net/client.ts:122`) keeps only `frames[frames.length - 1]` per 20 Hz tick, discarding per-frame `mouseX` deltas between ticks. At 60 fps ~2/3 of mouse look is lost.

## Acceptance criteria

- [ ] `flushInputs` merges the batched frames: sums `mouseX`/`mouseY` deltas, takes the latest button/key state, and sends one input per tick.
- [ ] A test feeds N frames with mouseX deltas between ticks and asserts the merged input carries the sum.
- [ ] Local and online paths use the same merged input (rollback prediction matches what's sent).

## Verification-command

```bash
npm test -- tests/multiplayer.test.ts tests/interpolation.test.ts tests/netcode.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-2 (input-to-prediction ≤16ms), INV-4 (server still authoritative over movement).
