# Tickets — Bug Fix Batch (audit 2026-08-05)

Local tracker (GitHub Project unavailable — missing `read:project` scope).  
Spec: `CONTEXT/docs/audit/bug-audit-2026-08-05.md`

| # | Title | Status | Blocked by |
|---|-------|--------|------------|
| **53** | [Deliver online snapshots via socket.onmatchdata (C1)](bugs/53-online-snapshots.md) | **Agent Ready** | None |
| **54** | [Fix leaderboard_create args (C2)](bugs/54-leaderboard-create-fix.md) | **Agent Ready** | None |
| **55** | [Drive zone UI from authoritative sim zone (H2)](bugs/55-zone-ui-from-sim.md) | **Agent Ready** | None |
| **56** | [Remove duplicate zone damage on vehicle occupants (H1)](bugs/56-vehicle-zone-damage.md) | **Agent Ready** | None |
| **57** | [Remove lobby overlay on online match start (H7)](bugs/57-online-lobby-overlay.md) | **Planned** | 53 |
| **58** | [Batch full look delta in flushInputs (H4)](bugs/58-flushinput-merge.md) | **Agent Ready** | None |
| **59** | [Fix right-click aim input (H3)](bugs/59-right-click-aim.md) | **Agent Ready** | None |
| **60** | [Invalidate stale socket on disconnect (H6)](bugs/60-stale-socket.md) | **Agent Ready** | None |
| **61** | [Guard zone-kill alive_count decrement (H5)](bugs/61-zone-kill-double-count.md) | **Agent Ready** | None |

**Frontier:** start at **53**. Promote **57** to Agent Ready only when 53 is Done.

Note: tickets reference test files (e.g. `tests/online-snapshots.test.ts`) that do not exist yet — the coder writes them test-first; the Verification-command is the done-condition.
