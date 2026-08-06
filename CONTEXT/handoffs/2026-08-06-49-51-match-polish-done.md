# Handoff — #49–#51 Done (bot engage, smaller map, lobby instructions)

**Date:** 2026-08-06  
**Mode:** plan → drain (build/harden/judge in one session)  
**Tracker:** local (`CONTEXT/docs/prd/issues/`) — GitHub Project unavailable (missing `project` scope)

## Tickets

| # | Title | Final status |
|---|-------|--------------|
| 49 | Bot engage fix | Done |
| 50 | Smaller match area | Done |
| 51 | Lobby how-to-play panel | Done |

## Changes

### #49 Bot engage
- `bots.ts`: combat movement chases until melee range; removed kiting band that set `backward` when player closed in.
- `tests/bots.test.ts`: new chase-on-close test.

### #50 Smaller map
- `constants.ts`: `MAP_BOUND=280`, scaled zone phases + POI radius.
- Wired through `gameplay.ts`, `zone.ts`, `scene.ts`, `game.ts`, `nakama/modules/match_handler.lua`.
- `tests/constants.test.ts`, updated zone/gameplay tests.

### #51 Lobby instructions
- `lobby.ts` + `lobby.css`: right-side sticky How to Play panel (laptop); stacks on phone.
- `tests/lobby-layout.test.ts`: panel mount assertion.

## Gates (exit 0)

```text
npm test -- tests/bots.test.ts                          → 13 passed
npm test -- tests/constants.test.ts tests/zone.test.ts tests/gameplay.test.ts → 43 passed
npm test -- tests/lobby-layout.test.ts                  → 8 passed
npm run typecheck                                       → 0
npm run build                                           → 0 (INV-3 OK)
```

## Verdict

PASS — all three acceptance criteria met.

## Next

Queue empty for this effort. Prior frontier was #47 Done per last handoff.
