import * as THREE from 'three';
import type { WeaponType } from './weapons';
import type { MeleeType } from './melee';

export type HeldKind = WeaponType | 'melee' | 'none';

export interface HeldWeaponKit {
  group: THREE.Group;
  rifle: THREE.Group;
  pistol: THREE.Group;
  grenade: THREE.Group;
  melee: THREE.Group;
}

/** Large, bright blockout guns so loadout is visible in TPS. */
export function createHeldWeaponKit(
  accents: { rifle?: number; pistol?: number; grenade?: number; melee?: number } | number = {}
): HeldWeaponKit {
  const colors =
    typeof accents === 'number'
      ? { rifle: accents, pistol: 0xff8844, grenade: 0x44ff88, melee: 0xc4a35a }
      : {
          rifle: accents.rifle ?? 0xffcc33,
          pistol: accents.pistol ?? 0xff8844,
          grenade: accents.grenade ?? 0x44ff88,
          melee: accents.melee ?? 0xc4a35a,
        };

  const group = new THREE.Group();
  group.name = 'heldWeapons';

  const rifle = buildRifle(colors.rifle);
  const pistol = buildPistol(colors.pistol);
  const grenade = buildGrenade(colors.grenade);
  const melee = buildMeleeBat(colors.melee);

  for (const g of [rifle, pistol, grenade, melee]) {
    g.visible = false;
    group.add(g);
  }

  group.position.set(0.55, 0.95, 0.05);
  return { group, rifle, pistol, grenade, melee };
}

export function resolveHeldKind(opts: {
  alive: boolean;
  inVehicle: boolean;
  meleeMode: boolean;
  weaponType: WeaponType | null | undefined;
}): HeldKind {
  if (!opts.alive || opts.inVehicle) return 'none';
  if (opts.meleeMode) return 'melee';
  if (!opts.weaponType) return 'none';
  if (
    opts.weaponType === 'rifle' ||
    opts.weaponType === 'pistol' ||
    opts.weaponType === 'grenade'
  ) {
    return opts.weaponType;
  }
  return 'none';
}

export function syncHeldWeaponKit(kit: HeldWeaponKit, kind: HeldKind): void {
  kit.rifle.visible = kind === 'rifle';
  kit.pistol.visible = kind === 'pistol';
  kit.grenade.visible = kind === 'grenade';
  kit.melee.visible = kind === 'melee';
  kit.group.visible = kind !== 'none';
}

export function attachHeldWeaponKit(robot: THREE.Group, kit: HeldWeaponKit): void {
  robot.add(kit.group);
}

function buildRifle(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'held-rifle';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.18, 1.15),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.35,
      emissive: color,
      emissiveIntensity: 0.25,
    })
  );
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.8, roughness: 0.25 })
  );
  barrel.position.z = -0.75;
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.22, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 })
  );
  stock.position.set(0, -0.05, 0.55);
  g.add(body, barrel, stock);
  g.rotation.x = Math.PI / 2;
  return g;
}

function buildPistol(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'held-pistol';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.42),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.5,
      roughness: 0.4,
      emissive: color,
      emissiveIntensity: 0.3,
    })
  );
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.28, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 })
  );
  grip.position.set(0, -0.18, 0.05);
  g.add(body, grip);
  g.rotation.x = Math.PI / 2;
  return g;
}

function buildGrenade(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'held-grenade';
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.4,
      roughness: 0.45,
      emissive: color,
      emissiveIntensity: 0.35,
    })
  );
  const pin = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.12, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffee88, metalness: 0.7, roughness: 0.3 })
  );
  pin.position.y = 0.16;
  g.add(ball, pin);
  return g;
}

function buildMeleeBat(color: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'held-melee';
  const bat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.95, 8),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      emissive: color,
      emissiveIntensity: 0.15,
    })
  );
  bat.rotation.x = Math.PI / 2;
  g.add(bat);
  return g;
}

/** Map melee type to a display tint (kit uses one bat mesh; tint optional). */
export function meleeAccent(type: MeleeType): number {
  if (type === 'knife') return 0xddddff;
  if (type === 'pan') return 0xaaaaaa;
  return 0xc4a35a;
}
