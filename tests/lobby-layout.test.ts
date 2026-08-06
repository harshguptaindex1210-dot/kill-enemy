import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { showLobby, type LobbyCallbacks } from '../src/lobby';
import { defaultProfile } from '../src/profile';
import { defaultSettings } from '../src/settings';

function callbacks(): LobbyCallbacks {
  return {
    onPlayLocal: vi.fn(),
    onPlayOnline: vi.fn(),
    onCancelQueue: vi.fn(),
    onSettingsChange: vi.fn(),
    onProfileChange: vi.fn(),
    onBuyGunSkin: vi.fn(),
    onBuyChassis: vi.fn(),
    onEquipChassis: vi.fn(),
    onEquipGunSkin: vi.fn(),
    onRename: vi.fn(),
  };
}

describe('lobby responsive layout (#46)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts overlay with responsive classes and a hero first-fold', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks()
    );

    const overlay = document.getElementById('lobby-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.classList.contains('lobby-overlay')).toBe(true);

    const hero = document.getElementById('lobby-hero');
    expect(hero).toBeTruthy();
    expect(hero!.querySelector('h1')?.textContent).toMatch(/KILL ENEMY/i);
    expect(hero!.querySelector('#btn-online')).toBeTruthy();
    expect(hero!.querySelector('#btn-local')).toBeTruthy();

    // Character / settings / shop live outside the first fold.
    expect(hero!.querySelector('#inp-name')).toBeNull();
    expect(document.getElementById('inp-name')).toBeTruthy();
    expect(document.querySelector('.lobby-panels')).toBeTruthy();
    expect(document.querySelectorAll('.lobby-shop-grid').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps Cancel inside the hero while queueing', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks(),
      { history: [], leaderboard: [] },
      { active: true, message: 'Searching…' }
    );

    const hero = document.getElementById('lobby-hero')!;
    const cancel = hero.querySelector('#btn-cancel-queue') as HTMLButtonElement;
    expect(cancel).toBeTruthy();
    expect(cancel.style.display).not.toBe('none');
  });

  it('escapes profile name so markup cannot break out of the name input', () => {
    const profile = { ...defaultProfile(), name: '"><img src=x onerror=alert(1)>' };
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      profile,
      callbacks()
    );
    expect(document.querySelector('#lobby-overlay img')).toBeNull();
    expect(document.getElementById('inp-name')).toBeTruthy();
    expect(document.querySelector('#lobby-overlay script')).toBeNull();
  });

  it('mounts a how-to-play instructions panel', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks()
    );

    const panel = document.getElementById('lobby-instructions');
    expect(panel).toBeTruthy();
    expect(panel!.classList.contains('lobby-instructions')).toBe(true);
    expect(panel!.textContent).toMatch(/How to Play/i);
    expect(panel!.textContent).toMatch(/W A S D/i);
    expect(document.querySelector('.lobby-layout')).toBeTruthy();
  });

  it('ships stylesheet rules for phone wrap and laptop multi-column', () => {
    const css = readFileSync(resolve(__dirname, '../src/lobby.css'), 'utf8');
    expect(css).toMatch(/\.lobby-overlay/);
    expect(css).toMatch(/\.lobby-layout/);
    expect(css).toMatch(/\.lobby-instructions/);
    expect(css).toMatch(/\.lobby-hero/);
    expect(css).toMatch(/\.lobby-shop-grid/);
    expect(css).toMatch(/@media\s*\(\s*min-width:\s*768px\s*\)/);
    expect(css).toMatch(/@media\s*\(\s*min-width:\s*900px\s*\)/);
    expect(css).toMatch(/@media\s*\(\s*min-width:\s*1024px\s*\)/);
    expect(css).toMatch(/\.lobby-panels/);
    const desktopBlock = css.split(/@media\s*\(\s*min-width:\s*768px\s*\)/)[1] ?? '';
    expect(desktopBlock).toMatch(/\.lobby-instructions[^}]*position:\s*fixed/s);
    expect(desktopBlock).toMatch(/z-index:\s*10000/);
  });

  it('shows quick controls in hero on mobile', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks()
    );
    expect(document.querySelector('.lobby-quick-controls')).toBeTruthy();
    expect(document.querySelector('.lobby-quick-controls')!.textContent).toMatch(/W A S D/i);
  });

  it('disables Play Local while matchmaking queue is active', () => {
    const cb = callbacks();
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      cb,
      { history: [], leaderboard: [] },
      { active: true, message: 'Searching for match...' }
    );
    const localBtn = document.getElementById('btn-local') as HTMLButtonElement;
    expect(localBtn.disabled).toBe(true);
    localBtn.click();
    expect(cb.onPlayLocal).not.toHaveBeenCalled();
  });

  it('replaces a previous overlay instead of stacking duplicates', () => {
    const stats = { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 };
    showLobby(stats, defaultSettings(), defaultProfile(), callbacks());
    showLobby(stats, defaultSettings(), defaultProfile(), callbacks());
    expect(document.querySelectorAll('#lobby-overlay').length).toBe(1);
  });

  it('escapes queue and shop messages against markup breakout', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks(),
      { history: [], leaderboard: [] },
      { active: false, message: '"><img src=x onerror=alert(1)>' },
      '"><script>alert(1)</script>'
    );
    expect(document.querySelector('#lobby-overlay img')).toBeNull();
    expect(document.querySelector('#lobby-overlay script')).toBeNull();
    expect(document.querySelector('.lobby-queue-msg')).toBeTruthy();
    expect(document.getElementById('shop-msg')).toBeTruthy();
  });

  it('keeps essential overlay positioning even before stylesheet rules apply', () => {
    showLobby(
      { level: 1, xp: 0, wins: 0, kills: 0, matches: 0 },
      defaultSettings(),
      defaultProfile(),
      callbacks()
    );
    const overlay = document.getElementById('lobby-overlay')!;
    expect(overlay.style.position).toBe('fixed');
    expect(['0', '0px']).toContain(overlay.style.inset);
    expect(overlay.style.zIndex).toBe('9998');
  });
});
