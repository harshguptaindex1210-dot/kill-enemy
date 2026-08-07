import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPlayer } from '../src/player';
import {
  shouldUseMouseLook,
  touchDragToLookDelta,
  TOUCH_LOOK_SCALE,
  TOUCH_MOUSE_LOOK_LOCKOUT_MS,
} from '../src/touchLook';

const idleInput = {
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

describe('touchDragToLookDelta', () => {
  it('drag right increases mouseX (same sign as desktop movementX)', () => {
    const { mouseX, mouseY } = touchDragToLookDelta(50, 0);
    expect(mouseX).toBe(50 * TOUCH_LOOK_SCALE);
    expect(mouseY).toBe(0);
  });

  it('drag left decreases mouseX', () => {
    const { mouseX } = touchDragToLookDelta(-30, 0);
    expect(mouseX).toBe(-30 * TOUCH_LOOK_SCALE);
  });

  it('drag down increases mouseY (look down via pitch -= mouseY)', () => {
    const { mouseY } = touchDragToLookDelta(0, 20);
    expect(mouseY).toBe(20 * TOUCH_LOOK_SCALE);
  });

  it('respects custom scale', () => {
    const { mouseX } = touchDragToLookDelta(10, 0, 1.5);
    expect(mouseX).toBe(15);
  });

  it('invertHorizontal flips only yaw axis', () => {
    const normal = touchDragToLookDelta(40, 10, TOUCH_LOOK_SCALE, false);
    const inverted = touchDragToLookDelta(40, 10, TOUCH_LOOK_SCALE, true);
    expect(inverted.mouseX).toBe(-normal.mouseX);
    expect(inverted.mouseY).toBe(normal.mouseY);
  });
});

describe('phone look chain (demo online / local MatchSim path)', () => {
  it('swipe right → positive mouseX → yaw decreases (turn right)', () => {
    const look = touchDragToLookDelta(40, 0);
    expect(look.mouseX).toBeGreaterThan(0);

    const p = createPlayer(new THREE.Vector3(0, 0.9, 0));
    const yawBefore = p.yaw;
    p.update({ ...idleInput, mouseX: look.mouseX }, 1 / 60, 0);
    expect(p.yaw).toBeLessThan(yawBefore);
  });

  it('swipe left → negative mouseX → yaw increases (turn left)', () => {
    const look = touchDragToLookDelta(-40, 0);
    expect(look.mouseX).toBeLessThan(0);

    const p = createPlayer(new THREE.Vector3(0, 0.9, 0));
    const yawBefore = p.yaw;
    p.update({ ...idleInput, mouseX: look.mouseX }, 1 / 60, 0);
    expect(p.yaw).toBeGreaterThan(yawBefore);
  });

  it('matches desktop mouse: positive movementX turns right', () => {
    const desktopMouseX = 88; // movementX when mouse moves right
    const touch = touchDragToLookDelta(40, 0);
    expect(Math.sign(touch.mouseX)).toBe(Math.sign(desktopMouseX));

    const fromMouse = createPlayer();
    fromMouse.update({ ...idleInput, mouseX: desktopMouseX }, 1 / 60, 0);
    const fromTouch = createPlayer();
    fromTouch.update({ ...idleInput, mouseX: touch.mouseX }, 1 / 60, 0);
    expect(fromMouse.yaw).toBeLessThan(0);
    expect(fromTouch.yaw).toBeLessThan(0);
  });
});

describe('shouldUseMouseLook', () => {
  it('blocks mouse look while touch look is active', () => {
    expect(shouldUseMouseLook(1000, 900, true)).toBe(false);
  });

  it('blocks mouse look during post-touch lockout window', () => {
    expect(shouldUseMouseLook(1000, 1000 - TOUCH_MOUSE_LOOK_LOCKOUT_MS + 1, false)).toBe(false);
  });

  it('allows mouse look after lockout elapses', () => {
    expect(shouldUseMouseLook(1000, 1000 - TOUCH_MOUSE_LOOK_LOCKOUT_MS - 1, false)).toBe(true);
  });

  it('keeps touch horizontal direction when synthetic mouse arrives in lockout', () => {
    const now = 2000;
    const touch = touchDragToLookDelta(24, 0);
    let mergedMouseX = touch.mouseX;
    if (shouldUseMouseLook(now, now, false)) {
      // Would have been the opposing iOS synthetic delta before lockout existed.
      mergedMouseX += -24 * TOUCH_LOOK_SCALE;
    }
    expect(mergedMouseX).toBe(touch.mouseX);
    expect(mergedMouseX).toBeGreaterThan(0);
  });
});
