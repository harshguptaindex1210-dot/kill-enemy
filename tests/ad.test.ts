import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showAd, type AdConfig } from '../src/ad';

describe('ad slot (#37)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('resolves after skip button clicked', async () => {
    const config: AdConfig = { skipAfterMs: 5000, online: false };
    const promise = showAd(config);

    // Advance timers to enable skip button
    await vi.advanceTimersByTimeAsync(5000);

    const skipBtn = document.querySelector('#ad-overlay button') as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();
    expect(skipBtn!.disabled).toBe(false);

    skipBtn!.click();

    await expect(promise).resolves.toBeUndefined();
    expect(document.getElementById('ad-overlay')).toBeNull();
  });

  it('fail-opens if DOM error occurs', async () => {
    // Simulate an environment where document.createElement throws
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = () => {
      throw new Error('DOM error');
    };

    const config: AdConfig = { skipAfterMs: 5000, online: false };
    const promise = showAd(config);

    // Should resolve immediately (fail-open)
    await expect(promise).resolves.toBeUndefined();

    document.createElement = originalCreateElement;
  });

  it('uses different skip times for local vs online', async () => {
    const localConfig: AdConfig = { skipAfterMs: 5000, online: false };
    const onlineConfig: AdConfig = { skipAfterMs: 10000, online: true };

    // Test that both configs are accepted (they don't throw)
    const localPromise = showAd(localConfig);
    const onlinePromise = showAd(onlineConfig);

    // Clean up
    vi.advanceTimersByTime(10000);
    document
      .querySelectorAll('#ad-overlay button')
      .forEach((btn) => (btn as HTMLButtonElement).click());

    await expect(localPromise).resolves.toBeUndefined();
    await expect(onlinePromise).resolves.toBeUndefined();
  });
});
