import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ZoneSystem, ZoneLogic } from '../src/zone';

describe('zone system', () => {
  it('initializes with 5 phases', () => {
    const scene = new THREE.Scene();
    const z = new ZoneSystem(scene);
    expect(z.phases.length).toBe(5);
    expect(z.currentPhase).toBe(0);
  });

  it('damage starts at 1 and scales', () => {
    const scene = new THREE.Scene();
    const z = new ZoneSystem(scene);
    expect(z.getDamagePerSec()).toBe(1);
    z.update(200);
    expect(z.currentPhase).toBeGreaterThanOrEqual(1);
  });

  it('updates ring geometry', () => {
    const scene = new THREE.Scene();
    const z = new ZoneSystem(scene);
    z.update(1);
    expect(z.ring.geometry.attributes.position).toBeDefined();
  });

  it('detects inside zone', () => {
    const scene = new THREE.Scene();
    const z = new ZoneSystem(scene);
    expect(z.isOutsideZone(new THREE.Vector3(0, 0, 0))).toBe(false);
    expect(z.isOutsideZone(new THREE.Vector3(500, 0, 500))).toBe(true);
  });
});

describe('zone shrink + warning', () => {
  it('safe radius shrinks toward the phase target', () => {
    const z = new ZoneLogic();
    const start = z.currentSafeRadius;
    z.update(30);
    expect(z.currentSafeRadius).toBeLessThan(start);
    expect(z.currentSafeRadius).toBeCloseTo(230, 0);
  });

  it('safe radius keeps shrinking across phases', () => {
    const z = new ZoneLogic();
    z.update(200);
    expect(z.currentPhase).toBe(1);
    const r0 = z.currentSafeRadius;
    z.update(30);
    expect(z.currentSafeRadius).toBeLessThan(r0);
    expect(z.currentSafeRadius).toBeCloseTo(175, 0);
  });

  it('zoneIncoming fires once per phase before a shrink', () => {
    const z = new ZoneLogic();
    expect(z.zoneIncoming).toBe(false);
    z.update(195);
    expect(z.zoneIncoming).toBe(true);
    expect(z.consumeZoneIncoming()).toBe(true);
    expect(z.consumeZoneIncoming()).toBe(false);
    z.update(6);
    expect(z.zoneIncoming).toBe(false);
  });

  it('updateFromZone re-shapes the ring mesh', () => {
    const scene = new THREE.Scene();
    const z = new ZoneSystem(scene);
    z.updateFromZone(100);
    const positions = z.ring.geometry.attributes.position as THREE.BufferAttribute;
    const outer = Math.hypot(positions.getX(1), positions.getZ(1));
    expect(outer).toBeCloseTo(100, 0);
  });
});
