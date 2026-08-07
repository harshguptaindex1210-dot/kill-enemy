import { describe, it, expect } from 'vitest';
import {
  defaultSettings,
  sanitizeSettings,
  loadSettings,
  saveSettings,
  type StorageLike,
} from '../src/settings';

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

describe('settings (#33)', () => {
  it('produces sensible defaults', () => {
    const s = defaultSettings();
    expect(s.quality).toBe('medium');
    expect(s.sensitivity).toBe(1);
    expect(s.volume).toBe(0.7);
    expect(s.cameraMode).toBe('tps');
    expect(s.minimapSize).toBe('small');
    expect(s.invertLookHorizontal).toBe(false);
  });

  it('round-trips a valid settings object through storage', () => {
    const store = memStorage();
    saveSettings(
      {
        quality: 'low',
        sensitivity: 1.5,
        volume: 0.4,
        cameraMode: 'fps',
        minimapSize: 'large',
        invertLookHorizontal: true,
      },
      store
    );
    const loaded = loadSettings(store);
    expect(loaded.quality).toBe('low');
    expect(loaded.sensitivity).toBe(1.5);
    expect(loaded.volume).toBe(0.4);
    expect(loaded.cameraMode).toBe('fps');
    expect(loaded.minimapSize).toBe('large');
    expect(loaded.invertLookHorizontal).toBe(true);
  });

  it('returns defaults for empty storage', () => {
    expect(loadSettings(memStorage())).toEqual(defaultSettings());
  });

  it('falls back to defaults for invalid / corrupt values', () => {
    const store = memStorage();
    store.setItem('robot_arena_settings_v1', 'not-json');
    expect(loadSettings(store)).toEqual(defaultSettings());
  });

  it('sanitizes wrong-typed and unrecognized values to defaults', () => {
    const s = sanitizeSettings({
      quality: 'ultra',
      sensitivity: 'fast',
      volume: 'loud',
      cameraMode: 'side',
      minimapSize: 'huge',
    });
    expect(s).toEqual(defaultSettings());
  });

  it('clamps sensitivity and volume to valid ranges', () => {
    const s = sanitizeSettings({
      sensitivity: 10,
      volume: 2,
      quality: 'medium',
      cameraMode: 'tps',
      minimapSize: 'small',
    });
    expect(s.sensitivity).toBe(3);
    expect(s.volume).toBe(1);
  });

  it('returns defaults when storage is unavailable', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSettings(broken)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), broken)).not.toThrow();
  });
});
