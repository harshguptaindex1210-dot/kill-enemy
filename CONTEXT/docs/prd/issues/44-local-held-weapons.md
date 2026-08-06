# 44 — Local held-weapon skins (rifle / pistol / nade / melee)

**Status:** Planned  
**Blocked by:** None (deferred behind responsive lobby #46 / #47 per L8)  
**Spec:** `CONTEXT/docs/prd/HELD-WEAPONS-LAG.md`

## What to build

A local player in a match sees a blockout held weapon on their robot that matches the active loadout: distinct rifle and pistol meshes for gun slots, a small grenade mesh when the active slot is a grenade, and the existing melee mesh when slot 3 / melee mode is active. Switching 1/2/3 swaps which mesh is visible. Held meshes hide in a vehicle and when dead. Bots and remotes stay without held meshes. Same world mesh in TPS and FPS (no viewmodel).

## Acceptance criteria

- [ ] Local player with an active rifle slot shows a rifle blockout mesh on the robot while alive and not in a vehicle.
- [ ] Local player with an active pistol slot shows a distinct pistol blockout mesh (not the rifle mesh).
- [ ] Local player with an active grenade-in-slot shows a small held grenade mesh.
- [ ] Local player in melee mode (slot 3) shows the melee mesh and hides gun/nade meshes.
- [ ] Switching between slots 1/2 and melee updates visible mesh by the next applied-input frame (INV-W1).
- [ ] Entering a vehicle hides the held mesh; exiting while alive restores the correct mesh (INV-W1).
- [ ] On death, the held mesh is hidden (INV-W1).
- [ ] Unknown/null weapon type does not throw; held group stays hidden (INV-W1 failure mode).
- [ ] Bot and remote rigs do not receive held-weapon meshes from this ticket (INV-W2).
- [ ] Initial bundle still meets INV-3 after procedural meshes (`npm run build`).

## Verification-command

```bash
npm test -- tests/held-weapons.test.ts && npm run typecheck && npm run lint && npm run build
```

## Invariants

INV-W1, INV-W2, INV-3 (presentation only — INV-4 unchanged).
