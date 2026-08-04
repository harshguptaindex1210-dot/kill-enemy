import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createAirdropSystem,
  updateAirdrops,
  claimAirdrop,
  despawnAirdropsByZone,
} from '../src/airdrop';

describe('airdrops (#34)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns crates on a schedule up to the max', () => {
    const sys = createAirdropSystem(120000, 4);
    const center = new THREE.Vector3(0, 0, 0);
    const a = updateAirdrops(sys, 120000, center, 100);
    expect(a.length).toBe(1);
    expect(sys.airdrops.length).toBe(1);
    expect(sys.airdrops[0].landingTime).toBe(128000);
    const b = updateAirdrops(sys, 240000, center, 100);
    expect(b.length).toBe(1);
    expect(sys.airdrops.length).toBe(2);
  });

  it('caps the number of concurrent crates', () => {
    const sys = createAirdropSystem(1000, 3);
    const center = new THREE.Vector3(0, 0, 0);
    updateAirdrops(sys, 1000, center, 100);
    updateAirdrops(sys, 2000, center, 100);
    updateAirdrops(sys, 3000, center, 100);
    updateAirdrops(sys, 4000, center, 100);
    expect(sys.airdrops.length).toBe(3);
  });

  it('drops crates inside the safe zone', () => {
    const sys = createAirdropSystem(0, 1);
    const center = new THREE.Vector3(500, 0, 500);
    updateAirdrops(sys, 0, center, 100);
    const crate = sys.airdrops[0];
    expect(Math.hypot(crate.position.x - 500, crate.position.z - 500)).toBeLessThanOrEqual(60);
  });

  it('crates carry high-tier loot', () => {
    const sys = createAirdropSystem(0, 1);
    updateAirdrops(sys, 0, new THREE.Vector3(0, 0, 0), 100);
    const loot = sys.airdrops[0].loot;
    expect(loot.some((l) => l.type === 'weapon' && l.subtype === 'rifle')).toBe(true);
    expect(loot.some((l) => l.type === 'armor')).toBe(true);
    expect(loot.some((l) => l.type === 'weapon' && l.subtype === 'grenade')).toBe(true);
  });

  it('claiming a crate returns its loot and marks it claimed', () => {
    const sys = createAirdropSystem(0, 1);
    updateAirdrops(sys, 0, new THREE.Vector3(0, 0, 0), 100);
    const id = sys.airdrops[0].id;
    const loot = claimAirdrop(sys, id);
    expect(loot).not.toBeNull();
    expect(sys.airdrops[0].claimed).toBe(true);
    expect(claimAirdrop(sys, id)).toBeNull();
  });

  it('despawns crates the safe zone passes over', () => {
    const sys = createAirdropSystem(0, 2);
    const center = new THREE.Vector3(0, 0, 0);
    updateAirdrops(sys, 0, center, 300);
    // place both crates far from the center so a small zone eats them
    sys.airdrops.forEach((a) => a.position.set(200, 50, 0));
    const removed = despawnAirdropsByZone(sys, center, 50);
    expect(removed).toBe(2);
    expect(sys.airdrops.every((a) => a.despawned)).toBe(true);
  });

  it('keeps crates inside the safe zone', () => {
    const sys = createAirdropSystem(0, 2);
    const center = new THREE.Vector3(0, 0, 0);
    updateAirdrops(sys, 0, center, 300);
    sys.airdrops.forEach((a) => a.position.set(10, 50, 0));
    const removed = despawnAirdropsByZone(sys, center, 300);
    expect(removed).toBe(0);
    expect(sys.airdrops.every((a) => !a.despawned)).toBe(true);
  });

  it('cannot claim a despawned crate', () => {
    const sys = createAirdropSystem(0, 1);
    updateAirdrops(sys, 0, new THREE.Vector3(0, 0, 0), 100);
    const id = sys.airdrops[0].id;
    sys.airdrops[0].position.set(200, 50, 0);
    despawnAirdropsByZone(sys, new THREE.Vector3(0, 0, 0), 50);
    expect(claimAirdrop(sys, id)).toBeNull();
  });
});
