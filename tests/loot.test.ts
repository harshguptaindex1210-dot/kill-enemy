import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateLoot, collectLoot } from '../src/loot';
import { MatchSim } from '../src/gameplay';
import { createWeapon } from '../src/weapons';

describe('loot system', () => {
  it('generates loot at POIs', () => {
    const scene = new THREE.Scene();
    const pois = [
      { name: 'Town', position: new THREE.Vector3(300, 0, 0) },
      { name: 'Factory', position: new THREE.Vector3(0, 0, 300) },
    ];
    const spawns = generateLoot(scene, pois);
    expect(spawns.length).toBeGreaterThanOrEqual(4);
  });

  it('collects loot within range', () => {
    const scene = new THREE.Scene();
    const pois = [{ name: 'Town', position: new THREE.Vector3(0, 0, 0) }];
    const spawns = generateLoot(scene, pois);
    const playerPos = spawns[0].position.clone();
    const loot = collectLoot(spawns, playerPos, 5);
    expect(loot).not.toBeNull();
    expect(spawns[0].collected).toBe(true);
  });

  it('returns null when no loot in range', () => {
    const scene = new THREE.Scene();
    const pois = [{ name: 'Town', position: new THREE.Vector3(0, 0, 0) }];
    const spawns = generateLoot(scene, pois);
    const loot = collectLoot(spawns, new THREE.Vector3(999, 0, 999), 2);
    expect(loot).toBeNull();
  });

  it('drops a weapon pad when inventory is full on pickup', () => {
    const sim = new MatchSim({ seed: 42, botCount: 1, time: 0 });
    const player = sim.units.get('player')!;
    player.weapons = [createWeapon('rifle'), createWeapon('pistol')];
    player.inventory.weapons = ['rifle', 'pistol'];
    player.inventory.weaponIndex = 0;

    const before = sim.loot.length;
    const maxIdBefore = sim.loot.reduce((max, l) => Math.max(max, l.id), 0);
    const spawn = sim.loot.find(
      (s) => s.loot.type === 'weapon' && s.loot.subtype === 'pistol' && !s.collected
    );
    expect(spawn).toBeDefined();
    spawn!.position.copy(player.player.position);

    const picked = sim.tryPickup('player');
    expect(picked).toBe(true);
    expect(sim.loot.length).toBe(before + 1);

    const dropped = sim.loot.find((s) => s.id > maxIdBefore);
    expect(dropped).toBeDefined();
    expect(dropped!.loot.subtype).toBe('rifle');
    expect(dropped!.position.distanceTo(player.player.position)).toBeLessThan(1);
  });
});
