/** Shared browser / device helpers for mobile Safari and touch play. */

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (isTouchDevice() && window.innerWidth < 900)
  );
}

/** Tablets and iPadOS desktop UA — excluded from forced phone landscape. */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return true;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  if (
    typeof navigator.platform === 'string' &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

/** iPhone / Android phone only — not desktop or tablets. */
export function isPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTabletDevice()) return false;
  const ua = navigator.userAgent;
  return /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
}

/** Tablets and iPadOS desktop UA — excluded from forced phone landscape. */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return true;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  if (
    typeof navigator.platform === 'string' &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

/** iPhone / Android phone only — not desktop or tablets. */
export function isPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTabletDevice()) return false;
  const ua = navigator.userAgent;
  return /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
}

export function isLandscapeOrientation(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(orientation: landscape)').matches;
  }
  return window.innerWidth > window.innerHeight;
}

export async function tryLockPhoneLandscape(): Promise<boolean> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: 'landscape' | 'portrait' | 'natural') => Promise<void>;
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

export function bindPhoneLandscapeLock(): void {
  if (!isPhoneDevice()) return;
  const lock = () => {
    void tryLockPhoneLandscape();
  };
  document.getElementById('rotate-device-overlay')?.addEventListener('click', lock);
  document.getElementById('rotate-device-overlay')?.addEventListener('touchstart', lock, {
    passive: true,
  });
  document.addEventListener('pointerdown', lock, { once: true });
}

/** Pointer lock is desktop-only; iOS Safari rejects or no-ops the call. */
export function safeRequestPointerLock(el: Element): void {
  if (isTouchDevice()) return;
  const req = (el as HTMLElement & { requestPointerLock?: () => void }).requestPointerLock;
  if (!req) return;
  try {
    const result = req.call(el) as void | Promise<void>;
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    /* unsupported */
  }
}

export function safeScrollToTop(): void {
  const scrollTo = window.scrollTo;
  if (typeof scrollTo !== 'function') return;
  // jsdom defines scrollTo but throws "Not implemented" — detect that path.
  if (
    scrollTo.toString().includes('[native code]') === false &&
    /not implemented/i.test(scrollTo.toString())
  ) {
    return;
  }
  try {
    scrollTo.call(window, 0, 0);
  } catch {
    /* jsdom / restricted embed */
  }
}
