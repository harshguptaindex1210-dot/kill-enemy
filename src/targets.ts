import * as THREE from 'three';
import { POI_RADIUS } from './constants';

export const TARGET_MAX_HEALTH = 50;
export const TARGET_RESPAWN_MS = 12000;
export const TARGET_CAPSULE_HEIGHT = 1.6;
export const TARGET_CAPSULE_RADIUS = 0.65;
const BOARD_Y = 1.1;

export interface ShootingTarget {
  id: string;
  position: THREE.Vector3;
  yaw: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  lastHitTime: number;
  respawnAt: number;
}

export const DEFAULT_TARGET_SPAWNS = [
  { x: 38, z: 12, yaw: Math.PI * 0.75 },
  { x: 12, z: 38, yaw: Math.PI * 1.25 },
  { x: -38, z: -12, yaw: -Math.PI * 0.25 },
  { x: -12, z: -38, yaw: -Math.PI * 0.75 },
  { x: 18, z: 0, yaw: Math.PI },
  { x: -18, z: 0, yaw: 0 },
  { x: 0, z: 72, yaw: Math.PI },
  { x: POI_RADIUS + 14, z: 0, yaw: -Math.PI / 2 },
] as const;

export function createShootingTargets(
  spawns: readonly { x: number; z: number; yaw: number }[] = DEFAULT_TARGET_SPAWNS
): ShootingTarget[] {
  return spawns.map((s, i) => ({
    id: `target_${i + 1}`,
    position: new THREE.Vector3(s.x, BOARD_Y, s.z),
    yaw: s.yaw,
    health: TARGET_MAX_HEALTH,
    maxHealth: TARGET_MAX_HEALTH,
    alive: true,
    lastHitTime: -100000,
    respawnAt: 0,
  }));
}

export function targetsForHitscan(targets: ShootingTarget[]) {
  return targets
    .filter((t) => t.alive)
    .map((t) => ({
      id: t.id,
      position: t.position,
      capsuleHeight: TARGET_CAPSULE_HEIGHT,
      capsuleRadius: TARGET_CAPSULE_RADIUS,
    }));
}

export function updateTargetRespawns(targets: ShootingTarget[], time: number) {
  for (const t of targets) {
    if (t.alive || time < t.respawnAt) continue;
    t.health = t.maxHealth;
    t.alive = true;
    t.lastHitTime = -100000;
    t.respawnAt = 0;
  }
}

export function applyTargetDamage(target: ShootingTarget, rawDamage: number, time: number) {
  if (!target.alive || rawDamage <= 0) return { destroyed: false, damage: 0 };
  const damage = Math.round(rawDamage);
  target.health = Math.max(0, target.health - damage);
  target.lastHitTime = time;
  if (target.health <= 0) {
    target.alive = false;
    target.respawnAt = time + TARGET_RESPAWN_MS;
    return { destroyed: true, damage };
  }
  return { destroyed: false, damage };
}
