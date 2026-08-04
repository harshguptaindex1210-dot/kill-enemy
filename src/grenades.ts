import * as THREE from 'three';

export interface GrenadeProjectile {
  id: number;
  ownerId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseRemaining: number;
  bounces: number;
}

export interface Explosion {
  position: THREE.Vector3;
  ownerId: string;
  radius: number;
  maxDamage: number;
  time: number;
}

export interface GrenadeSystem {
  projectiles: GrenadeProjectile[];
  explosions: Explosion[];
  nextId: number;
  bounced: THREE.Vector3[];
}

const GRAVITY = -20;
const BOUNCE_RESTITUTION = 0.4;
const MAX_BOUNCES = 2;
const GRENADE_RADIUS = 0.15;

export function createGrenadeSystem(): GrenadeSystem {
  return { projectiles: [], explosions: [], nextId: 1, bounced: [] };
}

export function throwGrenade(
  system: GrenadeSystem,
  ownerId: string,
  from: THREE.Vector3,
  direction: THREE.Vector3,
  power: number = 20,
  fuseSeconds: number = 2,
  groundY: number = 0
): GrenadeProjectile {
  const velocity = direction.clone().normalize().multiplyScalar(power);
  velocity.y = Math.max(velocity.y, 3);
  const p: GrenadeProjectile = {
    id: system.nextId++,
    ownerId,
    position: from.clone(),
    velocity,
    fuseRemaining: fuseSeconds,
    bounces: 0,
  };
  p.position.y = Math.max(p.position.y, groundY + GRENADE_RADIUS);
  system.projectiles.push(p);
  return p;
}

export function aoeDamageAt(explosion: Explosion, dist: number): number {
  if (dist >= explosion.radius) return 0;
  const falloff = 1 - dist / explosion.radius;
  return Math.round(explosion.maxDamage * falloff);
}

export function updateGrenades(
  system: GrenadeSystem,
  dt: number,
  groundY: number = 0,
  time: number = 0
): Explosion[] {
  const exploded: Explosion[] = [];
  const remaining: GrenadeProjectile[] = [];
  system.bounced.length = 0;

  for (const p of system.projectiles) {
    p.fuseRemaining -= dt;
    if (p.fuseRemaining <= 0) {
      const e = explode(system, p, time);
      exploded.push(e);
      continue;
    }

    p.velocity.y += GRAVITY * dt;
    p.position.addScaledVector(p.velocity, dt);

    if (p.position.y < groundY + GRENADE_RADIUS) {
      if (p.bounces >= MAX_BOUNCES) {
        exploded.push(explode(system, p, time));
        continue;
      }
      p.position.y = groundY + GRENADE_RADIUS;
      p.velocity.y = Math.abs(p.velocity.y) * BOUNCE_RESTITUTION;
      p.bounces++;
      system.bounced.push(p.position.clone());
    }

    remaining.push(p);
  }

  system.projectiles = remaining;
  return exploded;
}

function explode(system: GrenadeSystem, p: GrenadeProjectile, time: number): Explosion {
  const e: Explosion = {
    position: p.position.clone(),
    ownerId: p.ownerId,
    radius: 5,
    maxDamage: 100,
    time,
  };
  system.explosions.push(e);
  return e;
}

export function clearExplosions(system: GrenadeSystem) {
  system.explosions.length = 0;
}
