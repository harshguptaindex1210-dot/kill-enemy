import type { StorageLike } from './settings';
import { isFounderOwnerProfile, isReservedFounderOwner, type PlayerProfile } from './profile';

const FOUNDER_TRUST_KEY = 'raf_founder_trust';

function token(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 64) : '';
}

function pinHash(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 128) : '';
}

function founderPin(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim();
  if (!/^\d{4,12}$/.test(cleaned)) return '';
  return cleaned;
}

function randomToken(): string {
  return (
    globalThis.crypto?.randomUUID?.()?.replace(/-/g, '') ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  );
}

function fallbackPinDigest(pin: string, salt: string): string {
  const source = `${salt}:${pin}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function createPinDigest(pin: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === 'undefined') return fallbackPinDigest(pin, salt);
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function saveFounderTrust(ownerToken: string, founderTrustToken: string, storage: StorageLike): void {
  if (!ownerToken || !founderTrustToken) return;
  try {
    storage.setItem(FOUNDER_TRUST_KEY, `${ownerToken}:${founderTrustToken}`);
  } catch {
    // ignore
  }
}

function readFounderTrust(storage: StorageLike): { ownerToken: string; trustToken: string } | null {
  try {
    const raw = storage.getItem(FOUNDER_TRUST_KEY);
    const value = typeof raw === 'string' ? raw.trim().slice(0, 140) : '';
    if (!value) return null;
    const splitAt = value.indexOf(':');
    if (splitAt <= 0) return null;
    const ownerToken = token(value.slice(0, splitAt));
    const trustToken = token(value.slice(splitAt + 1));
    if (!ownerToken || !trustToken) return null;
    return { ownerToken, trustToken };
  } catch {
    return null;
  }
}

function defaultStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

export function isFounderPinConfigured(profile: PlayerProfile): boolean {
  return !!pinHash(profile.founderPinHash) && !!token(profile.founderPinSalt);
}

export function isFounderVerified(
  profile: PlayerProfile,
  storage: StorageLike = defaultStorage()
): boolean {
  if (!isReservedFounderOwner(profile, storage)) return false;
  if (!isFounderPinConfigured(profile)) return false;
  const ownerToken = token(profile.ownerToken);
  const trustToken = token(profile.founderTrustToken);
  const trusted = readFounderTrust(storage);
  return !!trusted && trusted.ownerToken === ownerToken && trusted.trustToken === trustToken;
}

export function founderTrustStatus(
  profile: PlayerProfile,
  storage: StorageLike = defaultStorage()
): 'locked' | 'trusted' | 'unprotected' {
  if (!isReservedFounderOwner(profile, storage)) return 'locked';
  if (!isFounderPinConfigured(profile)) return 'unprotected';
  return isFounderVerified(profile, storage) ? 'trusted' : 'locked';
}

export function lockFounderProfile(
  profile: PlayerProfile,
  storage: StorageLike = defaultStorage()
): PlayerProfile {
  try {
    storage.setItem(FOUNDER_TRUST_KEY, '');
  } catch {
    // ignore
  }
  if (!isFounderPinConfigured(profile)) return { ...profile, founderTrustToken: undefined };
  return { ...profile, founderTrustToken: randomToken() };
}

export async function setFounderPin(
  profile: PlayerProfile,
  pin: string,
  storage: StorageLike = defaultStorage()
): Promise<{ profile: PlayerProfile } | { error: string }> {
  if (!isFounderOwnerProfile(profile, storage)) {
    return { error: 'Founder PIN can only be set from founder profile.' };
  }
  const cleanPin = founderPin(pin);
  if (!cleanPin) return { error: 'PIN must be 4-12 digits.' };
  const ownerToken = token(profile.ownerToken);
  if (!ownerToken) return { error: 'Founder owner token missing.' };
  const salt = randomToken();
  const digest = await createPinDigest(cleanPin, salt);
  const trustToken = randomToken();
  const nextProfile = {
    ...profile,
    founderPinHash: digest,
    founderPinSalt: salt,
    founderTrustToken: trustToken,
  };
  saveFounderTrust(ownerToken, trustToken, storage);
  return { profile: nextProfile };
}

export async function verifyFounderPin(
  profile: PlayerProfile,
  pin: string,
  storage: StorageLike = defaultStorage()
): Promise<{ profile: PlayerProfile } | { error: string }> {
  if (!isFounderOwnerProfile(profile, storage)) {
    return { error: 'PIN required' };
  }
  const cleanPin = founderPin(pin);
  if (!cleanPin) return { error: 'invalid PIN' };
  const hash = pinHash(profile.founderPinHash);
  const salt = token(profile.founderPinSalt);
  if (!hash || !salt) return { error: 'PIN required' };
  const digest = await createPinDigest(cleanPin, salt);
  if (digest !== hash) return { error: 'invalid PIN' };
  const ownerToken = token(profile.ownerToken);
  if (!ownerToken) return { error: 'PIN required' };
  const trustToken = token(profile.founderTrustToken) || randomToken();
  const nextProfile = {
    ...profile,
    founderTrustToken: trustToken,
  };
  saveFounderTrust(ownerToken, trustToken, storage);
  return { profile: nextProfile };
}
