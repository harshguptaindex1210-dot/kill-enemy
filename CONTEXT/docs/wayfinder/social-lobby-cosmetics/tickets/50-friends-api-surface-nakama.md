# 50 — Friends API surface (Nakama)

**Type:** research  
**Label:** wayfinder:research  
**Blocked by:** —  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

What does the Nakama JS + Lua runtime expose for a friends system, and how does this codebase reach it?

The project uses `@heroiclabs/nakama-js` (`src/net/nakama.ts`, socket auth + realtime). Determine, from Nakama docs/source: friend request send/accept/reject/list APIs (client and socket variants), realtime presence events (`stream.presence` vs match presence), friend online/offline status feeds, and any server Lua hooks (`nakama/modules/` pattern) needed to gate friend ops. Map each to a concrete call the client can make and note which need a new server module vs. which are stock.

Create a markdown summary as a linked asset. Also note: does friend presence require a realtime socket connection, and how does that interact with the existing socket lifecycle (`createMatchViaSocket`/`joinMatch`)?

## Not yet decided (do not resolve here)

- The UX flow (ticket 51).
