import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWeapon, fireWeapon, reloadWeapon, updateReload, WEAPON_DEFS } from '../src/weapons';
import { createInventory, pickupWeapon, pickupAmmo, switchWeapon } from '../src/inventory';
import { createDamageable } from '../src/damageable';

describe('weapons', () => {
  it('rifle fires hitscan and damages target', () => {
    const w = createWeapon('rifle');
    const target = createDamageable('dummy', new THREE.Vector3(0, 0.9, -10));
    const origin = new THREE.Vector3(0, 0.9, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const results = fireWeapon(
      w,
      origin,
      dir,
      [
        {
          id: target.id,
          position: target.position,
          capsuleHeight: target.capsuleHeight,
          capsuleRadius: target.capsuleRadius,
        },
      ],
      1000
    );
    expect(results.length).toBeGreaterThan(0);
    if (results[0].hit) {
      target.takeDamage(results[0].damage);
    }
    expect(target.health).toBeLessThan(100);
  });

  it('reduces ammo on fire', () => {
    const w = createWeapon('pistol');
    const origin = new THREE.Vector3(0, 1.6, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    fireWeapon(w, origin, dir, [], 1000);
    expect(w.ammo).toBe(WEAPON_DEFS.pistol.magSize - 1);
  });

  it('reloads weapon after trigger', () => {
    const w = createWeapon('rifle');
    w.ammo = 0;
    expect(reloadWeapon(w, 1000)).toBe(true);
    expect(w.reloading).toBe(true);
    updateReload(w, 1000 + WEAPON_DEFS.rifle.reloadTime * 1000 + 10);
    expect(w.reloading).toBe(false);
    expect(w.ammo).toBe(WEAPON_DEFS.rifle.magSize);
  });

  it('grenade projectile causes AoE damage', () => {
    const w = createWeapon('grenade');
    w.ammo = 1;
    const target1 = createDamageable('t1', new THREE.Vector3(0, 0.9, -10));
    const target2 = createDamageable('t2', new THREE.Vector3(2, 0.9, -9));
    const origin = new THREE.Vector3(0, 0.9, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const results = fireWeapon(
      w,
      origin,
      dir,
      [
        { id: target1.id, position: target1.position, capsuleHeight: 1.8, capsuleRadius: 0.4 },
        { id: target2.id, position: target2.position, capsuleHeight: 1.8, capsuleRadius: 0.4 },
      ],
      1000
    );
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('respects fire rate', () => {
    const w = createWeapon('rifle');
    const target = createDamageable('dummy', new THREE.Vector3(0, 0.9, -10));
    const origin = new THREE.Vector3(0, 0.9, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const tdata = [
      {
        id: target.id,
        position: target.position,
        capsuleHeight: target.capsuleHeight,
        capsuleRadius: target.capsuleRadius,
      },
    ];
    const gap = WEAPON_DEFS.rifle.fireRate * 1000;

    const r1 = fireWeapon(w, origin, dir, tdata, 0);
    expect(r1.length).toBe(1);

    const r2 = fireWeapon(w, origin, dir, tdata, gap * 0.5);
    expect(r2.length).toBe(0);

    const r3 = fireWeapon(w, origin, dir, tdata, gap + 10);
    expect(r3.length).toBe(1);
  });

  it('classifies level shots as body hits, not headshots', () => {
    const w = createWeapon('rifle');
    const target = createDamageable('dummy', new THREE.Vector3(0, 0.9, -10));
    const origin = new THREE.Vector3(0, 0.9, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const results = fireWeapon(
      w,
      origin,
      dir,
      [
        {
          id: target.id,
          position: target.position,
          capsuleHeight: target.capsuleHeight,
          capsuleRadius: target.capsuleRadius,
        },
      ],
      1000
    );
    expect(results[0]?.hitZone).toBe('body');
  });

  it('classifies upward-aimed shots as head hits', () => {
    const w = createWeapon('rifle');
    w.def = { ...w.def, spread: 0 };
    const target = createDamageable('dummy', new THREE.Vector3(0, 0.9, -5));
    const origin = new THREE.Vector3(0, 1.5, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const results = fireWeapon(
      w,
      origin,
      dir,
      [
        {
          id: target.id,
          position: target.position,
          capsuleHeight: target.capsuleHeight,
          capsuleRadius: target.capsuleRadius,
        },
      ],
      1000
    );
    expect(results[0]?.hitZone).toBe('head');
  });
});

describe('damageable', () => {
  it('takes damage and dies at 0 hp', () => {
    const d = createDamageable('test', new THREE.Vector3(0, 0.9, 0), 100);
    d.takeDamage(50);
    expect(d.health).toBe(50);
    expect(d.alive).toBe(true);
    d.takeDamage(60);
    expect(d.health).toBe(0);
    expect(d.alive).toBe(false);
  });

  it('respawns with full health', () => {
    const d = createDamageable('test', new THREE.Vector3(0, 0.9, 0), 100);
    d.takeDamage(100);
    expect(d.alive).toBe(false);
    d.respawn(new THREE.Vector3(10, 0.9, 10));
    expect(d.alive).toBe(true);
    expect(d.health).toBe(100);
    expect(d.position.x).toBe(10);
  });
});

describe('inventory', () => {
  it('pickups weapons into empty slots', () => {
    const inv = createInventory();
    expect(pickupWeapon(inv, 'rifle')).toBe(true);
    expect(inv.weapons[0]).toBe('rifle');
    expect(pickupWeapon(inv, 'pistol')).toBe(true);
    expect(inv.weapons[1]).toBe('pistol');
    expect(pickupWeapon(inv, 'grenade')).toBe(false);
  });

  it('switch weapon changes index', () => {
    const inv = createInventory();
    pickupWeapon(inv, 'rifle');
    pickupWeapon(inv, 'pistol');
    switchWeapon(inv, 1);
    expect(inv.weaponIndex).toBe(1);
  });

  it('pickup ammo adds to pool', () => {
    const inv = createInventory();
    pickupAmmo(inv, 'rifle', 30);
    expect(inv.ammo.rifle).toBe(120);
  });
});
