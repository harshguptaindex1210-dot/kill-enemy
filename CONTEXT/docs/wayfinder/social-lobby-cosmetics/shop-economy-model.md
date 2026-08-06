# Currency + Shop Economy Model (#70)

Grilling answer for credits, earn rate, storage, and purchase flow.

## Currency unit

- **Name**: Credits (displayed in lobby hero + character panel).
- **Storage**: `PlayerProfile.credits` in `localStorage` (`robot_arena_profile_v1`); mirrored to Nakama `player_profile` storage when signed in (INV-6 idempotency via `createWriteId()` on push).
- **Not** a Nakama wallet counter in MVP — a profile integer field, simpler for offline play.

## Earn rate

| Source | Amount | When |
|--------|--------|------|
| Match completion | **236–893** credits (uniform random) | Every finished local or online match |
| Kills / placement | — | XP only today; credits are flat per match |

Implementation: `matchCreditsReward()` + `grantMatchCredits()` in `afterMatchRewards()` (`main.ts`).

## Shop catalog

Sold from `src/cosmetics.ts`:

- **Gun skins** (`unlock: 'buy'`) — rifle_ice, rifle_neon, pistol_violet, pistol_toxic
- **Car skins** — sedan_ruby, sedan_midnight, buggy_volt, buggy_inferno
- **Chassis** — gold chassis

Free skins unlock at level via `syncLevelUnlocks()` (no purchase).

## Level gate vs early buy

**Level gate always wins.** `canBuyGunSkin` / `canBuyCarSkin` / `canBuyChassis` reject if `level < unlockLevel` before checking credits. UI shows "Lv N" when locked; buy button only appears when level is met and item is `unlock: 'buy'`.

## Purchase flow

1. Player taps **Buy** in lobby (`lobby.ts` → `onBuyGunSkin` / `onBuyCarSkin` / `onBuyChassis`).
2. `main.ts` calls `buy*` with current `stats.level`.
3. On success: atomic `{ credits -= price, owned* += id }` in returned profile; `persistProfile()` saves local + pushes remote.
4. On failure: `{ error: string }` — no partial deduction (pure function, no IO mid-flight).

| Failure | User message |
|---------|--------------|
| Insufficient credits | `Not enough credits` |
| Below level | `Requires level N` |
| Already owned | `Already owned` |
| Not a shop item | `Not a shop skin` / `Not a shop item` |
| Network drop mid-push | Local purchase already saved; remote sync retries on next lobby open (`syncProfileOnline`) |

## Equip flow

Separate from purchase: owned skins equip via `equipGunSkin` / `equipCarSkin` / `equipChassis`. Equipped ids drive `matchCosmetics()` colors in-match.

## Balance ranges (grill)

| Item tier | Price range | Unlock level |
|-----------|-------------|--------------|
| Pistol / buggy budget | 300–320 | 4 |
| Sedan mid | 400 | 5 |
| Rifle / buggy premium | 550–580 | 7 |
| Rifle / sedan top | 600–650 | 8 |
| Gold chassis | 450 | 5 |

Match reward ~236–893 means 1–3 matches per mid-tier skin at average luck.

## Verification

- `npm test -- tests/profile.test.ts tests/cosmetics.test.ts`
- Lobby smoke: `npm run smoke:lobby` (shop grids + credits display)
