import { isMobileDevice } from './platform';

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  sensitivity: number;
  /** Touch look horizontal multiplier for phone aiming. */
  touchSensitivityX: number;
  /** Touch look vertical multiplier for phone aiming. */
  touchSensitivityY: number;
  volume: number;
  cameraMode: 'tps' | 'fps';
  minimapSize: 'small' | 'large';
  /** Touch-only horizontal inversion (desktop mouse unchanged). */
  invertLookHorizontal: boolean;
  /** Touch-only vertical inversion (desktop mouse unchanged). */
  invertLookVertical: boolean;
  /** Show mirrored fire button on the left side for claw/thumb layouts. */
  leftFireButton: boolean;
  /** Sprint behavior for touch movement. */
  touchSprintMode: 'hold' | 'auto';
  /** Touch action button sizing preset. */
  touchButtonPreset: 'compact' | 'standard';
  /** Primary touch layout preset. */
  touchLayoutPreset: 'thumbs' | 'classic';
  /** Opacity of touch controls + HUD chrome. */
  hudOpacity: number;
  /** Scale of touch controls and HUD size. */
  hudScale: number;
  /** Placeholder toggle only (gyro pipeline not wired yet). */
  gyroAim: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'robot_arena_settings_v1';

export function defaultSettings(): Settings {
  const isMobile = isMobileDevice();
  return {
    quality: isMobile ? 'low' : 'medium',
    sensitivity: 1,
    touchSensitivityX: isMobile ? 1.2 : 1,
    touchSensitivityY: isMobile ? 1.05 : 1,
    volume: 0.7,
    cameraMode: 'tps',
    minimapSize: 'small',
    // Default false: drag/swipe right -> turn right (matches desktop mouse look).
    invertLookHorizontal: false,
    invertLookVertical: false,
    leftFireButton: true,
    touchSprintMode: 'auto',
    touchButtonPreset: 'standard',
    touchLayoutPreset: 'thumbs',
    hudOpacity: isMobile ? 0.78 : 0.9,
    hudScale: isMobile ? 1.06 : 1,
    gyroAim: false,
  };
}

export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    quality:
      r.quality === 'low' || r.quality === 'medium' || r.quality === 'high' ? r.quality : d.quality,
    sensitivity:
      typeof r.sensitivity === 'number' && isFinite(r.sensitivity)
        ? Math.min(Math.max(r.sensitivity, 0.2), 3)
        : d.sensitivity,
    touchSensitivityX:
      typeof r.touchSensitivityX === 'number' && isFinite(r.touchSensitivityX)
        ? Math.min(Math.max(r.touchSensitivityX, 0.35), 3)
        : d.touchSensitivityX,
    touchSensitivityY:
      typeof r.touchSensitivityY === 'number' && isFinite(r.touchSensitivityY)
        ? Math.min(Math.max(r.touchSensitivityY, 0.35), 3)
        : d.touchSensitivityY,
    volume:
      typeof r.volume === 'number' && isFinite(r.volume)
        ? Math.min(Math.max(r.volume, 0), 1)
        : d.volume,
    cameraMode: r.cameraMode === 'tps' || r.cameraMode === 'fps' ? r.cameraMode : d.cameraMode,
    minimapSize:
      r.minimapSize === 'small' || r.minimapSize === 'large' ? r.minimapSize : d.minimapSize,
    invertLookHorizontal:
      typeof r.invertLookHorizontal === 'boolean' ? r.invertLookHorizontal : d.invertLookHorizontal,
    invertLookVertical:
      typeof r.invertLookVertical === 'boolean' ? r.invertLookVertical : d.invertLookVertical,
    leftFireButton: typeof r.leftFireButton === 'boolean' ? r.leftFireButton : d.leftFireButton,
    touchSprintMode:
      r.touchSprintMode === 'hold' || r.touchSprintMode === 'auto'
        ? r.touchSprintMode
        : d.touchSprintMode,
    touchButtonPreset:
      r.touchButtonPreset === 'compact' || r.touchButtonPreset === 'standard'
        ? r.touchButtonPreset
        : d.touchButtonPreset,
    touchLayoutPreset:
      r.touchLayoutPreset === 'thumbs' || r.touchLayoutPreset === 'classic'
        ? r.touchLayoutPreset
        : d.touchLayoutPreset,
    hudOpacity:
      typeof r.hudOpacity === 'number' && isFinite(r.hudOpacity)
        ? Math.min(Math.max(r.hudOpacity, 0.35), 1)
        : d.hudOpacity,
    hudScale:
      typeof r.hudScale === 'number' && isFinite(r.hudScale)
        ? Math.min(Math.max(r.hudScale, 0.8), 1.3)
        : d.hudScale,
    gyroAim: typeof r.gyroAim === 'boolean' ? r.gyroAim : d.gyroAim,
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
