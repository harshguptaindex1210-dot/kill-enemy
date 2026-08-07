import { isPhoneDevice } from './platform';

export interface OrientationProbe {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  landscape: boolean;
}

/** Pure helper for tests — mirrors isPhoneDevice without window globals. */
export function isPhoneFromProbe(probe: OrientationProbe): boolean {
  const ua = probe.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  if (probe.platform === 'MacIntel' && probe.maxTouchPoints > 1) return false;
  return /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
}

export function shouldShowRotateOverlay(probe: OrientationProbe): boolean {
  return isPhoneFromProbe(probe) && !probe.landscape;
}

export function isLandscapeOrientation(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(orientation: landscape)').matches;
  }
  return window.innerWidth > window.innerHeight;
}

export function syncPhoneOrientationDom(): void {
  if (typeof document === 'undefined' || !isPhoneDevice()) return;
  const portrait = !isLandscapeOrientation();
  document.documentElement.dataset.phoneDevice = 'true';
  document.documentElement.dataset.phonePortrait = portrait ? 'true' : 'false';
}

export async function tryLockLandscapeOrientation(): Promise<boolean> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'portrait' | 'natural') => Promise<void>;
    };
    if (typeof orientation?.lock === 'function') {
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    /* unsupported, denied, or needs user gesture */
  }
  return false;
}

function createRotateOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'rotate-device-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rotate-device-title');
  overlay.innerHTML = `
    <div class="rotate-device-content">
      <div class="rotate-device-icon" aria-hidden="true">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="22" y="8" width="28" height="48" rx="5" stroke="#2dd4bf" stroke-width="3" fill="rgba(45,212,191,0.12)"/>
          <circle cx="36" cy="50" r="3" fill="#2dd4bf"/>
          <path d="M48 20 L58 14 L58 26 Z" fill="#fbbf24"/>
        </svg>
      </div>
      <h1 id="rotate-device-title">Rotate your device to landscape</h1>
      <p>Turn your phone sideways to play Kill Enemy.</p>
    </div>
  `;
  return overlay;
}

let orientationListenersBound = false;

/** @internal test-only reset */
export function resetPhoneLandscapeModeForTests(): void {
  orientationListenersBound = false;
}

/** Phone-only: portrait overlay, landscape layout, optional orientation lock. */
export function initPhoneLandscapeMode(): void {
  if (typeof document === 'undefined' || !isPhoneDevice()) return;

  document.documentElement.dataset.phoneDevice = 'true';

  if (!document.getElementById('rotate-device-overlay')) {
    document.body.appendChild(createRotateOverlay());
  }

  syncPhoneOrientationDom();

  if (orientationListenersBound) return;
  orientationListenersBound = true;

  const onOrientationChange = () => syncPhoneOrientationDom();
  window.matchMedia('(orientation: portrait)').addEventListener('change', onOrientationChange);
  window.matchMedia('(orientation: landscape)').addEventListener('change', onOrientationChange);
  window.addEventListener('resize', onOrientationChange);
  window.addEventListener('orientationchange', onOrientationChange);

  const requestLandscapeLock = () => {
    void tryLockLandscapeOrientation();
  };

  const overlay = document.getElementById('rotate-device-overlay');
  overlay?.addEventListener('click', requestLandscapeLock);
  overlay?.addEventListener('touchstart', requestLandscapeLock, { passive: true });
  document.addEventListener(
    'pointerdown',
    () => {
      void tryLockLandscapeOrientation();
    },
    { once: true }
  );
}
