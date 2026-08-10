import * as THREE from 'three';

export interface GlooWall {
  id: number;
  ownerId: string;
  x: number;
  z: number;
  yaw: number;
  until: number;
}

export interface GlooWallSystem {
  walls: GlooWall[];
  nextId: number;
}

export const GLOO_WALL_WIDTH = 2.4;
export const GLOO_WALL_DEPTH = 0.14;
export const GLOO_WALL_HEIGHT = 1.55;
export const GLOO_WALL_PLACE_DIST = 1.75;
export const GLOO_WALL_TTL_MS = 45_000;

/** Place a Free Fire-style cover panel in front of the unit. */
export function deployGlooWall(
  system: GlooWallSystem,
  ownerId: string,
  pos: THREE.Vector3,
  yaw: number,
  now: number,
  mapBound: number
): GlooWall | null {
  const x = pos.x - Math.sin(yaw) * GLOO_WALL_PLACE_DIST;
  const z = pos.z - Math.cos(yaw) * GLOO_WALL_PLACE_DIST;
  if (Math.abs(x) > mapBound - 1 || Math.abs(z) > mapBound - 1) return null;
  const wall: GlooWall = {
    id: system.nextId++,
    ownerId,
    x,
    z,
    yaw,
    until: now + GLOO_WALL_TTL_MS,
  };
  system.walls.push(wall);
  return wall;
}

/** Push a capsule position out of all active walls. */
export function resolveGlooWallCollisions(
  pos: THREE.Vector3,
  walls: GlooWall[],
  radius: number
) {
  for (const wall of walls) {
    pushOutOfWall(pos, wall, radius);
  }
}

function pushOutOfWall(pos: THREE.Vector3, wall: GlooWall, radius: number) {
  const cos = Math.cos(wall.yaw);
  const sin = Math.sin(wall.yaw);
  const ox = pos.x - wall.x;
  const oz = pos.z - wall.z;
  let lx = ox * cos + oz * sin;
  let lz = -ox * sin + oz * cos;
  const hw = GLOO_WALL_WIDTH / 2 + radius;
  const hd = GLOO_WALL_DEPTH / 2 + radius;
  if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) return;
  const px = hw - Math.abs(lx);
  const pz = hd - Math.abs(lz);
  if (px < pz) lx += Math.sign(lx || 1) * px;
  else lz += Math.sign(lz || 1) * pz;
  pos.x = wall.x + lx * cos - lz * sin;
  pos.z = wall.z + lx * sin + lz * cos;
}

/**
 * Returns distance along `dir` to the first gloo wall, or null if none within `maxDist`.
 */
export function raycastGlooWalls(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  walls: GlooWall[]
): number | null {
  let best: number | null = null;
  for (const wall of walls) {
    const hit = rayWallDistance(origin, dir, wall, maxDist);
    if (hit !== null && (best === null || hit < best)) best = hit;
  }
  return best;
}

function rayWallDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  wall: GlooWall,
  maxDist: number
): number | null {
  const cos = Math.cos(wall.yaw);
  const sin = Math.sin(wall.yaw);
  const ox = origin.x - wall.x;
  const oz = origin.z - wall.z;
  const lx = ox * cos + oz * sin;
  const lz = -ox * sin + oz * cos;
  const dx = dir.x * cos + dir.z * sin;
  const dz = -dir.x * sin + dir.z * cos;
  if (Math.abs(dz) < 1e-6) return null;
  const t = -lz / dz;
  if (t < 0 || t > maxDist) return null;
  const hitLx = lx + dx * t;
  if (Math.abs(hitLx) > GLOO_WALL_WIDTH / 2) return null;
  const hitY = origin.y + dir.y * t;
  if (hitY < 0 || hitY > GLOO_WALL_HEIGHT) return null;
  return t;
}
