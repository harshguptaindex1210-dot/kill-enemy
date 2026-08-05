# Handoff — Social Lobby + Cosmetics Hub (wayfinder map charted)

**Date:** 2026-08-05  
**Effort:** 3D lobby + character profile (name/level) + friends + gun/car cosmetics  
**Tracker mode:** **local files** (GitHub Project blocked — token missing `read:project`; run `gh auth refresh -s read:project,project` to promote)  
**Stage:** wayfinder **map charted** — no tickets resolved yet (chart-the-map is one session's work)

## Destination

A 3D lobby scene where the player's robot stands idle, with a character profile (rename, level/XP), a friends system (requests, list, presence, match invites), and a cosmetics hub (gun + car skins; level-gated unlocks AND a currency shop). Skins display **local-only**. Profile persists local + Nakama storage. End of map = a spec + PRD-ticket breakdown ready for `/planner`.

## Locked decisions (from charting grill)

- Skins: **local-only display** (never in wire snapshots — INV-4 intact).
- Unlocks: **level-gated AND currency shop with purchases** coexist.
- Friends: full scope — requests + list + presence + match invites.
- Persistence: **local storage + Nakama storage** when signed in.
- Out of scope: skins visible to others online, real-money purchases.

## Map + frontier

Map: `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

| # | Title | Type | Blocked by | Status |
|---|-------|------|------------|--------|
| 46 | [3D lobby scene architecture](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/46-3d-lobby-scene-architecture.md) | prototype | — | **frontier** |
| 47 | [Character profile storage shape](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/47-character-profile-storage-shape.md) | grilling | — | **frontier** |
| 50 | [Friends API surface (Nakama)](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/50-friends-api-surface-nakama.md) | research | — | **frontier** |
| 48 | [Skin data model + catalog scope](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/48-skin-data-model-catalog-scope.md) | grilling | 47 | blocked |
| 49 | [Currency + shop economy model](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/49-currency-shop-economy-model.md) | grilling | 48 | blocked |
| 51 | [Friends UX + invites in lobby](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/51-friends-ux-invites-lobby.md) | grilling | 50 | blocked |
| 52 | [Cosmetic application to held + vehicle meshes](CONTEXT/docs/wayfinder/social-lobby-cosmetics/tickets/52-cosmetic-application-to-meshes.md) | research | 48, 46 | blocked |

**Frontier** (open, unblocked): 46, 47, 50. Resolve one ticket per session; on resolution comment the answer, close the ticket, append a Decisions-so-far line to the map.

## Next agent

Work the frontier **one ticket per session**, oldest-numbered unblocked first (46, then 47, then 50). Each resolution: post the answer, close, append to map's Decisions-so-far, graduate fog from the map's "Not yet specified" into new tickets, wire blocking in a second pass. Use `/research` for 50, `/grilling` + `/domain-modeling` for 47, `/prototype` for 46. When the map is exhausted (no open tickets), re-run `/planner` on the resulting spec breakdown.

Facts already in code (do not re-discover):
- Lobby is a 2D DOM overlay (`src/lobby.ts`) over `#game` canvas; `src/main.ts` wires Play Local/Online.
- `createScene` (`src/scene.ts`) gives scene/camera/renderer/OrbitControls + POIs; `MatchGame` (constructor `src/game.ts:119`) builds the full match on that canvas.
- Profile stats persist in localStorage via `src/main.ts`; online results go to Nakama storage idempotently (INV-6).
- Held-weapon meshes are local-only blockouts (`src/heldWeapons.ts`, INV-W1/W2); cars in `src/vehicle.ts`.
