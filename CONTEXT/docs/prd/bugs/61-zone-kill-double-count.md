# 61 — Guard zone-kill alive_count decrement (H5)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H5)

## What to build

`nakama/modules/match_handler.lua:600` — a player killed by a shot while already outside the zone gets `alive_count` decremented a second time by the zone branch (health already ≤ 0), under-counting survivors and tripping premature win detection.

## Acceptance criteria

- [ ] Zone-damage kills only decrement `alive_count` if the player was still alive.
- [ ] A test asserts `alive_count` never goes below the true number of living players when a player is killed while in the storm.
- [ ] Win detection fires only when `alive_count <= 1` genuinely.

## Verification-command

```bash
npm test -- tests/nakama-protocol.test.ts tests/match.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-5 (matches terminate correctly), INV-4.
