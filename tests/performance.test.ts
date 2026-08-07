import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMobileDevice } from '../src/platform';

describe('performance helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0',
      maxTouchPoints: 0,
    });
    vi.stubGlobal('window', { ...window, innerWidth: 1280 });
  });

  it('isMobileDevice detects phone UA', () => {
    expect(isMobileDevice()).toBe(false);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5,
    });
    expect(isMobileDevice()).toBe(true);
  });
});
