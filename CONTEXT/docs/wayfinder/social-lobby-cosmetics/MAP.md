# Social Lobby & Cosmetics — Wayfinder Map

Parent effort for lobby profile, skin catalog, shop economy, and in-match cosmetic application.

| Ticket | Title | Status |
|--------|-------|--------|
| #69 | Cosmetic application to held + vehicle meshes | Done |
| #70 | Currency + shop economy model | Done |

## Linked assets

- [Cosmetic mesh application (#69)](cosmetic-mesh-application.md) — skin id → mesh/material code paths
- [Shop economy model (#70)](shop-economy-model.md) — credits, earn rate, purchase flow

## Code anchors

| Concern | Module |
|---------|--------|
| Skin catalog | `src/cosmetics.ts` |
| Profile + shop | `src/profile.ts` |
| Lobby shop UI | `src/lobby.ts` |
| Match plumbing | `src/main.ts` → `MatchGame` options |
| Held meshes | `src/heldWeapons.ts` |
| Vehicle meshes | `src/vehicle.ts` |
