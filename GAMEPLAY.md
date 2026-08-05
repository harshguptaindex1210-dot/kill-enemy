# Gameplay — Robot Arena

## Modes

| Mode | Players | Server |
|------|---------|--------|
| **Play Local** | You + 9 bots | In-process `MatchSim` |
| **Play Online** | Up to 10 (bots fill) | Nakama authoritative match |

Loop: lobby → countdown → drop → play → death/spectate → results → ad → lobby.

## Controls

| Action | Binding |
|--------|---------|
| Move | `W A S D` / arrows |
| Look | Mouse (pointer lock) |
| Sprint | `Shift` |
| Crouch | `Ctrl` |
| Jump | `Space` |
| Fire | LMB |
| Aim (FPS) | Hold aim / settings camera mode |
| Reload | `R` |
| Weapon 1 / 2 | `1` / `2` |
| Melee slot | `3` |
| Interact (loot / vehicle / airdrop) | `E` |
| Medkit | `H` |
| Bandage | `B` |
| Spectate next (when dead) | `F` |
| Mute toggle | `M` |
| Minimap size toggle | `N` |

## Combat

- **Rifle / pistol** — hitscan; head/body/limb multipliers.
- **Grenades** — projectile AoE, self-damage, knockback, bounce SFX.
- **Melee** — bat / knife / pan (spawn rotation); short-range cone.
- Armor absorbs before health. Death is permanent for the match (placement assigned).

## Loot & inventory

- Pads at POIs (Town, Factory, Docks, Hilltop): weapons, ammo, armor, heals.
- Inventory: 2 gun slots + melee + grenades; ammo pools; medkit/bandage with use timers.
- Full weapon slots: picking up a gun drops the equipped one as a pad.
- **Airdrops** — care packages mid-match; open with `E`. Zone can despawn unclaimed crates.

## Zone (storm)

Five phases; ring shrinks toward phase radius over ~30s each phase.
Outside the safe radius: damage/sec rises each phase (1 → 16).
HUD shows zone timer / storm warning.

## Vehicles

- **Sedan** / **buggy** at map corners.
- Enter/exit with `E` when nearby. Drive with WASD. Destroyed vehicle ejects occupant.
- Occupants move with the vehicle; zone damage still applies.

## Bots

Three difficulties (easy / medium / hard): aim error, reaction, fire interval, strafe, preferred range.
Goals: combat → zone → loot → roam. Auto-pickup on walk-over. Permadeath + placement.

## Win / XP

Last alive wins. Match hard-ends by **25 minutes**; remaining players tie-break by kills/damage.
XP from placement + kills + damage → level (local stats; online also leaderboard write).

## HUD cues

Alive count, health/armor, ammo, match timer, zone timer, kill feed, hit markers,
damage numbers, compass pings, interaction prompts.
