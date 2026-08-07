/** Scale touch drag pixels into mouseX/mouseY units (matches legacy 2.2 factor in input.ts). */
export const TOUCH_LOOK_SCALE = 2.2;
/** Ignore compat/synthetic mouse deltas briefly after touch look activity. */
export const TOUCH_MOUSE_LOOK_LOCKOUT_MS = 180;

/**
 * Map a touch/pointer drag delta to look input.
 * Drag right → positive mouseX → yaw decreases (turn right), matching desktop movementX.
 * `invertHorizontal` flips yaw only; default false is standard FPS mapping.
 */
export function touchDragToLookDelta(
  dx: number,
  dy: number,
  scale: number = TOUCH_LOOK_SCALE,
  invertHorizontal: boolean = false
): { mouseX: number; mouseY: number } {
  const mouseX = dx * scale;
  return {
    mouseX: invertHorizontal ? -mouseX : mouseX,
    mouseY: dy * scale,
  };
}

/**
 * Decide whether a mouse-look delta should be accepted.
 * Blocks mouse look while a touch camera gesture is active and for a short
 * lockout window after touch ends, preventing mixed-direction double input.
 */
export function shouldUseMouseLook(
  nowMs: number,
  lastTouchLookAtMs: number,
  touchLookActive: boolean,
  lockoutMs: number = TOUCH_MOUSE_LOOK_LOCKOUT_MS
): boolean {
  if (touchLookActive) return false;
  return nowMs - lastTouchLookAtMs > lockoutMs;
}
