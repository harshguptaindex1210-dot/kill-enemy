# 46 — 3D lobby scene architecture

**Type:** prototype  
**Label:** wayfinder:prototype  
**Blocked by:** —  
**Map:** `CONTEXT/docs/wayfinder/social-lobby-cosmetics/MAP.md`

## Question

How should the 3D lobby scene be structured? The current lobby is a pure 2D DOM overlay (`src/lobby.ts`) over a `#game` canvas. This effort needs the player's robot standing idle in a 3D scene behind the lobby UI.

Concretely: can we reuse `createScene` (`src/scene.ts`) and the blockout robot rig from `src/robot.ts` + the held-weapons meshes (`src/heldWeapons.ts`) to render a single idle robot on a small podium/room with an orbit camera, WITHOUT dragging in the full `MatchGame`/`MatchSim`/zone/loot machinery? Or does it warrant a dedicated `createLobbyScene`?

Answer with a working prototype (linked as an asset) showing: robot standing idle, orbit camera, lobby overlay in front, and a path to switch from lobby scene → `MatchGame` scene when Play Local/Online is pressed (`src/main.ts` flow).

## Not yet decided (do not resolve here)

- Room vs. podium, walkable vs. orbit (that's the later lobby grilling).
- What the robot looks like beyond the existing blockout.
