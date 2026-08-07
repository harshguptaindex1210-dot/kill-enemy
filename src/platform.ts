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
