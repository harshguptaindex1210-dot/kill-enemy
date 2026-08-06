import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHeldWeaponKit, resolveHeldKind, syncHeldWeaponKit } from '../src/heldWeapons';
import { WEAPON_DEFS } from '../src/weapons';

describe('held weapons', () => {
  it('builds distinct rifle pistol grenade melee meshes', () => {
    const kit = createHeldWeaponKit();
    expect(kit.rifle.name).toBe('held-rifle');
    expect(kit.pistol.name).toBe('held-pistol');
    expect(kit.grenade.name).toBe('held-grenade');
    expect(kit.melee.name).toBe('held-melee');
    expect(kit.rifle.children.length).toBeGreaterThan(kit.pistol.children.length - 1);
  });

  it('tints rifle and pistol body materials from accent colors', () => {
    const kit = createHeldWeaponKit({ rifle: 0xff5522, pistol: 0xaa66ff });
    const rifleBody = kit.rifle.children[0] as THREE.Mesh;
    const pistolBody = kit.pistol.children[0] as THREE.Mesh;
    expect((rifleBody.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff5522);
    expect((pistolBody.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xaa66ff);
  });

  it('shows rifle when alive with rifle slot', () => {
    expect(
      resolveHeldKind({ alive: true, inVehicle: false, meleeMode: false, weaponType: 'rifle' })
    ).toBe('rifle');
  });

  it('shows pistol when alive with pistol slot', () => {
    expect(
      resolveHeldKind({ alive: true, inVehicle: false, meleeMode: false, weaponType: 'pistol' })
    ).toBe('pistol');
  });

  it('shows grenade when alive with grenade slot', () => {
    expect(
      resolveHeldKind({ alive: true, inVehicle: false, meleeMode: false, weaponType: 'grenade' })
    ).toBe('grenade');
  });

  it('shows melee when melee mode', () => {
    expect(
      resolveHeldKind({ alive: true, inVehicle: false, meleeMode: true, weaponType: 'rifle' })
    ).toBe('melee');
  });

  it('hides when dead or in vehicle', () => {
    expect(
      resolveHeldKind({ alive: false, inVehicle: false, meleeMode: false, weaponType: 'rifle' })
    ).toBe('none');
    expect(
      resolveHeldKind({ alive: true, inVehicle: true, meleeMode: false, weaponType: 'rifle' })
    ).toBe('none');
  });

  it('hides on null weapon without throwing', () => {
    expect(
      resolveHeldKind({ alive: true, inVehicle: false, meleeMode: false, weaponType: null })
    ).toBe('none');
  });

  it('sync toggles visibility for one kind at a time', () => {
    const kit = createHeldWeaponKit();
    syncHeldWeaponKit(kit, 'pistol');
    expect(kit.pistol.visible).toBe(true);
    expect(kit.rifle.visible).toBe(false);
    expect(kit.group.visible).toBe(true);
    syncHeldWeaponKit(kit, 'none');
    expect(kit.group.visible).toBe(false);
  });

  it('INV-W2: handles undefined or null kit gracefully without throwing', () => {
    expect(() => syncHeldWeaponKit(undefined, 'rifle')).not.toThrow();
    expect(() => syncHeldWeaponKit(null, 'pistol')).not.toThrow();
  });
});

describe('weapon pacing', () => {
  it('rifle fires slowly so armor can last (gap >= 1500ms)', () => {
    expect(WEAPON_DEFS.rifle.fireRate * 1000).toBeGreaterThanOrEqual(1500);
    expect(WEAPON_DEFS.pistol.fireRate * 1000).toBeGreaterThanOrEqual(1700);
    expect(WEAPON_DEFS.rifle.damage).toBeLessThanOrEqual(12);
  });
});
