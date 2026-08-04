# PRD — Production-Grade Battle Royale (Robot Arena)

## Problem
The MVP ships a single-match sandbox: the player spawns with 3 preset weapons and
fights 5 endlessly-respawning bots. There is no win/lose loop, no loot, no zone
consequence, no inventory, no progression, no multiplayer. It is a demo, not a game.

## Goal
A **fully functional battle royale** playable end-to-end in the browser: start in a
lobby, drop, loot, fight to be last alive against bots (local) or real players
(online, Nakama), see results, gain XP, and loop back. All systems testable via
`npm test` and the headless simulation.

## Success criteria
1. A complete match is playable: lobby → countdown → drop → play → death/spectate →
   results → lobby, in **local mode** (no server) and **online mode** (Nakama).
2. The last robot standing wins; the zone forces an end ≤ 25 minutes (INV-5).
3. Every feature below ships with unit tests; `npm test` stays green (75 existing +
   new), `npm run lint`, `npm run typecheck`, `npm run build` all pass, bundle ≤ 512KB
   (INV-3).
4. A real (or dockerized) Nakama server can host authoritative matches; the client
   syncs via the protocol defined in issue N-16/17.
5. Docs updated: README, ARCHITECTURE, DEPLOY, GAMEPLAY, CONTEXT.

## In scope (dependency order — see issues #24..#43)
- **Match lifecycle** (lobby/countdown/drop/play/dead/spectate/results sub-state machine)
- **Loot** pads + pickup + inventory (2 guns + melee + grenades, ammo/armor/meds)
- **Health/armor/healing** (medkit/bandage use, armor absorb)
- **Grenades** (projectile arc, bounce, fuse, AoE falloff)
- **Melee** (bat/knife/pan, swing, hit detection) in real gameplay
- **Zone damage** (storm) + shrinking ring + warnings
- **Bot AI v2** (3 difficulty profiles, loot/zone/combat goals, permadeath, placement)
- **Results + progression** (XP by placement/kills/damage, level, persistence)
- **Combat feedback** (hit markers, damage numbers, kill feed, compass, match timer)
- **Audio** (procedural WebAudio)
- **Settings persistence** (quality, sensitivity, audio, camera mode)
- **Airdrops** (care packages mid-match)
- **Vehicles** (sedan/buggy, enter/exit/drive)
- **Spectate** after death
- **Ads** (stub overlay between matches)
- **Nakama authoritative match server** (full Lua handler: spawn/combat/loot/zone/sync/end)
- **Nakama client** (socket, join, input→snapshot protocol, rollback integration)
- **Matchmaking** (solo queue, bot fill to 10)
- **Leaderboards + match history**
- **CI**: browser smoke test (puppeteer) + docs

## Out of scope (this effort)
- Duos/squads, multiple maps, 50-player matches, real 3D assets, anti-cheat beyond
  server validation, mobile/touch, replay, GTA/NFS modes.

## Acceptance gate (every issue restates the relevant invariant)
- INV-1 fps floor, INV-2 latency budget, INV-3 bundle, INV-4 server authority,
  INV-5 lifecycle termination, INV-6 persistence safety, INV-7 browser compat.
