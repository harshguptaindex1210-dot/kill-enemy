# Map — Social Lobby + Cosmetics Hub

**Label:** wayfinder:map  
**Tracker mode:** local files (GitHub Project blocked — `gh auth refresh -s read:project,project` to promote)

## Destination

A **3D lobby scene** where the player's robot stands idle, with a **character profile** (rename, level/XP display), a **friends system** (requests, list, presence, match invites), and a **cosmetics hub** (gun skins + car skins; level-gated unlocks AND a currency shop with purchases). Skins display **local-only** (equipper sees them in-match). Profile persists in **local storage + Nakama storage** when signed in. Reaching the end of this map = a spec + PRD-ticket breakdown for that hub, ready for `/planner`.

## Notes

- Domain: browser battle royale (Three.js), Nakama backend, local + online modes.
- Skills every session should consult: `grilling`, `domain-modeling`, `prototype`, `research`.
- Codebase anchors: `src/lobby.ts` (2D overlay), `src/scene.ts` (`createScene`), `src/game.ts` (`MatchGame` constructor), `src/net/nakama.ts` (socket/storage), `src/heldWeapons.ts` (held meshes), `src/vehicle.ts` (car meshes), `src/main.ts` (localStorage stats), `CONTEXT/CONTEXT.md` (INV-1..7, E6 progression).
- Standing prior decisions: D14 lobby=2D overlay (this effort changes it); E6 progression→level already exists; INV-4 server authority — **skins are cosmetic, never gameplay-affecting**; INV-6 idempotent writes.

## Decisions so far

(none — charting)

## Not yet specified

- **Economy details**: currency earn rate per match, shop prices, whether currency is a Nakama wallet vs. a storage counter, refunds/purchase rollback.
- **Skin catalog breadth**: which guns get skins (rifle/pistol both?), how many skins per item, which vehicles (sedan/buggy?), whether car skins change wheels/body/paint.
- **Unlock model interaction**: how level-gates and currency shop coexist (can you buy a skin you haven't leveled to?).
- **Friends UI shape**: where the friends panel lives in the 3D lobby, presence granularity (in-lobby vs in-match), invite failure modes (target in queue/in match/offline).
- **Name validation rules**: length/charset, uniqueness (Nakama account display name vs local), rename frequency.
- **3D lobby scene**: room or podium? walkable or orbit-camera? how the robot rig is reused (idle animation, blockout robot from `robot.ts`).
- **Currency balance**: no numbers yet.

## Out of scope

- Skins visible to other players online (locked **local-only**).
- Real-money purchases (locked: currency shop, no payments SDK).
- Mobile/touch (inherited from project).

## Tickets

| # | Title | Type | Blocked by |
|---|-------|------|------------|
| 46 | [3D lobby scene architecture](tickets/46-3d-lobby-scene-architecture.md) | prototype | — |
| 47 | [Character profile storage shape](tickets/47-character-profile-storage-shape.md) | grilling | — |
| 48 | [Skin data model + catalog scope](tickets/48-skin-data-model-catalog-scope.md) | grilling | 47 |
| 49 | [Currency + shop economy model](tickets/49-currency-shop-economy-model.md) | grilling | 48 |
| 50 | [Friends API surface (Nakama)](tickets/50-friends-api-surface-nakama.md) | research | — |
| 51 | [Friends UX + invites in lobby](tickets/51-friends-ux-invites-lobby.md) | grilling | 50 |
| 52 | [Cosmetic application to held + vehicle meshes](tickets/52-cosmetic-application-to-meshes.md) | research | 48, 46 |

**Frontier** (open, unblocked, unclaimed): 46, 47, 50. Everything else is blocked until its blockers close.
