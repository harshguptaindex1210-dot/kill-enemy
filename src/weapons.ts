import * as THREE from 'three';

export type WeaponType = 'rifle' | 'pistol' | 'grenade';

export interface WeaponDef {
  type: WeaponType;
  damage: number;
  fireRate: number;
  magSize: number;
  reloadTime: number;
  spread: number;
  recoil: number;
  range: number;
  projectileSpeed?: number;
  aoeRadius?: number;
  isProjectile: boolean;
}

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  rifle: {
    type: 'rifle',
    damage: 12,
    fireRate: 2.2,
    magSize: 30,
    reloadTime: 2.4,
    spread: 0.03,
    recoil: 0.05,
    range: 500,
    isProjectile: false,
  },
  pistol: {
    type: 'pistol',
    damage: 10,
    fireRate: 2.5,
    magSize: 15,
    reloadTime: 1.8,
    spread: 0.05,
    recoil: 0.06,
    range: 300,
    isProjectile: false,
  },
  grenade: {
    type: 'grenade',
    damage: 80,
    fireRate: 3.0,
    magSize: 1,
    reloadTime: 3,
    spread: 0.1,
    recoil: 0.1,
    range: 80,
    projectileSpeed: 20,
    aoeRadius: 5,
    isProjectile: true,
  },
};

export interface WeaponState {
  def: WeaponDef;
  ammo: number;
  lastFireTime: number;
  reloading: boolean;
  reloadStart: number;
  recoilAccum: number;
}

export function createWeapon(type: WeaponType): WeaponState {
  const def = WEAPON_DEFS[type];
  return {
    def,
    ammo: def.magSize,
    lastFireTime: -def.fireRate * 1000,
    reloading: false,
    reloadStart: 0,
    recoilAccum: 0,
  };
}

export interface FireResult {
  hit: boolean;
  damage: number;
  position: THREE.Vector3;
  hitZone?: 'head' | 'body' | 'limb';
  entityId?: string;
}

export function fireWeapon(
  weapon: WeaponState,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  targets: { id: string; position: THREE.Vector3; capsuleHeight: number; capsuleRadius: number }[],
  time: number,
  maxRange?: number,
  spreadScale = 1
): FireResult[] {
  const results: FireResult[] = [];

  if (weapon.reloading) return results;
  // Match time is milliseconds; fireRate is seconds between shots.
  if (time - weapon.lastFireTime < weapon.def.fireRate * 1000) return results;
  if (weapon.ammo <= 0) return results;

  weapon.lastFireTime = time;
  weapon.ammo--;
  weapon.recoilAccum += weapon.def.recoil;
  const range = maxRange ?? weapon.def.range;

  if (weapon.def.isProjectile) {
    const end = origin.clone().add(direction.clone().multiplyScalar(range));
    const closest = findClosestHit(origin, end, targets);
    if (closest) {
      const dz = getDamageZone(
        rayHitHeight(origin, direction, closest.position),
        closest.position,
        closest.capsuleHeight
      );
      results.push({
        hit: true,
        damage: dz.mult * weapon.def.damage,
        position: closest.position.clone(),
        hitZone: dz.zone,
        entityId: closest.id,
      });
      if (weapon.def.aoeRadius) {
        for (const t of targets) {
          if (
            t.id !== closest.id &&
            t.position.distanceTo(closest.position) <= weapon.def.aoeRadius!
          ) {
            results.push({
              hit: true,
              damage: weapon.def.damage * 0.5,
              position: t.position.clone(),
              hitZone: 'body',
              entityId: t.id,
            });
          }
        }
      }
    }
    return results;
  }

  const spread = weapon.def.spread * spreadScale;
  const spreadAngle = (Math.random() - 0.5) * spread * 2;
  const spreadDir = direction.clone();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(spreadDir, up);
  if (right.length() < 0.001) right.set(1, 0, 0);
  right.normalize();
  const spreadUp = new THREE.Vector3().crossVectors(right, spreadDir).normalize();
  spreadDir.applyAxisAngle(spreadUp, spreadAngle);
  spreadDir.applyAxisAngle(right, (Math.random() - 0.5) * spread * 2);

  const end = origin.clone().add(spreadDir.clone().multiplyScalar(range));
  const closest = findClosestHit(origin, end, targets);
  if (closest) {
    const dz = getDamageZone(
      rayHitHeight(origin, spreadDir, closest.position),
      closest.position,
      closest.capsuleHeight
    );
    results.push({
      hit: true,
      damage: dz.mult * weapon.def.damage,
      position: closest.position.clone(),
      hitZone: dz.zone,
      entityId: closest.id,
    });
  }

  return results;
}

export function reloadWeapon(weapon: WeaponState, time: number): boolean {
  if (weapon.reloading || weapon.ammo === weapon.def.magSize) return false;
  weapon.reloading = true;
  weapon.reloadStart = time;
  return true;
}

export function updateReload(weapon: WeaponState, timeMs: number) {
  if (!weapon.reloading) return;
  if (timeMs - weapon.reloadStart >= weapon.def.reloadTime * 1000) {
    weapon.ammo = weapon.def.magSize;
    weapon.reloading = false;
    weapon.recoilAccum = 0;
  }
}

function findClosestHit(
  origin: THREE.Vector3,
  end: THREE.Vector3,
  targets: { id: string; position: THREE.Vector3; capsuleHeight: number; capsuleRadius: number }[]
): { id: string; position: THREE.Vector3; capsuleHeight: number; capsuleRadius: number } | null {
  let closest: {
    id: string;
    position: THREE.Vector3;
    capsuleHeight: number;
    capsuleRadius: number;
  } | null = null;
  let closestDist = Infinity;
  const dir = end.clone().sub(origin).normalize();
  const maxDist = origin.distanceTo(end);

  for (const t of targets) {
    const toTarget = t.position.clone().sub(origin);
    const proj = toTarget.dot(dir);
    if (proj < 0 || proj > maxDist) continue;
    const closestPt = origin.clone().add(dir.clone().multiplyScalar(proj));
    // Capsule: horizontal radius + vertical extent (not a sphere around center).
    const dx = closestPt.x - t.position.x;
    const dz = closestPt.z - t.position.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz > t.capsuleRadius) continue;
    const halfH = t.capsuleHeight / 2;
    const dy = closestPt.y - t.position.y;
    if (dy < -halfH - t.capsuleRadius || dy > halfH + t.capsuleRadius) continue;
    if (proj < closestDist) {
      closestDist = proj;
      closest = t;
    }
  }

  return closest;
}

/** Y coordinate where the aim ray crosses the target's horizontal plane. */
function rayHitHeight(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  targetPos: THREE.Vector3
): number {
  const dir = direction.clone().normalize();
  const toTarget = targetPos.clone().sub(origin);
  const along = toTarget.dot(dir);
  if (along <= 0) return origin.y;
  return origin.y + dir.y * along;
}

function getDamageZone(
  hitY: number,
  targetPos: THREE.Vector3,
  height: number
): { zone: 'head' | 'body' | 'limb'; mult: number } {
  const baseY = targetPos.y - height / 2;
  const relY = hitY - baseY;
  const ratio = relY / height;
  if (ratio > 0.75) return { zone: 'head', mult: 2 };
  if (ratio > 0.3) return { zone: 'body', mult: 1 };
  return { zone: 'limb', mult: 0.5 };
}
