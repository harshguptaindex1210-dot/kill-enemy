# Handoff — #48 Done (vehicle rider visible)

**Date:** 2026-08-06  
**Ticket:** #48 → **Done**  
**Commit:** `1b64aa8` (+ docs close)

## User ask

Cannot see self on bike/car; do not change lobby name/interface.

## Fix

`game.ts` no longer hides mounted rigs. `riderWorldPose` / `shouldShowUnitRig` in `vehicle.ts`.

## Gate

`npm test -- tests/vehicle-rider.test.ts && npm run typecheck && npm run lint && npm run build` → 0

## Next

#47 Agent Ready, or #44 after that.
