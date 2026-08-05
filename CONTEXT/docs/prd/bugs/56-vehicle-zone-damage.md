# 56 — Remove duplicate zone damage on vehicle occupants (H1)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (H1)

## What to build

`updateVehicles` (`src/gameplay.ts:695`) applies zone damage to occupants while `updateZone` (`src/gameplay.ts:650`) damages the same unit again because its position equals the vehicle position. Occupants take storm damage twice per frame.

## Acceptance criteria

- [ ] A vehicle occupant in the storm takes zone damage at the same rate as a standing player (single application per tick).
- [ ] A test asserts total zone damage applied to an occupant over N ticks equals one `damagePerSec` application per tick.
- [ ] Zone damage still applies normally to non-occupants.

## Verification-command

```bash
npm test -- tests/vehicle.test.ts tests/gameplay.test.ts && npm run typecheck && npm run lint
```

## Invariants

INV-5 (zone damage behavior), INV-4 (server authority on damage).
