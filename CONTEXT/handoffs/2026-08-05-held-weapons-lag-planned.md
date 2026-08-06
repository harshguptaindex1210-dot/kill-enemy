# Handoff — Held weapons + mid-match lag (planned)

**Date:** 2026-08-05  
**Effort:** Local held-weapon blockouts + INV-1 mid-match hitching  
**Tracker mode:** **local files** (GitHub Project blocked — token missing `read:project` / `project`; run `gh auth refresh -s read:project,project` to promote)

## Locked decisions

See `CONTEXT/CONTEXT.md` (W1–W8) and `CONTEXT/docs/prd/HELD-WEAPONS-LAG.md`.

Summary: local-only blockout held meshes (rifle/pistol/nade/melee), same mesh in FPS, measure-then-fix lag under load, no cosmetics / no bot guns / no forced low quality.

## Invariants

INV-W1, INV-W2 (new) + INV-1, INV-3 restated on lag ticket. Details in `CONTEXT/CONTEXT.md`.

## Slice order

| # | Status | File |
|---|--------|------|
| **44** | **Agent Ready** | `CONTEXT/docs/prd/issues/44-local-held-weapons.md` |
| **45** | Planned (blocked by 44) | `CONTEXT/docs/prd/issues/45-mid-match-lag-hotspots.md` |

Index: `CONTEXT/docs/prd/tickets-held-weapons-lag.md`

## Next agent

**Starts at ticket 44.** Use `/coder` (TDD against the ticket’s Verification-command). Do **not** start 45 until 44 is Done. After 44 → `/debugger` → `/reviewer`. Then promote 45 to Agent Ready.

Facts already in code (do not re-discover):
- `weapons.ts` has **no** gun mesh.
- `attachWeaponToRobot` in `melee.ts` is **never called** from `game.ts`.

## Suggested skills

1. `/coder` — build #44 test-first  
2. `/debugger` — after #44 gate green  
3. `/reviewer` — blind close  
4. Re-run planner only if #45 needs re-grilled after measurement

## Auth blocker (optional)

To move tickets onto GitHub Projects: `gh auth refresh -s read:project,project`
