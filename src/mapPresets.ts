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
    skyTop: 0x2a4a68,
    skyBottom: 0xe8c090,
    fogColor: 0xd8c0a0,
    fogNear: 0.52,
    fogFar: 1.45,
    sunColor: 0xffe0b8,
    sunIntensity: 3.35,
    ambientColor: 0x706860,
    ambientIntensity: 0.26,
    hemiSky: 0xa8c8e8,
    hemiGround: 0x3a3428,
    hemiIntensity: 0.38,
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
    skyTop: 0x4a90c8,
    skyBottom: 0xf2ece4,
    fogColor: 0xe6e2da,
    fogNear: 0.62,
    fogFar: 1.75,
    sunColor: 0xfff0d0,
    sunIntensity: 3.85,
    ambientColor: 0x9098a0,
    ambientIntensity: 0.32,
    hemiSky: 0xc8dce8,
    hemiGround: 0x4a4840,
    hemiIntensity: 0.42,
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
    skyTop: 0x6a88b0,
    skyBottom: 0xf0c890,
    fogColor: 0xe8d0a8,
    fogNear: 0.48,
    fogFar: 1.38,
    sunColor: 0xffe8c0,
    sunIntensity: 3.55,
    ambientColor: 0x908070,
    ambientIntensity: 0.28,
    hemiSky: 0xc0b8a8,
    hemiGround: 0x6a5038,
    hemiIntensity: 0.36,
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
