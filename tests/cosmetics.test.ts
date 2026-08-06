import { describe, it, expect } from 'vitest';
import { CAR_SKINS, GUN_SKINS, carColorFor, gunColorFor, skinsForKind } from '../src/cosmetics';

describe('skin catalog (#64)', () => {
  it('discriminates gun vs car skins with four per target', () => {
    const guns = skinsForKind('gun') as typeof GUN_SKINS;
    const cars = skinsForKind('car') as typeof CAR_SKINS;
    expect(guns.every((s) => s.kind === 'gun')).toBe(true);
    expect(cars.every((s) => s.kind === 'car')).toBe(true);
    expect(guns.filter((s) => s.weapon === 'rifle').length).toBe(4);
    expect(guns.filter((s) => s.weapon === 'pistol').length).toBe(4);
    expect(cars.filter((s) => s.vehicle === 'sedan').length).toBe(4);
    expect(cars.filter((s) => s.vehicle === 'buggy').length).toBe(4);
  });

  it('maps equipped ids to recolor hex values', () => {
    expect(gunColorFor('rifle', 'rifle_ember')).toBe(0xff5522);
    expect(carColorFor('sedan', 'sedan_ruby')).toBe(0xe63946);
    expect(carColorFor('buggy', null)).toBe(0x80b918);
  });
});
