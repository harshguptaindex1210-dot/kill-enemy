import { isMobileDevice } from './platform';

export interface Settings {
  quality: 'low' | 'medium';
  sensitivity: number;
  volume: number;
  cameraMode: 'tps' | 'fps';
  minimapSize: 'small' | 'large';
  /** When true, flips touch horizontal look only (desktop mouse unchanged). */
  invertLookHorizontal: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'robot_arena_settings_v1';

export function defaultSettings(): Settings {
  return {
    quality: isMobileDevice() ? 'low' : 'medium',
    sensitivity: 1,
    volume: 0.7,
    cameraMode: 'tps',
    minimapSize: 'small',
    // Default false: drag/swipe right → turn right (matches desktop mouse look).
    invertLookHorizontal: false,
  };
}

export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    quality: r.quality === 'low' || r.quality === 'medium' ? r.quality : d.quality,
    sensitivity:
      typeof r.sensitivity === 'number' && isFinite(r.sensitivity)
        ? Math.min(Math.max(r.sensitivity, 0.2), 3)
        : d.sensitivity,
    volume:
      typeof r.volume === 'number' && isFinite(r.volume)
        ? Math.min(Math.max(r.volume, 0), 1)
        : d.volume,
    cameraMode: r.cameraMode === 'tps' || r.cameraMode === 'fps' ? r.cameraMode : d.cameraMode,
    minimapSize:
      r.minimapSize === 'small' || r.minimapSize === 'large' ? r.minimapSize : d.minimapSize,
    invertLookHorizontal:
      typeof r.invertLookHorizontal === 'boolean'
        ? r.invertLookHorizontal
        : d.invertLookHorizontal,
  };
}

export function loadSettings(storage: StorageLike = defaultStorage()): Settings {
  try {
    const raw = storage.getItem(KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings, storage: StorageLike = defaultStorage()): void {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore write failures (private mode / quota)
  }
}

function defaultStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
    };
  }
}
