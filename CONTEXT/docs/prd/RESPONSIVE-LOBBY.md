# Spec — Responsive Lobby Polish (phone + laptop)

**Date:** 2026-08-06  
**Tracker:** local (`CONTEXT/docs/prd/issues/`) — GitHub Project unavailable (missing `project` scope)  
**Live URL:** https://harshguptaindex1210-dot.github.io/kill-enemy/

## Problem Statement

Opening the game on a phone, the lobby is hard to use: the first screen does not
clearly present play actions, sections feel cramped, and layout can feel “not
formatted.” On a laptop the same lobby works but looks plain and uneven. Players
need both the mobile and laptop links to look intentional and usable without a
full UI rewrite.

## Solution

Responsively polish the existing ROBOT ARENA lobby overlay: keep every current
section, make the phone first viewport brand + play actions, stack/wrap content
cleanly on narrow widths, improve laptop spacing/max-width/typography/alignment,
and prove both viewports with an automated smoke script.

## User Stories

1. As a phone player, I want Play Online visible without scrolling, so I can start a match immediately.
2. As a phone player, I want Play Local reachable on the first screen, so offline play is obvious.
3. As a phone player, I want Cancel visible on the first screen while queueing, so I can leave matchmaking.
4. As a phone player, I want the brand title readable on a ~390px screen, so I know I am in ROBOT ARENA.
5. As a phone player, I want character / settings / shop / history below the fold, so the first screen stays uncluttered.
6. As a phone player, I want chassis and gun-skin cards to wrap in a grid, so I never need sideways page scroll.
7. As a phone player, I want no page-level horizontal overflow, so the lobby does not feel broken.
8. As a laptop player, I want the multi-column lobby preserved, so I can scan character, loadout, and settings together.
9. As a laptop player, I want consistent spacing and max-width, so the lobby does not look sparse or cramped.
10. As a laptop player, I want readable type hierarchy (title vs panels), so the screen feels designed.
11. As a returning player, I want all existing lobby sections still present, so I do not lose shop or stats.
12. As a developer, I want a viewport smoke script, so INV-L1/L2 are machine-checkable.
13. As a reviewer, I want lobby-only scope, so HUD/touch/results changes cannot sneak in.
14. As a pipeline agent, I want #46 then #47, so layout lands before the browser gate that proves it.

## Implementation Decisions

- **Scope:** lobby overlay only (presentation). No HUD, touch controls, results, or spectate changes.
- **Structure:** keep one scrollable lobby; mark a hero/first-fold region for brand + play actions.
- **Phone (~390px):** single-column / wrapping panels; shop cards wrap (1–2 wide); no horizontal page scroll.
- **Laptop (≥1024px):** keep multi-column wrap; polish padding, max-width (~960–1100px content), type scale, card alignment.
- **Styles:** prefer a dedicated lobby stylesheet + semantic classes over growing inline style strings, so media queries are honest.
- **Behavior:** existing callbacks, queue state, shop actions, and `escapeHtml` stay unchanged.
- **Split tickets:** #46 ships layout/CSS/DOM structure with unit/DOM gate; #47 ships `smoke:lobby` proving INV-L1/L2 in real viewports.
- **Bundle:** must continue to meet INV-3; CSS should stay small and in the initial path only as needed for lobby.

## Testing Decisions

- Highest seam for #46: render `showLobby` under jsdom and assert hero contains play buttons, overlay uses responsive classes, shop grid class present.
- Highest seam for #47: Puppeteer at ~390×844 and ~1280×720 against vite preview — lobby mounts, no `scrollWidth > clientWidth`, Play Online in first phone viewport.
- Do not use screenshot goldens.
- Existing `npm run smoke` (Play Local path) must still pass after layout changes.

## Invariants (acceptance constraints)

| ID | Must hold |
|----|-----------|
| INV-L1 | Phone: lobby mounts; Play Online in first viewport; no page horizontal overflow |
| INV-L2 | Laptop: lobby mounts; no page horizontal overflow; multi-column layout preserved |
| INV-3 | Initial bundle budgets still met |
| INV-7 | Existing browser smoke (lobby → Play Local) still passes |

## Out of Scope

- In-match HUD, touch joystick/buttons, results, spectate
- Tabbed mobile IA / multi-screen lobby rewrite
- Native app / Phase 2
- Golden screenshots
- New game features (cosmetics rules, matchmaking, netcode)

## Further Notes

- Locked decisions L1–L8 from grill (2026-08-06).
- Tracker mode: **local files** until `gh auth refresh -s read:project,project`.
- Frontier after publish: **#46 Agent Ready**; #47 Planned (blocked by 46); #44 Planned (deferred behind this effort); #45 Planned (blocked by 44).
