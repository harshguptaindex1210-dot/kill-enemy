# Handoff — #48 vehicle rider visible → Debugger Ready

**Date:** 2026-08-06  
**Ticket:** #48  
**Status:** Coding → Debugger Ready  
**Constraint:** lobby name/interface untouched

## Fix

- Root cause: `game.ts` hid `rig.group` whenever `inVehicleId !== null`.
- Now alive riders stay visible; `riderWorldPose` seats them on motorbike/sedan/buggy; yaw follows vehicle; crouch anim while mounted; held weapons still hidden (INV-W1).

## Gate

```bash
npm test -- tests/vehicle-rider.test.ts && npm run typecheck && npm run lint && npm run build
```

PASS.

## Next

`/debugger` → `/reviewer` on #48. Then resume #47 or held-weapons.
