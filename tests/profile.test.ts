import { describe, it, expect } from 'vitest';
import {
  buyGunSkin,
  canBuyGunSkin,
  defaultProfile,
  grantMatchCredits,
  matchCreditsReward,
  mergeProfiles,
  sanitizeName,
  syncLevelUnlocks,
  equipGunSkin,
  equipCarSkin,
  buyCarSkin,
  setProfileName,
  addFriend,
  removeFriend,
} from '../src/profile';
import { CAR_SKINS, GUN_SKINS } from '../src/cosmetics';

describe('profile cosmetics', () => {
  it('sanitizes name to 3–16 safe chars', () => {
    expect(sanitizeName('ab')).toBe('Pilot');
    expect(sanitizeName('Ace Pilot!!')).toBe('Ace Pilot');
    expect(sanitizeName('x'.repeat(20)).length).toBe(16);
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
    const p = setProfileName(defaultProfile(), 'Nova');
    expect(p.name).toBe('Nova');
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
    p = setProfileName(p, 'LocalAce');
    const self = addFriend(p, 'LocalAce');
    expect('error' in self).toBe(true);
  });
});
