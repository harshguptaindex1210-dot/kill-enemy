import { describe, it, expect } from 'vitest';
import {
  isPhoneFromProbe,
  shouldShowRotateOverlay,
  type OrientationProbe,
} from '../src/orientation';

function probe(overrides: Partial<OrientationProbe> = {}): OrientationProbe {
  return {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
    landscape: false,
    ...overrides,
  };
}

describe('isPhoneFromProbe', () => {
  it('detects iPhone', () => {
    expect(isPhoneFromProbe(probe())).toBe(true);
  });

  it('detects Android phone', () => {
    expect(
      isPhoneFromProbe(
        probe({
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36',
          platform: 'Linux armv8l',
        })
      )
    ).toBe(true);
  });

  it('excludes iPad', () => {
    expect(
      isPhoneFromProbe(
        probe({
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
          platform: 'iPad',
        })
      )
    ).toBe(false);
  });

  it('excludes iPadOS desktop UA', () => {
    expect(
      isPhoneFromProbe(
        probe({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          platform: 'MacIntel',
          maxTouchPoints: 5,
        })
      )
    ).toBe(false);
  });

  it('excludes Android tablet', () => {
    expect(
      isPhoneFromProbe(
        probe({
          userAgent: 'Mozilla/5.0 (Linux; Android 14) Safari/537.36',
          platform: 'Linux armv8l',
        })
      )
    ).toBe(false);
  });
});

describe('shouldShowRotateOverlay', () => {
  it('shows overlay for phone in portrait', () => {
    expect(shouldShowRotateOverlay(probe({ landscape: false }))).toBe(true);
  });

  it('hides overlay for phone in landscape', () => {
    expect(shouldShowRotateOverlay(probe({ landscape: true }))).toBe(false);
  });

  it('hides overlay for tablet in portrait', () => {
    expect(
      shouldShowRotateOverlay(
        probe({
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
          platform: 'iPad',
          landscape: false,
        })
      )
    ).toBe(false);
  });
});
