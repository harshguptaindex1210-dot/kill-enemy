import { describe, it, expect } from 'vitest';
import { MAP_BOUND, MAP_SIZE, POI_RADIUS, ZONE_PHASE_RADII } from '../src/constants';

describe('map constants (#50)', () => {
  it('keeps the play area within the requested smaller bound', () => {
    expect(MAP_BOUND).toBeLessThanOrEqual(150);
    expect(MAP_BOUND).toBe(120);
    expect(MAP_SIZE).toBe(MAP_BOUND * 2);
  });

  it('scales POIs and zone phases with the map', () => {
    expect(POI_RADIUS).toBeLessThan(MAP_BOUND);
    expect(POI_RADIUS).toBe(54);
    expect(ZONE_PHASE_RADII[0]).toBeLessThanOrEqual(MAP_BOUND);
    expect(ZONE_PHASE_RADII.at(-1)).toBeGreaterThan(0);
  });
});
