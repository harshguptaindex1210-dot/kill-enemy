import type { WeaponType } from './weapons';

/** MVP skin families — gun recolors held weapons; car recolors sedan/buggy blockouts. */
export type SkinKind = 'gun' | 'car';
export type CarVehicle = 'sedan' | 'buggy';

export type ChassisId = 'blue' | 'crimson' | 'forest' | 'gold';
export type SkinUnlock = 'free' | 'buy';
export type SkillType = 'speed' | 'shield' | 'overcharge';

export interface SkinDefBase {
  id: string;
  name: string;
  kind: SkinKind;
  unlockLevel: number;
  unlock: SkinUnlock;
  price: number;
}

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

export interface GunSkin extends SkinDefBase {
  kind: 'gun';
  weapon: 'rifle' | 'pistol';
  color: number;
}

export interface CarSkin extends SkinDefBase {
  kind: 'car';
  vehicle: CarVehicle;
  color: number;
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

/** First catalog: four recolor skins per held weapon (rifle, pistol). */
export const GUN_SKINS: GunSkin[] = [
  {
    id: 'rifle_default',
    kind: 'gun',
    name: 'Rifle Stock',
    weapon: 'rifle',
    color: 0xffcc33,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'rifle_ember',
    kind: 'gun',
    name: 'Rifle Ember',
    weapon: 'rifle',
    color: 0xff5522,
    unlockLevel: 3,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'rifle_ice',
    kind: 'gun',
    name: 'Rifle Ice',
    weapon: 'rifle',
    color: 0x66ddff,
    unlockLevel: 5,
    unlock: 'buy',
    price: 350,
  },
  {
    id: 'rifle_neon',
    kind: 'gun',
    name: 'Rifle Neon',
    weapon: 'rifle',
    color: 0xff44cc,
    unlockLevel: 8,
    unlock: 'buy',
    price: 600,
  },
  {
    id: 'pistol_default',
    kind: 'gun',
    name: 'Pistol Stock',
    weapon: 'pistol',
    color: 0xff8844,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'pistol_sand',
    kind: 'gun',
    name: 'Pistol Sand',
    weapon: 'pistol',
    color: 0xc4a35a,
    unlockLevel: 2,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'pistol_violet',
    kind: 'gun',
    name: 'Pistol Violet',
    weapon: 'pistol',
    color: 0xaa66ff,
    unlockLevel: 4,
    unlock: 'buy',
    price: 300,
  },
  {
    id: 'pistol_toxic',
    kind: 'gun',
    name: 'Pistol Toxic',
    weapon: 'pistol',
    color: 0x88ff44,
    unlockLevel: 7,
    unlock: 'buy',
    price: 550,
  },
];

/** First catalog: four recolor skins per driveable car (sedan, buggy). */
export const CAR_SKINS: CarSkin[] = [
  {
    id: 'sedan_default',
    kind: 'car',
    name: 'Sedan Stock',
    vehicle: 'sedan',
    color: 0x457b9d,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'sedan_steel',
    kind: 'car',
    name: 'Sedan Steel',
    vehicle: 'sedan',
    color: 0x8d99ae,
    unlockLevel: 2,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'sedan_ruby',
    kind: 'car',
    name: 'Sedan Ruby',
    vehicle: 'sedan',
    color: 0xe63946,
    unlockLevel: 5,
    unlock: 'buy',
    price: 400,
  },
  {
    id: 'sedan_midnight',
    kind: 'car',
    name: 'Sedan Midnight',
    vehicle: 'sedan',
    color: 0x1d3557,
    unlockLevel: 8,
    unlock: 'buy',
    price: 650,
  },
  {
    id: 'buggy_default',
    kind: 'car',
    name: 'Buggy Stock',
    vehicle: 'buggy',
    color: 0x80b918,
    unlockLevel: 1,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'buggy_dune',
    kind: 'car',
    name: 'Buggy Dune',
    vehicle: 'buggy',
    color: 0xf4a261,
    unlockLevel: 3,
    unlock: 'free',
    price: 0,
  },
  {
    id: 'buggy_volt',
    kind: 'car',
    name: 'Buggy Volt',
    vehicle: 'buggy',
    color: 0x219ebc,
    unlockLevel: 4,
    unlock: 'buy',
    price: 320,
  },
  {
    id: 'buggy_inferno',
    kind: 'car',
    name: 'Buggy Inferno',
    vehicle: 'buggy',
    color: 0xff6b35,
    unlockLevel: 7,
    unlock: 'buy',
    price: 580,
  },
];

export function chassisById(id: string): ChassisPreset | undefined {
  return CHASSIS_PRESETS.find((c) => c.id === id);
}

export function gunSkinById(id: string): GunSkin | undefined {
  return GUN_SKINS.find((s) => s.id === id);
}

export function carSkinById(id: string): CarSkin | undefined {
  return CAR_SKINS.find((s) => s.id === id);
}

export function skinsForKind(kind: SkinKind): (GunSkin | CarSkin)[] {
  return kind === 'gun' ? GUN_SKINS : CAR_SKINS;
}

export function gunColorFor(weapon: WeaponType, equippedId: string | null): number {
  if (weapon !== 'rifle' && weapon !== 'pistol') return 0xffcc33;
  const skin = equippedId ? gunSkinById(equippedId) : undefined;
  if (skin && skin.weapon === weapon) return skin.color;
  const fallback = GUN_SKINS.find((s) => s.weapon === weapon && s.unlockLevel === 1);
  return fallback?.color ?? 0xffcc33;
}

export function carColorFor(vehicle: CarVehicle, equippedId: string | null): number {
  const skin = equippedId ? carSkinById(equippedId) : undefined;
  if (skin && skin.vehicle === vehicle) return skin.color;
  const fallback = CAR_SKINS.find((s) => s.vehicle === vehicle && s.unlockLevel === 1);
  return fallback?.color ?? (vehicle === 'sedan' ? 0x457b9d : 0x80b918);
}
