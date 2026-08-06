import { describe, it, expect } from 'vitest';
import { lerpYaw } from '../src/net/interpolation';

describe('lerpYaw', () => {
  it('interpolates across the ±pi seam via the short arc', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    const mid = lerpYaw(a, b, 0.5);
    const linear = a + (b - a) * 0.5;
    expect(Math.abs(mid - linear)).toBeGreaterThan(1);
    expect(Math.abs(mid - a)).toBeCloseTo(0.1, 1);
  });
});
