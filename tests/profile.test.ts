import { describe, it, expect } from 'vitest';
import {
  buyGunSkin,
  canBuyGunSkin,
  defaultProfile,
  grantMatchCredits,
  matchCreditsReward,
  sanitizeName,
  syncLevelUnlocks,
  equipGunSkin,
  setProfileName,
} from '../src/profile';
import { GUN_SKINS } from '../src/cosmetics';

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
});
