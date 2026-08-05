# 48 — Skin data model + catalog scope

**Type:** grilling  
**Label:** wayfinder:grilling  
**Blocked by:** 47  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

What is a "skin" in the data model, and how many are there?

Settle: the skin type discriminator (gun vs car); which weapons have skins (rifle/pistol — from the held-weapons blockouts in `src/heldWeapons.ts`) and which vehicles (sedan/buggy — `src/vehicle.ts`); how many skins per item in the first catalog; how a skin is referenced (stable id), named, and what visual it maps to (recolor/material swap on the blockout mesh — no new 3D assets in MVP).

Also settle: how level-gating interacts with the shop (locked: both coexist — see ticket 49 for economy). A skin definition should be pure data (id, name, target, unlockLevel) so both the catalog and the purchase/unlock logic read the same source.

## Depends on

47 for where owned-skins list lives.

## Not yet decided (do not resolve here)

- Currency numbers / pricing (ticket 49).
