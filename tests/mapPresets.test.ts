import { describe, it, expect } from 'vitest';
import { MAP_IDS, mapPreset, sanitizeMapId } from '../src/mapPresets';

describe('mapPresets', () => {
  it('defines three playable maps', () => {
    expect(MAP_IDS).toEqual(['meadow', 'city', 'desert']);
    expect(mapPreset('city').label).toBe('Los Santos');
    expect(mapPreset('city').groundKind).toBe('asphalt');
    expect(mapPreset('city').parkedCars).toBe(true);
    expect(mapPreset('meadow').grassMul).toBe(1);
    expect(mapPreset('desert').groundKind).toBe('sand');
  });

  it('sanitizes unknown map ids to meadow', () => {
    expect(sanitizeMapId('city')).toBe('city');
    expect(sanitizeMapId('invalid')).toBe('meadow');
  });
});
