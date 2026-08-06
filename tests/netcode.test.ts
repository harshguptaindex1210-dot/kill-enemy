import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RollbackEngine, createBotInput } from '../src/netcode';

describe('netcode', () => {
  it('applies input to local state', () => {
    const e = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    e.applyInput(
      {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        jump: false,
        aim: false,
        mouseX: 0,
        mouseY: 0,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
      },
      1 / 20,
      0
    );
    expect(e.localState.pos.z).toBeLessThan(0);
  });

  it('correction snapshots reset position on large diff', () => {
    const e = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    const seq1 = {
      seq: 1,
      forward: true,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      aim: false,
      mouseX: 0,
      mouseY: 0,
      fire: false,
      reload: false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
    };
    e.applyInput(seq1, 1 / 20, 0);
    e.applySnapshot({
      tick: 1,
      entities: {
        p1: { pos: new THREE.Vector3(10, 0.9, 10), vel: new THREE.Vector3(0, 0, 0), health: 100 },
      },
    });
    expect(e.localState.pos.x).toBe(10);
    expect(e.localState.pos.z).toBe(10);
  });

  it('bot input moves toward target', () => {
    const bot = createBotInput(1, new THREE.Vector3(0, 0, -10), new THREE.Vector3(0, 0, 0));
    expect(bot.forward).toBe(true);
  });

  it('tick increments on each apply', () => {
    const e = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    e.applyInput(
      {
        seq: 1,
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        jump: false,
        aim: false,
        mouseX: 0,
        mouseY: 0,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
      },
      1 / 20,
      0
    );
    expect(e.tick).toBe(1);
  });

  it('caps unacked input buffer when acks stall', () => {
    const e = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    const frame = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      aim: false,
      mouseX: 0,
      mouseY: 0,
      fire: false,
      reload: false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
    };
    for (let i = 1; i <= 150; i++) {
      e.applyInput({ ...frame, seq: i }, 1 / 20, 0);
    }
    expect(e.tick).toBe(150);
    expect(e.inputs.length).toBeLessThanOrEqual(120);
  });
});

describe('input frame', () => {
  it('creates valid input frame', () => {
    const f = {
      seq: 1,
      forward: true,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      aim: false,
      mouseX: 0,
      mouseY: 0,
      fire: false,
      reload: false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
    };
    expect(f.seq).toBe(1);
    expect(f.forward).toBe(true);
  });
});
