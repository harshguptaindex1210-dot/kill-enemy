# 54 — Fix leaderboard_create args so the board exists (C2)

**Status:** Agent Ready  
**Blocked by:** None  
**Spec:** `CONTEXT/docs/audit/bug-audit-2026-08-05.md` (C2)

## What to build

`nakama/modules/leaderboard.lua:11` calls `nk.leaderboard_create(LEADERBOARD_ID, false, 0, "best", 0, "{}")` with numeric `0` for sort and reset. Nakama 3.22 Lua signature is `leaderboard_create(id, authoritative, sort, operator, reset, metadata)` where sort is `"desc"`/`"asc"` and reset is a CRON string. The type error is swallowed by `pcall`, so the board never exists and `submit_score` throws on every submission.

## Acceptance criteria

- [ ] `leaderboard_create` is called with sort `"desc"`, reset `""`, operator `"best"` (authoritative `true`).
- [ ] Creation failure is logged and rethrown (not silently pcall-swallowed).
- [ ] A test asserts the `leaderboard.lua` source contains the corrected `leaderboard_create` call (guards against regression without Docker).
- [ ] `submit_score` still validates placement/kills/damage and dedupes by `writeId` (INV-6).

## Verification-command

```bash
npm test -- tests/leaderboard.test.ts tests/nakama.test.ts && npm run luac:check && npm run typecheck && npm run lint
```

## Invariants

INV-6 (idempotent leaderboard submissions).
