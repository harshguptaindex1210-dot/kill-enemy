import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPlayer } from '../src/player';

/** Mirrors src/input.ts joystick thresholds (right = +normX). */
export function joystickNormToMoveFlags(
  normX: number,
  normY: number,
  deadzone = 0.25
): { forward: boolean; backward: boolean; left: boolean; right: boolean } {
  return {
    forward: normY < -deadzone,
    backward: normY > deadzone,
    left: normX < -deadzone,
    right: normX > deadzone,
  };
}

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

describe('joystickNormToMoveFlags', () => {
  it('positive normX is right, negative is left', () => {
    expect(joystickNormToMoveFlags(0.8, 0).right).toBe(true);
    expect(joystickNormToMoveFlags(0.8, 0).left).toBe(false);
    expect(joystickNormToMoveFlags(-0.8, 0).left).toBe(true);
    expect(joystickNormToMoveFlags(-0.8, 0).right).toBe(false);
  });

  it('negative normY is forward', () => {
    expect(joystickNormToMoveFlags(0, -0.8).forward).toBe(true);
    expect(joystickNormToMoveFlags(0, 0.8).backward).toBe(true);
  });

  it('deadzone ignores small deflections', () => {
    expect(joystickNormToMoveFlags(0.1, 0).left).toBe(false);
    expect(joystickNormToMoveFlags(0.1, 0).right).toBe(false);
  });

  it('input.ts keeps right = +normX thresholds', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/touchLeft\s*=\s*normX\s*<\s*-0\.25/);
    expect(src).toMatch(/touchRight\s*=\s*normX\s*>\s*0\.25/);
  });
});

describe('joystick → player strafe sign', () => {
  it('stick right moves toward +X at yaw 0', () => {
    const flags = joystickNormToMoveFlags(0.9, 0);
    const p = createPlayer();
    p.update({ ...idle, ...flags }, 1 / 60, 0);
    expect(p.position.x).toBeGreaterThan(0);
  });

  it('stick left moves toward -X at yaw 0', () => {
    const flags = joystickNormToMoveFlags(-0.9, 0);
    const p = createPlayer();
    p.update({ ...idle, ...flags }, 1 / 60, 0);
    expect(p.position.x).toBeLessThan(0);
  });
});
