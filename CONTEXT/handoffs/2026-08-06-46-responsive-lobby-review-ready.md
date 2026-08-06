# Handoff — #46 Responsive lobby → Review Ready

**Date:** 2026-08-06  
**Ticket:** #46  
**Status move:** Debugging → **Review Ready** (local tracker)  
**Mode:** local-file tracker (no GitHub Project scope)

## Debugger findings fixed

| Net | Finding | Fix |
|-----|---------|-----|
| Invariant / failure | CSS-only positioning — lobby unusable if CSS chunk missing | Minimal inline `position:fixed;inset:0;z-index:9998;overflow:auto` |
| Weak tests | No remount coverage | Test: second `showLobby` leaves one overlay |
| Weak tests / security | No queue/shop message breakout coverage | Tests assert no injected `img`/`script` |
| Corner | `inset` serialization differs in jsdom | Assert `0` or `0px` |

## Gate

```bash
npm test -- tests/lobby-layout.test.ts && npm run typecheck && npm run lint && npm run build
```

**PASS** — 7/7 lobby-layout tests; INV-3 OK.

## Unfixed / out of ticket

- INV-L1/L2 Puppeteer geometry → **#47**
- Unrelated INV-W2 dirty files still local — not part of #46

## Next

`/reviewer` on #46 (blind vs ticket + diff). After Done, promote #47 to Agent Ready.
