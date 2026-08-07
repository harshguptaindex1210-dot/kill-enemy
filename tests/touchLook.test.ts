import { describe, it, expect } from 'vitest';
import { touchDragToLookDelta, TOUCH_LOOK_SCALE } from '../src/touchLook';

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
