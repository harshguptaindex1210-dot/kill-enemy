# Handoff — friends + AAA lobby + audit fixes

**Date:** 2026-08-07  
**Mode:** drain (build → harden → judge)  
**Branch:** `main`  
**Tracker:** GitHub issues (no Project scope)

## Summary

Shipped lobby friends MVP (#67/#68), AAA-style BR lobby redesign, and remaining audit HUD/lobby fixes from user session.

## Built

### Friends (#67 MVP / #68 UX)
- `addFriend` / `removeFriend` in `profile.ts` — persisted in `friends[]` (local + Nakama profile merge)
- Lobby **Squad · Friends** sidebar: add by username, list, remove, invite stub
- Online invite shows stub message until Nakama friends API lands

### Lobby redesign
- Tactical BR layout: season badge hero, stats strip, **mode cards** (Online / Local), glass panels
- 3D character showcase visible through translucent overlay; canvas `pointer-events: none`
- Friends sidebar on laptop; `#btn-online` / `#btn-local` preserved (INV-L1/L2 smoke green)

### Audit fixes
| # | Fix |
|---|-----|
| 2 | Minimap `aimYaw` from pitch-aware aim direction |
| 3 | Compass ping uses shot `yaw`, not bearing-to-enemy |
| 4 | Kill feed moved to top-left (no minimap overlap) |
| 5 | Single RESPAWN button (`#hud-respawn` only) |
| 6 | 3D lobby canvas z-index 0, no pointer capture |
| 8 | Death overlay opacity 0.55 → 0.78 |
| 9 | Minimap click toggles fullscreen (N key still works) |
| lag | Bot AI throttled off-combat (80ms); combat full rate |

## Gates (exit 0)

```text
npm test                    → 292 passed
npm run typecheck           → 0
npm run build               → INV-3 OK
npm run smoke:lobby         → INV-L1/L2 OK
```

## Issues closed
- #67 Friends API surface (MVP local + profile persist; Nakama friends RPC deferred)
- #68 Friends UX + invites in lobby

## Still open (wayfinder — not in scope)
- #69 Cosmetic mesh application
- #70 Currency + shop economy model

## Next agent
- `/wayfinder` or grill #69/#70 before coding
- Wire Nakama `listFriends` / `addFriend` when server ready (#67 follow-up)
