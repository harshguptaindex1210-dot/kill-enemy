# 52 — Cosmetic application to held + vehicle meshes

**Type:** research  
**Label:** wayfinder:research  
**Blocked by:** 48, 46  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

Given a chosen skin id, how does the selected skin actually get applied to the right mesh in a live match, local-only?

The held-weapons effort (`src/heldWeapons.ts`, INV-W1/W2) attaches local-only blockout meshes to the player rig; `src/vehicle.ts` builds car meshes. Determine, by reading the code: the exact attach points (which object/material on the rig, which mesh on the vehicle), how a skin would swap materials/colors on those procedural meshes, and whether the equipped skin needs to be plumbed through `MatchGame`/`OnlineMatchGame` constructor options (and through `src/main.ts` local + online flows). Confirm skins stay client-side (never in wire snapshots / server state — INV-4).

Create a markdown summary as a linked asset mapping skin-target → concrete code path.

## Depends on

48 (what a skin is), 46 (lobby scene structure affects how selection reaches the match).
