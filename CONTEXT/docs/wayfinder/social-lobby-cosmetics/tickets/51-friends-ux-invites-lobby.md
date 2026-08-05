# 51 — Friends UX + invites in lobby

**Type:** grilling  
**Label:** wayfinder:grilling  
**Blocked by:** 50  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

What does the friends feature look like from the player's seat?

Settle the flow, given the API surface from ticket 50: sending a request (by what handle — Nakama display name? a friend code?), accepting/rejecting, seeing friends online, and **inviting a friend to your match** — what happens when the invitee is in the queue, in a match, or offline; whether an invite bypasses the matchmaker or uses the existing `addToMatchmaker` flow; and where the friends panel sits in the 3D lobby.

Also settle the failure/edge story: duplicate requests, self-add, ignoring requests, unfriend/block (or explicitly out of scope), and what the invitee sees (toast? lobby popup?).

## Depends on

50 for what the API can actually do.
