import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('touch jump input', () => {
  it('input.ts uses one-shot jump pulses instead of a long latch', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/touchJumpOnce/);
    expect(src).toMatch(/jump:\s*jumpOnce\s*\|\|\s*touchJump/);
    expect(src).not.toMatch(/touchJumpLatchUntil/);
    expect(src).not.toMatch(/desktopJumpLatchUntil/);
    expect(src).toMatch(/z-index:10010/);
  });

  it('mounts touch UI only on phones, not touch laptops', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/isPhoneDevice\(\)/);
    expect(src).not.toMatch(/isTouchDevice\(\)/);
  });

  it('jump button is a proper touch button with hold handlers', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/id="tb-jump"\s+type="button"/);
    expect(src).toMatch(/btnJump\.addEventListener\('touchstart', armJump/);
    expect(src).toMatch(/btnJump\.addEventListener\('pointerdown', armJump/);
  });

  it('ships a touch respawn button wired to onRespawn', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/id="tb-rs"/);
    expect(src).toMatch(/showRespawn/);
    expect(src).toMatch(/onRespawn/);
    expect(src).toMatch(/touchRespawnBtn/);
  });
});

describe('mobile in-match settings', () => {
  it('lazy-loads a settings panel module for touch devices', () => {
    const src = readFileSync(resolve(__dirname, '../src/mobileSettingsPanel.ts'), 'utf8');
    expect(src).toMatch(/openMobileSettingsPanel/);
    expect(src).toMatch(/ms-touch-sens-x/);
  });

  it('input.ts opens settings via dynamic import', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/import\('\.\/mobileSettingsPanel'\)/);
    expect(src).toMatch(/tb-settings-gear/);
  });
});

describe('bot combat think cache', () => {
  it('gameplay.ts never caches bot input while in combat', () => {
    const src = readFileSync(resolve(__dirname, '../src/gameplay.ts'), 'utf8');
    expect(src).toMatch(/inCombat \? 0/);
  });
});
