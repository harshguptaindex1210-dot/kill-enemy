/** Scale touch drag pixels into mouseX/mouseY units (matches legacy 2.2 factor in input.ts). */
export const TOUCH_LOOK_SCALE = 2.2;

/**
 * Map a touch/pointer drag delta to look input.
 * Horizontal: drag right → positive mouseX → yaw increases (turn right).
 * Vertical: drag down → positive mouseY → pitch decreases (look down).
 */
export function touchDragToLookDelta(
  dx: number,
  dy: number,
  scale: number = TOUCH_LOOK_SCALE
): { mouseX: number; mouseY: number } {
  return {
    mouseX: dx * scale,
    mouseY: dy * scale,
  };
}
