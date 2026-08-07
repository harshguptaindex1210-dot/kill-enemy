import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  applyTargetDamage,
  createShootingTargets,
  targetsForHitscan,
  updateTargetRespawns,
  DEFAULT_TARGET_SPAWNS,
  TARGET_MAX_HEALTH,
} from '../src/targets';
import { MatchSim } from '../src/gameplay';
import { createWeapon, fireWeapon } from '../src/weapons';

describe('shooting targets', () => {
  it('spawns eight default practice boards', () => {
    const targets = createShootingTargets();
    expect(targets).toHaveLength(DEFAULT_TARGET_SPAWNS.length);
    expect(targets[0].id).toBe('target_1');
    expect(targets.every((t) => t.alive && t.health === TARGET_MAX_HEALTH)).toBe(true);
  });

  it('takes damage and respawns after knockdown', () => {
    const [target] = createShootingTargets([{ x: 0, z: 10, yaw: Math.PI }]);
    const hit = applyTargetDamage(target, 30, 1000);
    expect(hit.damage).toBe(30);
    expect(hit.destroyed).toBe(false);
    expect(target.health).toBe(TARGET_MAX_HEALTH - 30);

    const finisher = applyTargetDamage(target, 30, 1100);
    expect(finisher.destroyed).toBe(true);
    expect(target.alive).toBe(false);

    updateTargetRespawns([target], target.respawnAt);
    expect(target.alive).toBe(true);
    expect(target.health).toBe(TARGET_MAX_HEALTH);
  });

  it('registers target hits in MatchSim without affecting bot kills', () => {
    const sim = new MatchSim({ seed: 42, botCount: 1, time: 0 });
    expect(sim.targets.length).toBeGreaterThanOrEqual(5);
    const target = sim.targets[0];
    sim.hitTarget('player', target.id, 25);
    expect(sim.getTargetHits('player')).toBe(1);
    expect(sim.match.players.player.kills).toBe(0);
    expect(sim.events.some((e) => e.type === 'target-hit')).toBe(true);
  });

  it('hitscan can strike a practice board', () => {
    const targets = createShootingTargets([{ x: 0, z: -12, yaw: 0 }]);
    const weapon = createWeapon('rifle');
    const origin = new THREE.Vector3(0, 1.1, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    const results = fireWeapon(weapon, origin, dir, targetsForHitscan(targets), 1000);
    expect(results[0]?.hit).toBe(true);
    expect(results[0]?.entityId).toBe('target_1');
  });
});
