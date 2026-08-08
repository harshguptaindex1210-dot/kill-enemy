/** Playable map environments — visuals only; match rules unchanged. */
export type MapId = 'meadow' | 'city' | 'desert';

export interface MapPreset {
  id: MapId;
  label: string;
  tagline: string;
  skyTop: number;
  skyBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  groundKind: 'dirt' | 'asphalt' | 'sand';
  groundTint: number;
  grassMul: number;
  treeKind: 'forest' | 'palm' | 'sparse';
  roadKind: 'trail' | 'highway';
  poiScale: number;
  urbanPoi: boolean;
  parkedCars: boolean;
}

export const MAP_IDS: MapId[] = ['meadow', 'city', 'desert'];

const PRESETS: Record<MapId, MapPreset> = {
  meadow: {
    id: 'meadow',
    label: 'Meadow Valley',
    tagline: 'BGMI-style hills, grass, and warm haze',
    skyTop: 0x5aa8e8,
    skyBottom: 0xfff0d8,
    fogColor: 0xe8f0f8,
    fogNear: 0.58,
    fogFar: 1.65,
    sunColor: 0xfff4e0,
    sunIntensity: 4.2,
    ambientColor: 0xb0b8c0,
    ambientIntensity: 0.42,
    hemiSky: 0xd0e8ff,
    hemiGround: 0x6a5a40,
    hemiIntensity: 0.52,
    groundKind: 'dirt',
    groundTint: 0xe0ead8,
    grassMul: 1,
    treeKind: 'forest',
    roadKind: 'trail',
    poiScale: 1,
    urbanPoi: false,
    parkedCars: false,
  },
  city: {
    id: 'city',
    label: 'Los Santos',
    tagline: 'GTA V open-world city — asphalt, palms, skyline',
    skyTop: 0x6ab8f0,
    skyBottom: 0xfff8f0,
    fogColor: 0xf0f4f8,
    fogNear: 0.68,
    fogFar: 1.85,
    sunColor: 0xfff8e8,
    sunIntensity: 4.5,
    ambientColor: 0xb8c0c8,
    ambientIntensity: 0.48,
    hemiSky: 0xe0f0ff,
    hemiGround: 0x6a6860,
    hemiIntensity: 0.55,
    groundKind: 'asphalt',
    groundTint: 0xd8dce0,
    grassMul: 0,
    treeKind: 'palm',
    roadKind: 'highway',
    poiScale: 1.28,
    urbanPoi: true,
    parkedCars: true,
  },
  desert: {
    id: 'desert',
    label: 'Miramar Dunes',
    tagline: 'Sandy BR desert with rock cover and heat shimmer',
    skyTop: 0x88b8e8,
    skyBottom: 0xfff0c8,
    fogColor: 0xf8ecd8,
    fogNear: 0.55,
    fogFar: 1.58,
    sunColor: 0xfff0d0,
    sunIntensity: 4.35,
    ambientColor: 0xc0b0a0,
    ambientIntensity: 0.44,
    hemiSky: 0xe8e0d0,
    hemiGround: 0x8a6848,
    hemiIntensity: 0.5,
    groundKind: 'sand',
    groundTint: 0xf0e0c0,
    grassMul: 0.15,
    treeKind: 'sparse',
    roadKind: 'trail',
    poiScale: 1.05,
    urbanPoi: false,
    parkedCars: false,
  },
};

export function mapPreset(id: MapId): MapPreset {
  return PRESETS[id];
}

export function sanitizeMapId(raw: unknown): MapId {
  return raw === 'city' || raw === 'desert' || raw === 'meadow' ? raw : 'meadow';
}
