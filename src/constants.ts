import * as THREE from 'three';

/** Half-width of the square play area (meters from center). */
export const MAP_BOUND = 200;

/** Full ground plane width/depth in meters. */
export const MAP_SIZE = MAP_BOUND * 2;

/** Distance from map center to each POI cluster. */
export const POI_RADIUS = 125;

export const ZONE_PHASE_RADII = [164, 125, 82, 41, 13] as const;

export const ZONE_PHASE_DPS = [1, 2, 4, 8, 16] as const;

export const ZONE_PHASE_DURATIONS = [200, 150, 120, 90, 60] as const;

export const DEFAULT_POI_POSITIONS: { name: string; position: THREE.Vector3 }[] = [
  { name: 'Town', position: new THREE.Vector3(POI_RADIUS, 0, 0) },
  { name: 'Factory', position: new THREE.Vector3(0, 0, POI_RADIUS) },
  { name: 'Docks', position: new THREE.Vector3(-POI_RADIUS, 0, 0) },
  { name: 'Hilltop', position: new THREE.Vector3(0, 0, -POI_RADIUS) },
];

export const DEFAULT_OBSTACLES = DEFAULT_POI_POSITIONS.map((p) => ({
  x: p.position.x,
  z: p.position.z,
  r: 45,
}));
