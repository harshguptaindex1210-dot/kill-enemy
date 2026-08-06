import type { StorageLike } from './settings';
import { CHASSIS_PRESETS, GUN_SKINS, chassisById, gunSkinById, type ChassisId } from './cosmetics';

export interface PlayerProfile {
  name: string;
  credits: number;
  chassisId: ChassisId;
  ownedChassis: ChassisId[];
  ownedGunSkins: string[];
  equippedRifleSkin: string;
  equippedPistolSkin: string;
}

const PROFILE_KEY = 'robot_arena_profile_v1';
const NAME_MIN = 3;
const NAME_MAX = 16;

export function defaultProfile(): PlayerProfile {
  return {
    name: 'Pilot',
    credits: 0,
    chassisId: 'blue',
    ownedChassis: ['blue'],
    ownedGunSkins: ['rifle_default', 'pistol_default'],
    equippedRifleSkin: 'rifle_default',
    equippedPistolSkin: 'pistol_default',
  };
}

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Pilot';
  const cleaned = raw
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < NAME_MIN) return 'Pilot';
  return cleaned.slice(0, NAME_MAX);
}

export function sanitizeProfile(raw: unknown): PlayerProfile {
  const d = defaultProfile();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const ownedChassis = Array.isArray(r.ownedChassis)
    ? (r.ownedChassis.filter((id) => typeof id === 'string' && chassisById(id)) as ChassisId[])
    : d.ownedChassis;
  const ownedGunSkins = Array.isArray(r.ownedGunSkins)
    ? r.ownedGunSkins.filter((id): id is string => typeof id === 'string' && !!gunSkinById(id))
    : d.ownedGunSkins;
  const chassisId =
    typeof r.chassisId === 'string' && chassisById(r.chassisId)
      ? (r.chassisId as ChassisId)
      : d.chassisId;
  return {
    name: sanitizeName(r.name),
    credits:
      typeof r.credits === 'number' && isFinite(r.credits) ? Math.max(0, Math.floor(r.credits)) : 0,
    chassisId: ownedChassis.includes(chassisId) ? chassisId : 'blue',
    ownedChassis: ownedChassis.length ? Array.from(new Set(['blue', ...ownedChassis])) : ['blue'],
    ownedGunSkins: Array.from(new Set(['rifle_default', 'pistol_default', ...ownedGunSkins])),
    equippedRifleSkin:
      typeof r.equippedRifleSkin === 'string' &&
      gunSkinById(r.equippedRifleSkin)?.weapon === 'rifle'
        ? r.equippedRifleSkin
        : d.equippedRifleSkin,
    equippedPistolSkin:
      typeof r.equippedPistolSkin === 'string' &&
      gunSkinById(r.equippedPistolSkin)?.weapon === 'pistol'
        ? r.equippedPistolSkin
        : d.equippedPistolSkin,
  };
}

export function loadProfile(storage: StorageLike = defaultStorage()): PlayerProfile {
  try {
    const raw = storage.getItem(PROFILE_KEY);
    return sanitizeProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile, storage: StorageLike = defaultStorage()): void {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/** Grant free-at-level cosmetics the player has reached. */
export function syncLevelUnlocks(profile: PlayerProfile, level: number): PlayerProfile {
  const next = {
    ...profile,
    ownedChassis: [...profile.ownedChassis],
    ownedGunSkins: [...profile.ownedGunSkins],
  };
  for (const c of CHASSIS_PRESETS) {
    if (c.unlock === 'free' && level >= c.unlockLevel && !next.ownedChassis.includes(c.id)) {
      next.ownedChassis.push(c.id);
    }
  }
  for (const s of GUN_SKINS) {
    if (s.unlock === 'free' && level >= s.unlockLevel && !next.ownedGunSkins.includes(s.id)) {
      next.ownedGunSkins.push(s.id);
    }
  }
  return next;
}

/** Random credits per finished match (locked grill: 236–893). */
export function matchCreditsReward(rng: () => number = Math.random): number {
  return 236 + Math.floor(rng() * (893 - 236 + 1));
}

export function grantMatchCredits(profile: PlayerProfile, amount: number): PlayerProfile {
  return { ...profile, credits: profile.credits + Math.max(0, Math.floor(amount)) };
}

export function setProfileName(profile: PlayerProfile, name: string): PlayerProfile {
  return { ...profile, name: sanitizeName(name) };
}

export function equipChassis(profile: PlayerProfile, id: ChassisId): PlayerProfile | null {
  if (!profile.ownedChassis.includes(id)) return null;
  return { ...profile, chassisId: id };
}

export function equipGunSkin(profile: PlayerProfile, skinId: string): PlayerProfile | null {
  const skin = gunSkinById(skinId);
  if (!skin || !profile.ownedGunSkins.includes(skinId)) return null;
  if (skin.weapon === 'rifle') return { ...profile, equippedRifleSkin: skinId };
  return { ...profile, equippedPistolSkin: skinId };
}

/** Shop only sells buy-type skins at/above unlock level (level gate always wins). */
export function canBuyGunSkin(
  profile: PlayerProfile,
  skinId: string,
  level: number
): { ok: true } | { ok: false; reason: string } {
  const skin = gunSkinById(skinId);
  if (!skin) return { ok: false, reason: 'Unknown skin' };
  if (skin.unlock !== 'buy') return { ok: false, reason: 'Not a shop skin' };
  if (level < skin.unlockLevel) return { ok: false, reason: `Requires level ${skin.unlockLevel}` };
  if (profile.ownedGunSkins.includes(skinId)) return { ok: false, reason: 'Already owned' };
  if (profile.credits < skin.price) return { ok: false, reason: 'Not enough credits' };
  return { ok: true };
}

export function buyGunSkin(
  profile: PlayerProfile,
  skinId: string,
  level: number
): { profile: PlayerProfile } | { error: string } {
  const check = canBuyGunSkin(profile, skinId, level);
  if (!check.ok) return { error: check.reason };
  const skin = gunSkinById(skinId)!;
  return {
    profile: {
      ...profile,
      credits: profile.credits - skin.price,
      ownedGunSkins: [...profile.ownedGunSkins, skinId],
    },
  };
}

export function canBuyChassis(
  profile: PlayerProfile,
  id: ChassisId,
  level: number
): { ok: true } | { ok: false; reason: string } {
  const c = chassisById(id);
  if (!c) return { ok: false, reason: 'Unknown chassis' };
  if (c.unlock !== 'buy') return { ok: false, reason: 'Not a shop item' };
  if (level < c.unlockLevel) return { ok: false, reason: `Requires level ${c.unlockLevel}` };
  if (profile.ownedChassis.includes(id)) return { ok: false, reason: 'Already owned' };
  if (profile.credits < c.price) return { ok: false, reason: 'Not enough credits' };
  return { ok: true };
}

export function buyChassis(
  profile: PlayerProfile,
  id: ChassisId,
  level: number
): { profile: PlayerProfile } | { error: string } {
  const check = canBuyChassis(profile, id, level);
  if (!check.ok) return { error: check.reason };
  const c = chassisById(id)!;
  return {
    profile: {
      ...profile,
      credits: profile.credits - c.price,
      ownedChassis: [...profile.ownedChassis, id],
    },
  };
}

function defaultStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}
