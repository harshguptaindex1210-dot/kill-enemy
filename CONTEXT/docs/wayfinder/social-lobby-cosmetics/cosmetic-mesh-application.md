# Cosmetic Mesh Application (#69)

Research summary: how equipped skin ids become visible colors on held weapons and vehicles in a live local match. **Client-only — never in wire snapshots (INV-4).**

## Skin target → code path

| Skin target | Profile field | Color resolver | Mesh attach point | Material swapped |
|-------------|---------------|----------------|-------------------|------------------|
| Rifle | `equippedRifleSkin` | `gunColorFor('rifle', id)` | `heldWeapons.ts` → `buildRifle` body `MeshStandardMaterial` | Main box body (`held-rifle` child 0) |
| Pistol | `equippedPistolSkin` | `gunColorFor('pistol', id)` | `heldWeapons.ts` → `buildPistol` body material | Main box body (`held-pistol` child 0) |
| Sedan | `equippedSedanSkin` | `carColorFor('sedan', id)` | `vehicle.ts` → sedan body `MeshStandardMaterial` | Box body mesh (group child 0) |
| Buggy | `equippedBuggySkin` | `carColorFor('buggy', id)` | `vehicle.ts` → buggy body `MeshStandardMaterial` | Box body mesh (group child 0) |
| Chassis | `chassisId` | `chassisById(id).color` | `robot.ts` → `createRobotModel(tint)` | Robot body materials |

Grenade/melee held meshes use fixed accent colors (not in skin catalog yet).

## Plumbing: profile → match render

```
loadProfile()
  → syncLevelUnlocks()
  → matchCosmetics(profile)          // main.ts
       rifleColor, pistolColor, sedanColor, buggyColor, chassisColor
  → new MatchGame({ cosmetics })     // main.ts launchMatch()
       buildRigs()                   // game.ts — local human only (INV-W2)
         createHeldWeaponKit({ rifle, pistol })
         attachHeldWeaponKit(robot.group, held)
       buildVehicles()               // game.ts — local client view
         createVehicle(type, pos, { bodyColor })
```

Lobby preview uses the same color resolvers via `lobbyCosmetics()` → `lobbyScene.ts` `createHeldWeaponKit`.

## Local-only rules (INV-W1 / INV-W2 / INV-4)

- **Held weapons**: attached only to the local human rig (`!unit.isBot && unit.id === humanId`). Bots and remotes never get held kits.
- **Vehicle tints**: applied when `MatchGame` builds render meshes on the local client; sim state (`gameplay.ts`) has no skin fields.
- **Online**: cosmetics are not sent in Nakama snapshots; each client would resolve from its own profile (online match path does not yet pass `MatchCosmetics` — local training ground is the reference implementation).

## Constructor options

`MatchGameOptions.cosmetics?: MatchCosmetics` carries resolved hex colors (not raw skin ids). `main.ts` is the single entry that reads `PlayerProfile` equipped fields and calls `gunColorFor` / `carColorFor`.

## Verification

- `npm test -- tests/held-weapons.test.ts tests/vehicle.test.ts tests/cosmetics.test.ts`
- INV-W1/W2: held-weapons tests; local-only rig assertion in `game.ts` buildRigs
