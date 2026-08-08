import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

describe('orientation markup', () => {
  it('index.html includes early phone portrait gate', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/id="rotate-device-overlay"/);
    expect(html).toMatch(
      /@media\s*\(\s*orientation:\s*portrait\s*\)\s*and\s*\(\s*max-width:\s*900px\s*\)/
    );
    expect(html).toMatch(/dataset\.phoneDevice/);
  });

  it('phone CSS promotes the touch HEAL button', () => {
    const css = readFileSync(resolve(__dirname, '../src/orientation.css'), 'utf8');
    expect(css).toMatch(/#tb-heal/);
    expect(css).toMatch(/#hud-heal-action[\s\S]*display:\s*none/);
    expect(css).toMatch(/#tb-rs/);
    expect(css).toMatch(/#hud-respawn[\s\S]*display:\s*none/);
  });
});

describe('touch overlay heal control', () => {
  it('main.ts loads HUD styles on laptop and phone', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(src).toMatch(/import\('\.\/orientation\.css'\)/);
    expect(src).not.toMatch(/isPhoneDevice\(\)\)[\s\S]*import\('\.\/orientation\.css'\)/);
  });

  it('ships a labeled HEAL button in the touch actions markup', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/id="tb-heal"/);
    expect(src).toMatch(/>HEAL</);
    expect(src).not.toMatch(/tb-invert-look/);
  });
});
