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

/** Pointer lock is desktop-only; phones/tablets reject or no-op the call. */
export function safeRequestPointerLock(el: Element): void {
  if (isPhoneDevice() || isTabletDevice()) return;
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
