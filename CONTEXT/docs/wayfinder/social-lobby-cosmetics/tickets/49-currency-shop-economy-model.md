# 49 — Currency + shop economy model

**Type:** grilling  
**Label:** wayfinder:grilling  
**Blocked by:** 48  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

How does currency work, and what do purchases look like?

Settle: the currency unit (e.g. "credits"), earn rate per match (placement/kills → credits, source: XP-derived or separate), whether currency is a Nakama wallet counter vs. a storage counter (INV-6 idempotency applies either way), and the shop flow — purchase deducted + skin added atomically, what happens on failure (insufficient funds / network drop mid-purchase), and whether level-gated skins can also be bought early (locked: both coexist — decide which wins if conflicting).

Balance matters enough to be its own ticket because `/planner` will write PRD-level numbers into the spec; a grilling answer with ranges is fine.

## Depends on

48 for the catalog the shop sells.
