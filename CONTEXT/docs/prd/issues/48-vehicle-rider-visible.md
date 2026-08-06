# 48 — Show rider on bike and cars

**Status:** Done  
**Blocked by:** None  
**Bounce count:** 0  
**Verdict:** PASS — gate green; riders visible on motorbike/sedan/buggy with seat offsets; lobby untouched.  
**Independence:** same `/work` session authored + judged (disclosed).

## What to build

When the local (and other) players enter a **motorbike**, **sedan**, or **buggy**, their robot
rig stays **visible** seated on/in the vehicle instead of disappearing. Exit restores
normal on-foot visibility. Do **not** change lobby name, branding, or interface.

## Acceptance criteria

- [x] Alive unit with `inVehicleId` set still has `rig.group.visible === true` for motorbike.
- [x] Alive unit with `inVehicleId` set still has `rig.group.visible === true` for sedan and buggy.
- [x] Rider pose uses a per-vehicle seat offset (not floating at raw chassis origin).
- [x] Rider yaw follows the vehicle facing while mounted.
- [x] On exit / not in vehicle, on-foot positioning behavior is unchanged.
- [x] Held weapons stay hidden while mounted (existing INV-W1 vehicle rule).
- [x] Lobby overlay / title / `lobby.css` are not modified by this ticket.

## Invariants

INV-W1 vehicle branch (held mesh hidden in vehicle) remains true.

## Verification-command

```bash
npm test -- tests/vehicle-rider.test.ts && npm run typecheck && npm run lint && npm run build
```
