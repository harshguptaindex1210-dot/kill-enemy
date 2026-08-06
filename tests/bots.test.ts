import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBotBrain,
  decideBotInput,
  pickDifficulty,
  seededRandom,
  BOT_PROFILES,
} from '../src/bots';

function ctx(over: Partial<Parameters<typeof decideBotInput>[0]> = {}) {
  return {
    brain: createBotBrain('medium'),
    pos: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    time: 1000,
    dt: 1 / 60,
    enemy: null,
    loot: null,
    safeCenter: new THREE.Vector3(0, 0, 0),
    safeRadius: 400,
    weaponReady: true,
    needsReload: false,
    ...over,
  };
}

describe('bot AI', () => {
  it('moves toward enemy when in sight', () => {
    const c = ctx({
      enemy: { position: new THREE.Vector3(0, 0, -30) },
    });
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
    expect(input.aim).toBe(true);
  });

  it('chases when player closes in instead of fleeing', () => {
    const c = ctx({
      enemy: { position: new THREE.Vector3(0, 0, -10) },
    });
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
    expect(input.backward).toBe(false);
  });

  it('keeps pushing forward at melee range instead of backing up', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      enemy: { position: new THREE.Vector3(0, 0, -3) },
    });
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
    expect(input.backward).toBe(false);
  });

  it('does not fire before reaction time', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      time: 100,
      enemy: { position: new THREE.Vector3(0, 0, -10) },
    });
    const input = decideBotInput(c);
    expect(input.fire).toBe(false);
  });

  it('fires after reaction when aligned', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      time: 5000,
      enemy: { position: new THREE.Vector3(0, 0, -10) },
    });
    let fired = false;
    for (let i = 0; i < 50; i++) {
      c.time += 50;
      const input = decideBotInput(c);
      if (input.fire) fired = true;
    }
    expect(fired).toBe(true);
  });

  it('seeks zone when outside safe circle', () => {
    const c = ctx({
      pos: new THREE.Vector3(0, 0, 0),
      safeCenter: new THREE.Vector3(100, 0, 100),
      safeRadius: 10,
    });
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
  });

  it('prioritizes zone safety over nearby loot', () => {
    const c = ctx({
      pos: new THREE.Vector3(0, 0, 0),
      safeCenter: new THREE.Vector3(100, 0, 100),
      safeRadius: 10,
      loot: { id: 1, position: new THREE.Vector3(0, 0, -15) },
    });
    decideBotInput(c);
    expect(c.brain.goal).toBe('zone');
  });

  it('switches from loot goal to combat when an enemy appears', () => {
    const c = ctx({
      loot: { id: 1, position: new THREE.Vector3(0, 0, -15) },
    });
    decideBotInput(c);
    expect(c.brain.goal).toBe('loot');
    c.enemy = { position: new THREE.Vector3(0, 0, -20) };
    c.time += 100;
    decideBotInput(c);
    expect(c.brain.goal).toBe('combat');
  });

  it('moves toward loot when nearby', () => {
    const c = ctx({
      loot: { id: 1, position: new THREE.Vector3(0, 0, -15) },
    });
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
  });

  it('requests reload when weapon empty', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      time: 5000,
      enemy: { position: new THREE.Vector3(0, 0, -10) },
      weaponReady: false,
      needsReload: true,
    });
    let reloaded = false;
    for (let i = 0; i < 20; i++) {
      c.time += 50;
      const input = decideBotInput(c);
      if (input.reload) reloaded = true;
    }
    expect(reloaded).toBe(true);
  });

  it('does not strafe when enemy is within preferred range', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      time: 10000,
      enemy: { position: new THREE.Vector3(0, 0, -8) },
    });
    c.time = 10000;
    const input = decideBotInput(c);
    expect(input.forward).toBe(true);
    expect(input.backward).toBe(false);
    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
  });

  it('strafe changes direction over time', () => {
    const c = ctx({
      brain: createBotBrain('hard'),
      time: 10000,
      enemy: { position: new THREE.Vector3(0, 0, -25) },
    });
    c.time = 10000;
    let sawLeft = false;
    let sawRight = false;
    for (let i = 0; i < 200; i++) {
      c.time += 20;
      const input = decideBotInput(c);
      if (input.left) sawLeft = true;
      if (input.right) sawRight = true;
    }
    expect(sawLeft && sawRight).toBe(true);
  });

  it('hard profile is more accurate / faster than easy', () => {
    expect(BOT_PROFILES.hard.aimError).toBeLessThan(BOT_PROFILES.easy.aimError);
    expect(BOT_PROFILES.hard.fireIntervalMs).toBeLessThan(BOT_PROFILES.easy.fireIntervalMs);
    expect(BOT_PROFILES.easy.fireIntervalMs).toBeGreaterThanOrEqual(3000);
    expect(BOT_PROFILES.hard.fireIntervalMs).toBeGreaterThanOrEqual(1600);
  });

  it('pickDifficulty is seeded-deterministic', () => {
    const a = pickDifficulty(42);
    const b = pickDifficulty(42);
    expect(a).toBe(b);
  });

  it('seededRandom is deterministic and in [0,1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});
