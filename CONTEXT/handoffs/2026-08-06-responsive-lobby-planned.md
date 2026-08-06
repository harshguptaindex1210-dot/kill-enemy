# Handoff — Responsive lobby polish planned (#46 / #47)

**Date:** 2026-08-06  
**Effort:** Responsive lobby polish (phone + laptop)  
**Tracker mode:** **local files** (GitHub Project blocked — token missing `read:project` / `project`; run `gh auth refresh -s read:project,project` to promote)

## Mode this run

`/work` **plan** completed (grill locked L1–L8). Tickets published split. Next `/work` lap is **build** on #46.

## Locked decisions (L1–L8)

| # | Choice |
|---|--------|
| L1 | Lobby/menu layout only (not in-match) |
| L2 | Responsive polish; same sections |
| L3 | Phone first fold = brand + play actions |
| L4 | Laptop keeps multi-column; polish spacing/type |
| L5 | Shop cards wrap; no page horizontal scroll |
| L6 | Lobby overlay only |
| L7 | Automated viewport checks (no goldens) |
| L8 | This effort ahead of held-weapons #44 |

## Invariants

INV-L1, INV-L2 (in `CONTEXT/CONTEXT.md`) + INV-3, INV-7 restated on tickets.

## Slice order

| # | Status | File |
|---|--------|------|
| **46** | **Agent Ready** | `CONTEXT/docs/prd/issues/46-responsive-lobby.md` |
| **47** | Planned (blocked by 46) | `CONTEXT/docs/prd/issues/47-lobby-viewport-smoke.md` |

Index: `CONTEXT/docs/prd/tickets-responsive-lobby.md`  
Spec: `CONTEXT/docs/prd/RESPONSIVE-LOBBY.md`

## Deferred

| # | Status | Note |
|---|--------|------|
| 44 | Planned | Was Agent Ready; deferred behind #46 per L8 |
| 45 | Planned | Still blocked by 44 |

## Next agent

**Starts at ticket 46.** Use `/coder` (TDD against `tests/lobby-layout.test.ts` + typecheck/lint/build). Do **not** start 47 until 46 is Done. After 46 → `/debugger` → `/reviewer`. Then promote 47 to Agent Ready.

## Auth blocker (optional)

To move tickets onto GitHub Projects: `gh auth refresh -s read:project,project`

## Uncommitted unrelated work (do not mix)

Working tree may still have INV-W2 helper edits in `src/game.ts`, `src/heldWeapons.ts`, `tests/held-weapons.test.ts` — leave them out of this planning/layout commit.
