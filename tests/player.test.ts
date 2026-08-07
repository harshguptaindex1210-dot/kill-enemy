import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPlayer } from '../src/player';

describe('player', () => {
  it('creates player at default position', () => {
    const p = createPlayer();
    expect(p.position.x).toBe(0);
    expect(p.position.y).toBe(0.9);
    expect(p.position.z).toBe(0);
    expect(p.health).toBe(100);
    expect(p.state).toBe('stand');
    expect(p.cameraMode).toBe('tps');
  });

  it('creates player at custom position', () => {
    const p = createPlayer(new THREE.Vector3(10, 5, -10));
    expect(p.position.x).toBe(10);
    expect(p.position.y).toBe(5);
    expect(p.position.z).toBe(-10);
  });

  it('moves forward with WASD input', () => {
    const p = createPlayer();
    const dt = 1 / 60;
    p.update(
      {
        forward: true,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.position.z).toBeLessThan(0);
  });

  it('applies gravity when not on ground', () => {
    const p = createPlayer(new THREE.Vector3(0, 10, 0));
    const dt = 1 / 60;
    const vyBefore = p.velocity.y;
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.velocity.y).toBeLessThan(vyBefore);
  });

  it('jumps when pressing space on ground', () => {
    const p = createPlayer();
    const dt = 1 / 60;
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: true,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.velocity.y).toBeGreaterThan(0);
    expect(p.state).toBe('jump');
  });

  it('stops at ground level', () => {
    const p = createPlayer(new THREE.Vector3(0, 10, 0));
    for (let i = 0; i < 200; i++) {
      p.update(
        {
          forward: false,
          backward: false,
          left: false,
          right: false,
          sprint: false,
          crouch: false,
          jump: false,
          aim: false,
          fire: false,
          reload: false,
          weapon1: false,
          weapon2: false,
          weapon3: false,
          mouseX: 0,
          mouseY: 0,
        },
        1 / 60,
        0
      );
    }
    expect(p.position.y).toBeCloseTo(0.9, 0);
    expect(p.state).toBe('stand');
  });

  it('sprints when shift is held', () => {
    const p = createPlayer();
    const dt = 1 / 60;
    p.update(
      {
        forward: true,
        backward: false,
        left: false,
        right: false,
        sprint: true,
        crouch: false,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.state).toBe('sprint');
  });

  it('toggles FPS when aiming', () => {
    const p = createPlayer();
    const dt = 1 / 60;
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false,
        aim: true,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.cameraMode).toBe('fps');
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.cameraMode).toBe('tps');
  });

  it('positive mouseX increases yaw (look right)', () => {
    const p = createPlayer();
    const dt = 1 / 60;
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 100,
        mouseY: 0,
      },
      dt,
      0
    );
    expect(p.yaw).toBeGreaterThan(0);
  });

  it('eye height changes with crouch', () => {
    const p = createPlayer();
    const eyeStand = p.getEyeHeight();
    const dt = 1 / 60;
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: true,
        jump: false,
        aim: false,
        fire: false,
        reload: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        mouseX: 0,
        mouseY: 0,
      },
      dt,
      0
    );
    const eyeCrouch = p.getEyeHeight();
    expect(eyeCrouch).toBeLessThan(eyeStand);
  });
});
