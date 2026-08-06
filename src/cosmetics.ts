import type { WeaponType } from './weapons';

export type ChassisId = 'blue' | 'crimson' | 'forest' | 'gold';
export type SkinUnlock = 'free' | 'buy';
export type SkillType = 'speed' | 'shield' | 'overcharge';

export interface SkillDef {
  type: SkillType;
  name: string;
  description: string;
  cooldownMs: number;
}

export const SKILL_DEFS: Record<SkillType, SkillDef> = {
  speed: {
    type: 'speed',
    name: 'Speed Boost [F]',
    description: '+40% Speed for 4s',
    cooldownMs: 10000,
  },
  shield: {
    type: 'shield',
    name: 'Armor Shield [F]',
    description: '+30 Armor instantly',
    cooldownMs: 20000,
  },
  overcharge: {
    type: 'overcharge',
    name: 'Overcharge [F]',
    description: '+50% Next Shot Dmg',
    cooldownMs: 15000,
  },
};

export interface ChassisPreset {
  id: ChassisId;
  name: string;
  color: number;
  skill: SkillType;
  unlockLevel: number;
  unlock: SkinUnlock;
  price: number;
}

export interface GunSkin {
  id: string;
  name: string;
  weapon: 'rifle' | 'pistol';
  color: number;
  unlockLevel: number;
  unlock: SkinUnlock;
  price: number;
}

export const CHASSIS_PRESETS: ChassisPreset[] = [
  {
    id: 'blue',
    name: 'Blue Pilot (Speed)',
    color: 0x3366cc,
    skill: 'speed',
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'crimson',
    name: 'Crimson (Overcharge)',
    color: 0xcc3344,
    skill: 'overcharge',
    unlockLevel: 2,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'forest',
    name: 'Forest (Shield)',
    color: 0x2f8f3a,
    skill: 'shield',
    unlockLevel: 4,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'gold',
    name: 'Gold (Speed)',
    color: 0xd4a017,
    skill: 'speed',
    unlockLevel: 5,
    unlock: 'buy',
    price: 450,
  },
];

export const GUN_SKINS: GunSkin[] = [
  {
    id: 'rifle_default',
    name: 'Rifle Stock',
    weapon: 'rifle',
    color: 0xffcc33,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'rifle_ember',
    name: 'Rifle Ember',
    weapon: 'rifle',
    color: 0xff5522,
    unlockLevel: 3,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'rifle_ice',
    name: 'Rifle Ice',
    weapon: 'rifle',
    color: 0x66ddff,
    unlockLevel: 5,
    unlock: 'buy',
    price: 350,
  },
  {
    id: 'rifle_neon',
    name: 'Rifle Neon',
    weapon: 'rifle',
    color: 0xff44cc,
    unlockLevel: 8,
    unlock: 'buy',
    price: 600,
  },
  {
    id: 'pistol_default',
    name: 'Pistol Stock',
    weapon: 'pistol',
    color: 0xff8844,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'pistol_sand',
    name: 'Pistol Sand',
    weapon: 'pistol',
    color: 0xc4a35a,
    unlockLevel: 2,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'pistol_violet',
    name: 'Pistol Violet',
    weapon: 'pistol',
    color: 0xaa66ff,
    unlockLevel: 4,
    unlock: 'buy',
    price: 300,
  },
  {
    id: 'pistol_toxic',
    name: 'Pistol Toxic',
    weapon: 'pistol',
    color: 0x88ff44,
    unlockLevel: 7,
    unlock: 'buy',
    price: 550,
  },
];

export function chassisById(id: string): ChassisPreset | undefined {
  return CHASSIS_PRESETS.find((c) => c.id === id);
}

export function gunSkinById(id: string): GunSkin | undefined {
  return GUN_SKINS.find((s) => s.id === id);
}

export function gunColorFor(weapon: WeaponType, equippedId: string | null): number {
  if (weapon !== 'rifle' && weapon !== 'pistol') return 0xffcc33;
  const skin = equippedId ? gunSkinById(equippedId) : undefined;
  if (skin && skin.weapon === weapon) return skin.color;
  const fallback = GUN_SKINS.find((s) => s.weapon === weapon && s.unlockLevel === 1);
  return fallback?.color ?? 0xffcc33;
}
