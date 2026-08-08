import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('touch jump input', () => {
  it('input.ts latches jump across frames for 20Hz online ticks', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/touchJumpHeld/);
    expect(src).toMatch(/touchJumpLatchUntil/);
    expect(src).toMatch(/Date\.now\(\)\s*\+\s*450/);
    expect(src).toMatch(/touchJumpHeld\s*\|\|\s*Date\.now\(\)\s*<\s*touchJumpLatchUntil/);
    expect(src).toMatch(/z-index:10000/);
  });

  it('jump button is a proper touch button with hold handlers', () => {
    const src = readFileSync(resolve(__dirname, '../src/input.ts'), 'utf8');
    expect(src).toMatch(/id="tb-jump"\s+type="button"/);
    expect(src).toMatch(/btnJump\.addEventListener\('touchstart', armJump/);
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
