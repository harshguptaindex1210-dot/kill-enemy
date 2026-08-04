import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createGrenadeSystem,
  throwGrenade,
  updateGrenades,
  aoeDamageAt,
  clearExplosions,
} from '../src/grenades';

describe('grenade projectiles', () => {
  it('integrates over time with gravity', () => {
    const s = createGrenadeSystem();
    const p = throwGrenade(s, 'p1', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), 10);
    const y0 = p.position.y;
    updateGrenades(s, 0.5, 0);
    expect(p.position.z).toBeLessThan(0);
    expect(p.position.y).toBeLessThan(y0);
  });

  it('bounces once and continues', () => {
    const s = createGrenadeSystem();
    throwGrenade(s, 'p1', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), 10, 10);
    updateGrenades(s, 0.5, 0);
    updateGrenades(s, 0.5, 0);
    const p = s.projectiles[0];
    expect(p.bounces).toBeGreaterThanOrEqual(1);
    expect(p.position.y).toBeGreaterThanOrEqual(0);
  });

  it('explodes when fuse elapses', () => {
    const s = createGrenadeSystem();
    throwGrenade(s, 'p1', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), 0, 0.5);
    const ex = updateGrenades(s, 0.6, 0, 100);
    expect(ex.length).toBe(1);
    expect(s.projectiles.length).toBe(0);
    expect(s.explosions.length).toBe(1);
  });

  it('does not explode before the fuse elapses', () => {
    const s = createGrenadeSystem();
    throwGrenade(s, 'p1', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), 10, 5);
    const ex = updateGrenades(s, 1, 0);
    expect(ex.length).toBe(0);
    expect(s.projectiles.length).toBe(1);
    expect(s.explosions.length).toBe(0);
  });

  it('explodes after max bounces', () => {
    const s = createGrenadeSystem();
    throwGrenade(s, 'p1', new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0), 1, 10);
    const ex = updateGrenades(s, 10, 0);
    expect(s.projectiles.length).toBe(0);
    expect(ex.length).toBe(1);
  });

  it('AoE damage has falloff', () => {
    const e = {
      position: new THREE.Vector3(0, 0, 0),
      ownerId: 'p1',
      radius: 5,
      maxDamage: 100,
      time: 0,
    };
    expect(aoeDamageAt(e, 0)).toBe(100);
    expect(aoeDamageAt(e, 2.5)).toBe(50);
    expect(aoeDamageAt(e, 5)).toBe(0);
    expect(aoeDamageAt(e, 10)).toBe(0);
  });

  it('clears explosion list', () => {
    const s = createGrenadeSystem();
    throwGrenade(s, 'p1', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), 0, 0.1);
    updateGrenades(s, 0.2, 0);
    clearExplosions(s);
    expect(s.explosions.length).toBe(0);
  });
});
