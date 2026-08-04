import * as THREE from 'three';

export type MeleeType = 'bat' | 'knife' | 'pan';

export interface MeleeDef {
  type: MeleeType;
  damage: number;
  range: number;
  swingTime: number;
  cooldown: number;
  color: number;
  size: [number, number, number];
}

export const MELEE_DEFS: Record<MeleeType, MeleeDef> = {
  bat: {
    type: 'bat',
    damage: 40,
    range: 3,
    swingTime: 0.4,
    cooldown: 0.8,
    color: 0x8b4513,
    size: [0.08, 0.7, 0.08],
  },
  knife: {
    type: 'knife',
    damage: 15,
    range: 1.5,
    swingTime: 0.15,
    cooldown: 0.3,
    color: 0xcccccc,
    size: [0.04, 0.3, 0.04],
  },
  pan: {
    type: 'pan',
    damage: 25,
    range: 2,
    swingTime: 0.3,
    cooldown: 0.5,
    color: 0x555555,
    size: [0.3, 0.04, 0.25],
  },
};

export interface MeleeState {
  def: MeleeDef;
  mesh: THREE.Mesh;
  swinging: boolean;
  swingStart: number;
  lastHit: number;
  swingAngle: number;
}

export function createMeleeWeapon(type: MeleeType): MeleeState {
  const def = MELEE_DEFS[type];
  let mesh: THREE.Mesh;

  if (type === 'pan') {
    const geo = new THREE.CylinderGeometry(def.size[0], def.size[0], def.size[1], 8);
    mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.6, roughness: 0.3 })
    );
  } else {
    const geo = new THREE.CylinderGeometry(def.size[0], def.size[2], def.size[1], 6);
    mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
    );
  }

  return { def, mesh, swinging: false, swingStart: 0, lastHit: 0, swingAngle: 0 };
}

export function startMeleeSwing(melee: MeleeState, time: number): boolean {
  if (melee.swinging) return false;
  if (time - melee.lastHit < melee.def.cooldown * 1000) return false;

  melee.swinging = true;
  melee.swingStart = time;
  melee.swingAngle = 0;
  return true;
}

export function updateMeleeSwing(melee: MeleeState, time: number): 'swinging' | 'hit' | 'idle' {
  if (!melee.swinging) return 'idle';

  const elapsed = time - melee.swingStart;
  const progress = Math.min(elapsed / (melee.def.swingTime * 1000), 1);
  melee.swingAngle = progress * Math.PI;

  if (progress >= 1) {
    melee.swinging = false;
    melee.lastHit = time;
    return 'hit';
  }

  return 'swinging';
}

export interface MeleeHitTarget {
  id: string;
  position: THREE.Vector3;
  capsuleRadius: number;
  capsuleHeight: number;
}

export function checkMeleeHit(
  melee: MeleeState,
  attackerPos: THREE.Vector3,
  attackerYaw: number,
  targets: MeleeHitTarget[]
): { hit: boolean; targetId?: string; damage: number } {
  const safeTargets = targets ?? [];
  const forward = new THREE.Vector3(-Math.sin(attackerYaw), 0, -Math.cos(attackerYaw));
  const origin = attackerPos.clone();
  origin.y += 0.9;

  for (const t of safeTargets) {
    const toTarget = t.position.clone().sub(origin);
    const dist = toTarget.length();
    if (dist > melee.def.range) continue;

    const angle = forward.angleTo(toTarget.clone().normalize());
    // Increased angle threshold to allow wider melee swing (about 90 degrees)
    if (angle > Math.PI / 2) continue;

    return { hit: true, targetId: t.id, damage: melee.def.damage };
  }

  return { hit: false, damage: 0 };
}

export function attachWeaponToRobot(weapon: MeleeState, robotGroup: THREE.Group) {
  weapon.mesh.position.set(0.6, 0.9, 0);
  weapon.mesh.rotation.x = Math.PI / 2;
  robotGroup.add(weapon.mesh);
}
