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
    expect(s.touchSensitivityX).toBe(1);
    expect(s.touchSensitivityY).toBe(1);
    expect(s.volume).toBe(0.7);
    expect(s.cameraMode).toBe('tps');
    expect(s.minimapSize).toBe('small');
    expect(s.invertLookHorizontal).toBe(false);
    expect(s.invertLookVertical).toBe(false);
    expect(s.leftFireButton).toBe(true);
    expect(s.touchSprintMode).toBe('auto');
    expect(s.touchButtonPreset).toBe('standard');
    expect(s.touchLayoutPreset).toBe('thumbs');
    expect(s.hudOpacity).toBe(0.9);
    expect(s.hudScale).toBe(1);
    expect(s.gyroAim).toBe(false);
  });

  it('round-trips a valid settings object through storage', () => {
    const store = memStorage();
    saveSettings(
      {
        quality: 'high',
        sensitivity: 1.5,
        touchSensitivityX: 1.25,
        touchSensitivityY: 0.95,
        volume: 0.4,
        cameraMode: 'fps',
        minimapSize: 'large',
        invertLookHorizontal: true,
        invertLookVertical: true,
        leftFireButton: false,
        touchSprintMode: 'hold',
        touchButtonPreset: 'compact',
        touchLayoutPreset: 'classic',
        hudOpacity: 0.66,
        hudScale: 1.2,
        gyroAim: true,
      },
      store
    );
    const loaded = loadSettings(store);
    expect(loaded.quality).toBe('high');
    expect(loaded.sensitivity).toBe(1.5);
    expect(loaded.touchSensitivityX).toBe(1.25);
    expect(loaded.touchSensitivityY).toBe(0.95);
    expect(loaded.volume).toBe(0.4);
    expect(loaded.cameraMode).toBe('fps');
    expect(loaded.minimapSize).toBe('large');
    expect(loaded.invertLookHorizontal).toBe(true);
    expect(loaded.invertLookVertical).toBe(true);
    expect(loaded.leftFireButton).toBe(false);
    expect(loaded.touchSprintMode).toBe('hold');
    expect(loaded.touchButtonPreset).toBe('compact');
    expect(loaded.touchLayoutPreset).toBe('classic');
    expect(loaded.hudOpacity).toBe(0.66);
    expect(loaded.hudScale).toBe(1.2);
    expect(loaded.gyroAim).toBe(true);
  });

  it('returns defaults for empty storage', () => {
    expect(loadSettings(memStorage())).toEqual(defaultSettings());
  });

  it('falls back to defaults for invalid / corrupt values', () => {
    const store = memStorage();
    store.setItem('robot_arena_settings_v2', 'not-json');
    expect(loadSettings(store)).toEqual(defaultSettings());
  });

  it('migrates v1 settings and clears sticky horizontal invert', () => {
    const store = memStorage();
    store.setItem(
      'robot_arena_settings_v1',
      JSON.stringify({
        quality: 'low',
        sensitivity: 1.2,
        volume: 0.5,
        cameraMode: 'fps',
        minimapSize: 'large',
        invertLookHorizontal: true,
      })
    );
    const loaded = loadSettings(store);
    expect(loaded.quality).toBe('low');
    expect(loaded.invertLookHorizontal).toBe(false);
    expect(store.getItem('robot_arena_settings_v2')).toBeTruthy();
  });

  it('sanitizes wrong-typed and unrecognized values to defaults', () => {
    const s = sanitizeSettings({
      quality: 'ultra',
      sensitivity: 'fast',
      touchSensitivityX: 'fast',
      volume: 'loud',
      cameraMode: 'side',
      minimapSize: 'huge',
    });
    expect(s).toEqual(defaultSettings());
  });

  it('clamps sensitivity and volume to valid ranges', () => {
    const s = sanitizeSettings({
      sensitivity: 10,
      touchSensitivityX: 10,
      touchSensitivityY: -2,
      volume: 2,
      hudOpacity: 4,
      hudScale: 9,
      quality: 'medium',
      cameraMode: 'tps',
      minimapSize: 'small',
    });
    expect(s.sensitivity).toBe(3);
    expect(s.touchSensitivityX).toBe(3);
    expect(s.touchSensitivityY).toBe(0.35);
    expect(s.volume).toBe(1);
    expect(s.hudOpacity).toBe(1);
    expect(s.hudScale).toBe(1.3);
  });

  it('accepts high quality preset during sanitize', () => {
    const s = sanitizeSettings({ quality: 'high' });
    expect(s.quality).toBe('high');
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
