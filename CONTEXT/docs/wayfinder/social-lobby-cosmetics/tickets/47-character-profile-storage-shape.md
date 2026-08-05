# 47 — Character profile storage shape

**Type:** grilling  
**Label:** wayfinder:grilling  
**Blocked by:** —  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

Where does the character profile live, and what's in it?

Today `src/main.ts` persists `{ level, xp, wins, kills, matches }` in localStorage, and online matches submit results to Nakama storage idempotently (INV-6, `src/net/nakama.ts`). This effort adds: character **name**, **selected gun skin**, **selected car skin**, **owned-skins list**, **currency balance**, **friends list**.

Settle: the exact profile schema; which fields are local-only vs. Nakama-storage-backed when signed in; how a signed-in profile merges with a local one; whether name/currency/owned-skins are per-Nakama-account (tied to `account.id`) or per-device. Locked constraint: profile writes stay idempotent (INV-6) and name/skin choices must not affect gameplay (INV-4 unaffected).

## Not yet decided (do not resolve here)

- Economy numbers / unlock thresholds (ticket 49).
- Skin catalog breadth (ticket 48).
