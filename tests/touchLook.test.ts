import { describe, it, expect } from 'vitest';
import {
  shouldUseMouseLook,
  touchDragToLookDelta,
  TOUCH_LOOK_SCALE,
  TOUCH_MOUSE_LOOK_LOCKOUT_MS,
} from '../src/touchLook';

describe('touchDragToLookDelta', () => {
  it('drag right increases mouseX (turn right)', () => {
    const { mouseX, mouseY } = touchDragToLookDelta(50, 0);
    expect(mouseX).toBe(50 * TOUCH_LOOK_SCALE);
    expect(mouseY).toBe(0);
  });

  it('drag left decreases mouseX (turn left)', () => {
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
});
