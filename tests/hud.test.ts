import { describe, it, expect, vi } from 'vitest';
import { applyHudChrome, createHUD, type HUDData } from '../src/hud';

function baseHudData(overrides: Partial<HUDData> = {}): HUDData {
  return {
    kills: 0,
    targetsHit: 0,
    alive: 1,
    health: 100,
    armor: 0,
    weapon: 'RIFLE',
    ammo: 30,
    reserve: 90,
    reloading: false,
    grenades: 2,
    heals: 1,
    matchTimer: '0:10',
    phaseLabel: 'IN MATCH',
    zoneTimer: '0:40',
    healProgress: 0,
    inStorm: false,
    justHit: false,
    prompt: '',
    skillName: 'Speed [F]',
    skillCooldownText: 'READY',
    skillReady: true,
    showRespawn: false,
    healActionLabel: 'HEAL [H] x1',
    healActionEnabled: true,
    ...overrides,
  };
}

describe('HUD heal action button', () => {
  it('applyHudChrome scales panels without clipping the bottom vitals bar', () => {
    const hud = createHUD();
    applyHudChrome({ hudOpacity: 0.9, hudScale: 1.2 });
    const root = document.getElementById('game-hud') as HTMLElement;
    expect(root.style.transform).toBe('');
    expect(root.style.getPropertyValue('--hud-scale')).toBe('1.2');
    expect(root.style.opacity).toBe('0.9');
    hud.remove();
  });

  it('fires heal callback when enabled', () => {
    const hud = createHUD();
    const onHeal = vi.fn();
    hud.onHealAction?.(onHeal);
    hud.update(baseHudData({ healActionEnabled: true }));

    const btn = document.getElementById('hud-heal-action') as HTMLButtonElement;
    btn.click();
    expect(onHeal).toHaveBeenCalledTimes(1);
    hud.remove();
  });

  it('fires heal callback from touchstart on phones', () => {
    const hud = createHUD();
    const onHeal = vi.fn();
    hud.onHealAction?.(onHeal);
    hud.update(baseHudData({ healActionEnabled: true }));

    const btn = document.getElementById('hud-heal-action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    expect(onHeal).toHaveBeenCalledTimes(1);
    hud.remove();
  });

  it('disables heal button with provided feedback label', () => {
    const hud = createHUD();
    hud.update(baseHudData({ healActionEnabled: false, healActionLabel: 'HEAL FULL HP' }));
    const btn = document.getElementById('hud-heal-action') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('HEAL FULL HP');
    hud.remove();
  });
});
