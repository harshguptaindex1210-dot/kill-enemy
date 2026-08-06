# 49 — Bot engage fix (no flee on approach)

**Status:** Done  
**Blocked by:** None  
**Bounce count:** 0

## What to build

Fix bot combat movement so enemies chase and engage the player when in sight instead of backing away when the player closes distance.

## Acceptance criteria

- [ ] When an enemy is in combat range, the bot moves forward toward the player unless already at melee distance (< 4m).
- [ ] Bots do not set `backward` when the player is within preferred firing range (the prior kiting band caused flee behavior).
- [ ] Existing bot tests pass; new test locks chase-on-close behavior.

## Invariants

INV-1 (no perf regression from AI change).

## Verification-command

```bash
npm test -- tests/bots.test.ts && npm run typecheck && npm run lint
```

## Priority

High — broken combat feel in local matches.
