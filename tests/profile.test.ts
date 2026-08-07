import { describe, it, expect } from 'vitest';
import {
  buyGunSkin,
  canBuyGunSkin,
  defaultProfile,
  grantMatchCredits,
  isReservedFounderOwner,
  loadProfile,
  matchCreditsReward,
  mergeProfiles,
  saveProfile,
  sanitizeName,
  syncLevelUnlocks,
  equipGunSkin,
  equipCarSkin,
  buyCarSkin,
  setProfileName,
  RESERVED_FOUNDER_NAME,
  addFriend,
  enforceFounderIdentity,
  removeFriend,
} from '../src/profile';
import {
  founderTrustStatus,
  isFounderVerified,
  lockFounderProfile,
  setFounderPin,
  verifyFounderPin,
} from '../src/founderPin';
import { CAR_SKINS, GUN_SKINS } from '../src/cosmetics';
import { MAX_PLAYER_LEVEL, defaultStats, ensureMaxLevelStats, xpForLevel } from '../src/persistence';
import type { StorageLike } from '../src/settings';

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

describe('profile cosmetics', () => {
  it('sanitizes name to 3–20 safe chars', () => {
    expect(sanitizeName('ab')).toBe('Pilot');
    expect(sanitizeName('Ace Pilot!!')).toBe('Ace Pilot');
    expect(sanitizeName('x'.repeat(20)).length).toBe(20);
    expect(sanitizeName('x'.repeat(24)).length).toBe(20);
  });

  it('grants match credits in 236–893', () => {
    for (let i = 0; i < 40; i++) {
      const n = matchCreditsReward(() => i / 40);
      expect(n).toBeGreaterThanOrEqual(236);
      expect(n).toBeLessThanOrEqual(893);
    }
    const p = grantMatchCredits(defaultProfile(), 500);
    expect(p.credits).toBe(500);
  });

  it('unlocks free skins at level', () => {
    const p = syncLevelUnlocks(defaultProfile(), 3);
    expect(p.ownedGunSkins).toContain('rifle_ember');
  });

  it('blocks shop buy before unlock level', () => {
    const ice = GUN_SKINS.find((s) => s.id === 'rifle_ice')!;
    const p = { ...defaultProfile(), credits: 9999 };
    const check = canBuyGunSkin(p, ice.id, ice.unlockLevel - 1);
    expect(check.ok).toBe(false);
  });

  it('buys shop skin when level and credits ok', () => {
    const ice = GUN_SKINS.find((s) => s.id === 'rifle_ice')!;
    const p = { ...defaultProfile(), credits: ice.price };
    const result = buyGunSkin(p, ice.id, ice.unlockLevel);
    expect('profile' in result).toBe(true);
    if ('profile' in result) {
      expect(result.profile.ownedGunSkins).toContain('rifle_ice');
      expect(result.profile.credits).toBe(0);
    }
  });

  it('equips owned rifle skin', () => {
    let p = syncLevelUnlocks(defaultProfile(), 3);
    p = equipGunSkin(p, 'rifle_ember')!;
    expect(p.equippedRifleSkin).toBe('rifle_ember');
  });

  it('renames profile', () => {
    const result = setProfileName(defaultProfile(), 'Nova');
    expect('profile' in result).toBe(true);
    if ('profile' in result) expect(result.profile.name).toBe('Nova');
  });

  it('persists renamed profile to storage', () => {
    const store = memStorage();
    const result = setProfileName(defaultProfile(), 'Nova Ace');
    expect('profile' in result).toBe(true);
    if ('profile' in result) {
      saveProfile(result.profile, store);
      expect(loadProfile(store).name).toBe('Nova Ace');
    }
  });

  it('reserves founder name for first local owner only', () => {
    const store = memStorage();
    const founderClaim = setProfileName(
      defaultProfile(),
      '  harsh   founderceo_01  ',
      store
    );
    expect('profile' in founderClaim).toBe(true);
    if ('profile' in founderClaim) {
      expect(founderClaim.profile.name).toBe(RESERVED_FOUNDER_NAME);
      expect(isReservedFounderOwner(founderClaim.profile, store)).toBe(true);
      const blocked = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
      expect('error' in blocked).toBe(true);
      if ('error' in blocked) expect(blocked.error).toMatch(/reserved|founder owner/i);
    }
  });

  it('lets founder owner switch away and reclaim reserved name', () => {
    const store = memStorage();
    const founderClaim = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
    expect('profile' in founderClaim).toBe(true);
    if ('profile' in founderClaim) {
      const renamedAway = setProfileName(founderClaim.profile, 'Nova', store);
      expect('profile' in renamedAway).toBe(true);
      if ('profile' in renamedAway) {
        const reclaimed = setProfileName(
          renamedAway.profile,
          ` ${RESERVED_FOUNDER_NAME.toLowerCase()} `,
          store
        );
        expect('profile' in reclaimed).toBe(true);
        if ('profile' in reclaimed) expect(reclaimed.profile.name).toBe(RESERVED_FOUNDER_NAME);
      }
    }
  });

  it('hydrates owner storage key from reserved owner token', () => {
    const store = memStorage();
    const profile = { ...defaultProfile(), name: RESERVED_FOUNDER_NAME, ownerToken: 'owner_abc123' };
    expect(isReservedFounderOwner(profile, store)).toBe(true);
    expect(store.getItem('raf_owner')).toBe('owner_abc123');
  });

  it('canonicalizes founder identity to exact reserved name', () => {
    const store = memStorage();
    store.setItem('raf_owner', 'owner_abc123');
    const normalized = enforceFounderIdentity(
      { ...defaultProfile(), name: 'harsh founderceo_01', ownerToken: 'owner_abc123' },
      store
    );
    expect(normalized.name).toBe(RESERVED_FOUNDER_NAME);
    expect(normalized.ownerToken).toBe('owner_abc123');
  });

  it('does not overwrite foreign founder token conflicts', () => {
    const store = memStorage();
    store.setItem('raf_owner', 'owner_primary');
    const foreign = { ...defaultProfile(), name: RESERVED_FOUNDER_NAME, ownerToken: 'owner_other' };
    const normalized = enforceFounderIdentity(foreign, store);
    expect(normalized).toEqual(foreign);
  });

  it('grants founder owner max-level stats safely', async () => {
    const store = memStorage();
    const founderClaim = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
    expect('profile' in founderClaim).toBe(true);
    if ('profile' in founderClaim) {
      expect(isReservedFounderOwner(founderClaim.profile, store)).toBe(true);
      expect(isFounderVerified(founderClaim.profile, store)).toBe(false);
      const pinSet = await setFounderPin(founderClaim.profile, '1234', store);
      expect('profile' in pinSet).toBe(true);
      if ('profile' in pinSet) expect(isFounderVerified(pinSet.profile, store)).toBe(true);
      const boosted = ensureMaxLevelStats(defaultStats());
      expect(boosted.level).toBe(MAX_PLAYER_LEVEL);
      expect(boosted.xp).toBe(xpForLevel(MAX_PLAYER_LEVEL));
    }
  });

  it('sets founder PIN, verifies PIN, and fails invalid PIN', async () => {
    const store = memStorage();
    const founderClaim = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
    expect('profile' in founderClaim).toBe(true);
    if (!('profile' in founderClaim)) return;
    const pinSet = await setFounderPin(founderClaim.profile, '2468', store);
    expect('profile' in pinSet).toBe(true);
    if (!('profile' in pinSet)) return;
    expect(pinSet.profile.founderPinHash).toBeTruthy();
    expect(pinSet.profile.founderPinHash).not.toBe('2468');
    const locked = lockFounderProfile(pinSet.profile, store);
    expect(isFounderVerified(locked, store)).toBe(false);
    const bad = await verifyFounderPin(locked, '1357', store);
    expect('error' in bad).toBe(true);
    if ('error' in bad) expect(bad.error).toBe('invalid PIN');
    const good = await verifyFounderPin(locked, '2468', store);
    expect('profile' in good).toBe(true);
    if ('profile' in good) {
      expect(isFounderVerified(good.profile, store)).toBe(true);
      expect(founderTrustStatus(good.profile, store)).toBe('trusted');
    }
  });

  it('rejects reserved founder name while PIN lock is active', async () => {
    const store = memStorage();
    const founderClaim = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
    expect('profile' in founderClaim).toBe(true);
    if (!('profile' in founderClaim)) return;
    const pinSet = await setFounderPin(founderClaim.profile, '2468', store);
    expect('profile' in pinSet).toBe(true);
    if (!('profile' in pinSet)) return;
    const renamedAway = setProfileName(pinSet.profile, 'Nova', store);
    expect('profile' in renamedAway).toBe(true);
    if (!('profile' in renamedAway)) return;
    const locked = lockFounderProfile(renamedAway.profile, store);
    const blocked = setProfileName(locked, RESERVED_FOUNDER_NAME, store);
    expect('error' in blocked).toBe(true);
    if ('error' in blocked) expect(blocked.error).toMatch(/PIN required/i);
    const unlocked = await verifyFounderPin(locked, '2468', store);
    expect('profile' in unlocked).toBe(true);
    if (!('profile' in unlocked)) return;
    const reclaim = setProfileName(unlocked.profile, RESERVED_FOUNDER_NAME, store);
    expect('profile' in reclaim).toBe(true);
  });

  it('lock/logout revokes founder-only verification state', async () => {
    const store = memStorage();
    const founderClaim = setProfileName(defaultProfile(), RESERVED_FOUNDER_NAME, store);
    expect('profile' in founderClaim).toBe(true);
    if (!('profile' in founderClaim)) return;
    const pinSet = await setFounderPin(founderClaim.profile, '9999', store);
    expect('profile' in pinSet).toBe(true);
    if (!('profile' in pinSet)) return;
    expect(isFounderVerified(pinSet.profile, store)).toBe(true);
    const locked = lockFounderProfile(pinSet.profile, store);
    expect(isFounderVerified(locked, store)).toBe(false);
  });

  it('keeps founder owner token when merging remote profile', () => {
    const local = {
      ...defaultProfile(),
      name: RESERVED_FOUNDER_NAME,
      ownerToken: 'local_owner_token',
      credits: 25,
    };
    const remote = { ...defaultProfile(), name: RESERVED_FOUNDER_NAME, ownerToken: 'remote_owner_token' };
    const merged = mergeProfiles(local, remote);
    expect(merged.name).toBe(RESERVED_FOUNDER_NAME);
    expect(merged.ownerToken).toBe('remote_owner_token');
  });

  it('keeps 20-char cap when renaming profile', () => {
    const result = setProfileName(defaultProfile(), 'x'.repeat(24));
    expect('profile' in result).toBe(true);
    if ('profile' in result) expect(result.profile.name.length).toBe(20);
  });

  it('unlocks free car skins at level', () => {
    const p = syncLevelUnlocks(defaultProfile(), 3);
    expect(p.ownedCarSkins).toContain('buggy_dune');
  });

  it('equips owned car skin', () => {
    let p = syncLevelUnlocks(defaultProfile(), 3);
    p = equipCarSkin(p, 'buggy_dune')!;
    expect(p.equippedBuggySkin).toBe('buggy_dune');
  });

  it('buys car shop skin when level and credits ok', () => {
    const volt = CAR_SKINS.find((s) => s.id === 'buggy_volt')!;
    const p = { ...defaultProfile(), credits: volt.price };
    const result = buyCarSkin(p, volt.id, volt.unlockLevel);
    expect('profile' in result).toBe(true);
  });

  it('merges local and remote profiles on sign-in', () => {
    const local = { ...defaultProfile(), credits: 100, name: 'LocalAce' };
    const remote = {
      ...defaultProfile(),
      name: 'Pilot',
      credits: 250,
      ownedGunSkins: [...defaultProfile().ownedGunSkins, 'rifle_ember'],
      equippedRifleSkin: 'rifle_ember',
      friends: ['friend_u1'],
    };
    const merged = mergeProfiles(local, remote);
    expect(merged.credits).toBe(250);
    expect(merged.ownedGunSkins).toContain('rifle_ember');
    expect(merged.equippedRifleSkin).toBe('rifle_ember');
    expect(merged.friends).toContain('friend_u1');
    expect(merged.name).toBe('LocalAce');
  });

  it('adds and removes friends by username', () => {
    let p = defaultProfile();
    const added = addFriend(p, 'Nova Ace');
    expect('profile' in added).toBe(true);
    if ('profile' in added) {
      p = added.profile;
      expect(p.friends).toContain('Nova Ace');
    }
    p = removeFriend(p, 'Nova Ace');
    expect(p.friends).not.toContain('Nova Ace');
    const tooShort = addFriend(p, 'ab');
    expect('error' in tooShort).toBe(true);
    const renamed = setProfileName(p, 'LocalAce');
    expect('profile' in renamed).toBe(true);
    if ('profile' in renamed) p = renamed.profile;
    const self = addFriend(p, 'LocalAce');
    expect('error' in self).toBe(true);
  });
});
