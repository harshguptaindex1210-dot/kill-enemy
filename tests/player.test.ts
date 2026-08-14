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

  it('does not bunny-hop when jump stays held through landing', () => {
    const p = createPlayer();
    const idle = {
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
    };
    const held = { ...idle, jump: true };
    p.update(held, 1 / 60, 0);
    expect(p.velocity.y).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) p.update(held, 1 / 60, 0);
    expect(p.position.y).toBeCloseTo(0.9, 1);
    expect(p.velocity.y).toBe(0);
    p.update(held, 1 / 60, 0);
    expect(p.velocity.y).toBe(0);
  });

  it('buffers jump for a few ticks after a single press', () => {
    const p = createPlayer();
    const idle = {
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
    };
    p.update({ ...idle, jump: true }, 1 / 60, 0);
    expect(p.velocity.y).toBeGreaterThan(0);
    for (let i = 0; i < 90; i++) p.update(idle, 1 / 60, 0);
    expect(p.state).toBe('stand');
    p.update({ ...idle, jump: true }, 1 / 60, 0);
    p.update(idle, 1 / 60, 0);
    expect(p.velocity.y).toBeGreaterThan(0);
  });

  it('can jump after resetGroundContact following an air state', () => {
    const p = createPlayer(new THREE.Vector3(0, 0.9, 0));
    const idle = {
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
    };
    p.update({ ...idle, jump: true }, 1 / 60, 0);
    expect(p.velocity.y).toBeGreaterThan(0);
    p.resetGroundContact(0);
    p.update({ ...idle, jump: true }, 1 / 60, 0);
    expect(p.velocity.y).toBeGreaterThan(0);
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

  it('positive mouseX decreases yaw (look right)', () => {
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
    expect(p.yaw).toBeLessThan(0);
  });

  it('strafe right at yaw 0 moves toward +X (world right)', () => {
    const p = createPlayer();
    p.update(
      {
        forward: false,
        backward: false,
        left: false,
        right: true,
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
    expect(p.position.x).toBeGreaterThan(0);
    expect(p.position.z).toBeCloseTo(0, 5);
  });

  it('strafe left at yaw 0 moves toward -X (world left)', () => {
    const p = createPlayer();
    p.update(
      {
        forward: false,
        backward: false,
        left: true,
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
    expect(p.position.x).toBeLessThan(0);
    expect(p.position.z).toBeCloseTo(0, 5);
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

  it('does not reach full walk speed in one frame (no GTA snap)', () => {
    const p = createPlayer();
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
      1 / 60,
      0
    );
    const instant = 4.5 / 60;
    expect(Math.abs(p.position.z)).toBeLessThan(instant * 0.85);
  });

  it('aim-down-sights blocks sprint and slows movement', () => {
    const p = createPlayer();
    const walk = createPlayer();
    const input = {
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
    };
    for (let i = 0; i < 90; i++) walk.update(input, 1 / 60, 0);
    for (let i = 0; i < 90; i++) p.update({ ...input, aim: true }, 1 / 60, 0);
    expect(p.cameraMode).toBe('fps');
    expect(Math.abs(p.position.z)).toBeLessThan(Math.abs(walk.position.z) * 0.55);
  });
});
