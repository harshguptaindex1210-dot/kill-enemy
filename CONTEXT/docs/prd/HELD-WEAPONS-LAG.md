# Spec — Local Held Weapons + Mid-Match Lag

**Date:** 2026-08-05  
**Tracker:** local (`CONTEXT/docs/prd/issues/`) — GitHub Project unavailable (missing `project` scope)  
**Parent effort:** post–production-complete polish

## Problem Statement

Players cannot see a gun (or melee) on their robot — firearms have no mesh, and melee’s attach helper is never wired. Separately, mid-match play hitch under load (bots, loot, zone, airdrops) in both Local and Online, which violates the frame-rate floor (INV-1).

## Solution

Add procedural blockout held-weapon meshes for the **local player only** (rifle, pistol, grenade-in-slot, melee), swapping visibility with loadout and hiding in vehicle/death. Then measure mid-match hitching with those meshes attached and fix proven hotspots until INV-1 holds — without forcing a low-quality default or a full render rewrite.

## User Stories

1. As a local player, I want to see a rifle mesh on my robot when slot 1 holds a rifle, so combat loadout is readable.
2. As a local player, I want a distinct pistol mesh when slot 2 holds a pistol, so slot switches are obvious.
3. As a local player, I want a small grenade mesh when the active gun slot is a grenade, so throwable loadout is visible.
4. As a local player, I want my melee (bat/knife/pan) visible when I press 3, so melee mode is clear.
5. As a local player, I want gun meshes hidden when I switch to melee, so only one held weapon shows.
6. As a local player, I want the same world gun mesh in TPS and FPS aim, so I do not need a separate viewmodel.
7. As a local player, I want held weapons hidden while in a vehicle, so the cabin/rig stays clean.
8. As a local player, I want held weapons hidden when dead, so corpses do not keep a floating gun.
9. As a local player, I do not want bots to grow held meshes from this change, so draw cost stays bounded (INV-W2).
10. As a local player, I want mid-match hitching reduced under load so the match stays at INV-1 floors.
11. As a player on medium hardware, I want quality presets unchanged by default, so look is not silently downgraded.
12. As a developer, I want a machine-checkable gate per ticket, so `/coder` can loop without judging by eye.
13. As a reviewer, I want INV-W1/W2 restated on the weapons ticket and INV-1/INV-3 on the lag ticket, so bounces are falsifiable.

## Implementation Decisions

- **Meshes:** procedural Three.js blockouts only (no new asset files) — rifle longer box+barrel, pistol shorter, grenade small sphere/cylinder, melee reuse existing melee mesh factory.
- **Scope of attach:** local human unit rig only; bots/remotes untouched (INV-W2).
- **Sync:** presentation layer reads sim unit state (`weaponIndex`, `meleeMode`, alive, `inVehicleId`, active weapon type) each frame (or on change) and toggles child mesh visibility.
- **Wire existing melee attach:** call the unused attach path for local melee; do not invent a second melee system.
- **FPS:** no viewmodel; world mesh stays parented to the robot.
- **Lag work:** profile under a full match load after skins land; fix only proven hotspots (pooling, shadows, per-frame alloc, sync loops). No forced `quality: low` default. No LOD/instancing mega-rewrite.
- **Authority:** meshes are client presentation only; combat remains server-authoritative (INV-4 unchanged).
- **Bundle:** procedural geometry must keep INV-3 initial-bundle budgets.

## Testing Decisions

- Prefer highest seams: held-weapon factory + visibility sync API tested without requiring a live WebGL context where possible (mock Object3D / group).
- Assert visibility matrix: slot × meleeMode × alive × inVehicle × weapon type.
- Assert non-local units never receive attach.
- INV-1: existing `npm run bench:render` (low ≥30 / medium ≥60 median).
- INV-3: existing `npm run build` / bundle-size script.
- Prior art: `tests/` vitest suite; melee/weapon unit tests; `scripts/bench-render.js`.

## Invariants (acceptance constraints)

| ID | Must hold |
|----|-----------|
| INV-W1 | Local alive, not in vehicle → correct held mesh; slot change by next applied-input frame; null/unknown → hide, no throw; vehicle/death → hide |
| INV-W2 | Bots/remotes unequipped by this effort |
| INV-1 | With held weapons attached, bench floors still met |
| INV-3 | Initial bundle budgets unchanged |

## Out of Scope

- Cosmetic/unlock skin system
- Held meshes on bots or remote players
- Separate FPS viewmodel
- Netcode rubber-banding as primary (INV-2) unless FPS work surfaces it later
- Big LOD / world instancing rewrite
- Forcing default quality to `low`

## Further Notes

- Tracker mode: **local files** until `gh auth refresh -s read:project,project`.
- Next agent starts at ticket **44** (`Agent Ready`). Ticket **45** stays `Planned` until 44 is Done.
