import type { StorageLike } from './settings';
import {
  CAR_SKINS,
  CHASSIS_PRESETS,
  GUN_SKINS,
  carSkinById,
  chassisById,
  gunSkinById,
  type ChassisId,
} from './cosmetics';

/** Character profile — localStorage always; Nakama `player_profile` when signed in. */
export interface PlayerProfile {
  name: string;
  credits: number;
  chassisId: ChassisId;
  ownedChassis: ChassisId[];
  ownedGunSkins: string[];
  ownedCarSkins: string[];
  equippedRifleSkin: string;
  equippedPistolSkin: string;
  equippedSedanSkin: string;
  equippedBuggySkin: string;
  friends: string[];
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
    ownedCarSkins: ['sedan_default', 'buggy_default'],
    equippedRifleSkin: 'rifle_default',
    equippedPistolSkin: 'pistol_default',
    equippedSedanSkin: 'sedan_default',
    equippedBuggySkin: 'buggy_default',
    friends: [],
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
  const ownedCarSkins = Array.isArray(r.ownedCarSkins)
    ? r.ownedCarSkins.filter((id): id is string => typeof id === 'string' && !!carSkinById(id))
    : d.ownedCarSkins;
  const friends = Array.isArray(r.friends)
    ? r.friends
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .slice(0, 50)
    : d.friends;
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
    ownedCarSkins: Array.from(new Set(['sedan_default', 'buggy_default', ...ownedCarSkins])),
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
    equippedSedanSkin:
      typeof r.equippedSedanSkin === 'string' &&
      carSkinById(r.equippedSedanSkin)?.vehicle === 'sedan'
        ? r.equippedSedanSkin
        : d.equippedSedanSkin,
    equippedBuggySkin:
      typeof r.equippedBuggySkin === 'string' &&
      carSkinById(r.equippedBuggySkin)?.vehicle === 'buggy'
        ? r.equippedBuggySkin
        : d.equippedBuggySkin,
    friends,
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
    ownedCarSkins: [...profile.ownedCarSkins],
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
  for (const s of CAR_SKINS) {
    if (s.unlock === 'free' && level >= s.unlockLevel && !next.ownedCarSkins.includes(s.id)) {
      next.ownedCarSkins.push(s.id);
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

export function equipCarSkin(profile: PlayerProfile, skinId: string): PlayerProfile | null {
  const skin = carSkinById(skinId);
  if (!skin || !profile.ownedCarSkins.includes(skinId)) return null;
  if (skin.vehicle === 'sedan') return { ...profile, equippedSedanSkin: skinId };
  return { ...profile, equippedBuggySkin: skinId };
}

/** Merge local + remote on sign-in: union owned lists, max credits, server picks when valid. */
export function mergeProfiles(local: PlayerProfile, remote: PlayerProfile): PlayerProfile {
  const ownedChassis = Array.from(new Set([...local.ownedChassis, ...remote.ownedChassis]));
  const ownedGunSkins = Array.from(new Set([...local.ownedGunSkins, ...remote.ownedGunSkins]));
  const ownedCarSkins = Array.from(new Set([...local.ownedCarSkins, ...remote.ownedCarSkins]));
  const friends = Array.from(new Set([...remote.friends, ...local.friends])).slice(0, 50);
  const pick = <T extends string>(remoteVal: T, localVal: T, owned: T[]) =>
    owned.includes(remoteVal) ? remoteVal : owned.includes(localVal) ? localVal : owned[0]!;
  return sanitizeProfile({
    name: remote.name !== 'Pilot' ? remote.name : local.name,
    credits: Math.max(local.credits, remote.credits),
    chassisId: pick(remote.chassisId, local.chassisId, ownedChassis),
    ownedChassis,
    ownedGunSkins,
    ownedCarSkins,
    equippedRifleSkin: pick(remote.equippedRifleSkin, local.equippedRifleSkin, ownedGunSkins),
    equippedPistolSkin: pick(remote.equippedPistolSkin, local.equippedPistolSkin, ownedGunSkins),
    equippedSedanSkin: pick(remote.equippedSedanSkin, local.equippedSedanSkin, ownedCarSkins),
    equippedBuggySkin: pick(remote.equippedBuggySkin, local.equippedBuggySkin, ownedCarSkins),
    friends,
  });
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

export function canBuyCarSkin(
  profile: PlayerProfile,
  skinId: string,
  level: number
): { ok: true } | { ok: false; reason: string } {
  const skin = carSkinById(skinId);
  if (!skin) return { ok: false, reason: 'Unknown skin' };
  if (skin.unlock !== 'buy') return { ok: false, reason: 'Not a shop skin' };
  if (level < skin.unlockLevel) return { ok: false, reason: `Requires level ${skin.unlockLevel}` };
  if (profile.ownedCarSkins.includes(skinId)) return { ok: false, reason: 'Already owned' };
  if (profile.credits < skin.price) return { ok: false, reason: 'Not enough credits' };
  return { ok: true };
}

export function buyCarSkin(
  profile: PlayerProfile,
  skinId: string,
  level: number
): { profile: PlayerProfile } | { error: string } {
  const check = canBuyCarSkin(profile, skinId, level);
  if (!check.ok) return { error: check.reason };
  const skin = carSkinById(skinId)!;
  return {
    profile: {
      ...profile,
      credits: profile.credits - skin.price,
      ownedCarSkins: [...profile.ownedCarSkins, skinId],
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
