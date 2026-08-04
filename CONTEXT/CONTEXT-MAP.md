# CONTEXT Map — Robot Arena (Shooter Game)

Where things live. Load CONTEXT.md first.

## Docs
- `CONTEXT/CONTEXT.md` — locked decisions (D1–D14), effort decisions (E1–E14), invariants (INV-1..7), failure modes, risk register.
- `CONTEXT/docs/prd.md` — PRD for the production-grade completion effort.
- `CONTEXT/docs/research/battle-royale-architecture.md` — research notes (netcode, zones, loot, bots, pacing).
- `CONTEXT/handoffs/` — per-effort handoffs (read the newest first).

## Source (`src/`)
| File | Purpose |
|------|---------|
| `main.ts` | Glue: boots scene, runs game loop, wires all systems |
| `scene.ts` | World: ground, roads, vegetation, 4 POIs, lights, camera, controls |
| `renderer.ts` | WebGLRenderer factory by quality preset |
| `robot.ts` | Procedural robot model + AnimationMixer (idle/run/jump/crouch) |
| `player.ts` | Player movement/physics (stand/crouch/sprint/jump), yaw/pitch |
| `input.ts` | Keyboard/mouse input manager → `PlayerInput` |
| `camera.ts` | TPS/FPS camera follow + smoothing |
| `weapons.ts` | Hitscan + instant-AoE weapons, fire/reload/spread/damage zones |
| `melee.ts` | Melee defs (bat/knife/pan), swing, hit cone, attach mesh |
| `loot.ts` | Loot pad generation per POI tier + pickup |
| `inventory.ts` | Weapon slots, ammo pool, armor, switching |
| `zone.ts` | ZoneSystem: 5 phases, ring mesh shrink, damage/sec, outside check |
| `match.ts` | Match state machine + kill/placement/XP |
| `netcode.ts` | RollbackEngine (prediction/reconciliation) + bot input factory |
| `damageable.ts` | HP capsule targets (takeDamage, respawn) |
| `persistence.ts` | Stats, XP/level, recordMatch, storage keys |
| `vehicle.ts` | Sedan/buggy defs, drive physics, nearby-vehicle find |
| `ad.ts` | Stub ad overlay (skip after timer) |
| `lobby.ts` | 2D lobby overlay (start, stats, settings) |
| `hud.ts` | HUD (health/ammo/storm) + canvas minimap |
| `net/nakama.ts` | Nakama client: auth guest/email, session restore |

## Server (`nakama/`)
- `match_handler.lua` — authoritative match handler (stub → full server in this effort).

## Scripts (`scripts/`)
- `simulate-game.ts` — headless integration simulation of all systems.
- `bundle-size.js` — bundle size gate.
- `bench-render.js` — Puppeteer render benchmark (low/medium presets).

## Tests (`tests/`)
- Vitest files mirroring `src/` modules + `invariants.test.ts`, `netcode-scale.test.ts`.

## CI (`.github/workflows/ci.yml`)
- typecheck → lint → test → build → bundle ≤512KB gate.

## Repo state (July 2026 baseline)
- MVP + visual pass complete; 75 tests green; bundle 545KB raw / 140KB gz.
- Current effort: production-grade completion. GitHub issues #23–#43, map issue #23.
