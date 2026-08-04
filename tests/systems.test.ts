import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { defaultSettings, sanitizeSettings, loadSettings, saveSettings } from '../src/settings';
import { createAirdropSystem, updateAirdrops, claimAirdrop } from '../src/airdrop';
import {
  makeKillFeedEntry,
  formatCompassBearing,
  formatTimer,
  formatPlacement,
  hitMarkerClass,
  xpForPlacement,
} from '../src/feedback';
import { AudioManager } from '../src/audio';

describe('settings', () => {
  it('returns defaults when nothing stored', () => {
    const storage = { getItem: () => null, setItem: () => undefined };
    expect(loadSettings(storage)).toEqual(defaultSettings());
  });

  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
    const s = defaultSettings();
    s.sensitivity = 1.8;
    s.volume = 0.4;
    saveSettings(s, storage);
    expect(loadSettings(storage).sensitivity).toBe(1.8);
    expect(loadSettings(storage).volume).toBe(0.4);
  });

  it('sanitizes bad values', () => {
    const bad = sanitizeSettings({ quality: 'ultra', sensitivity: 99, volume: -5 });
    expect(bad.quality).toBe('medium');
    expect(bad.sensitivity).toBe(3);
    expect(bad.volume).toBe(0);
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
  });
});

describe('airdrops', () => {
  it('spawns a crate at the schedule time', () => {
    const s = createAirdropSystem(10000, 4);
    const spawned = updateAirdrops(s, 10000, new THREE.Vector3(0, 0, 0), 400);
    expect(spawned.length).toBe(1);
    expect(s.airdrops.length).toBe(1);
  });

  it('spawns inside the safe circle', () => {
    const s = createAirdropSystem(10000, 4);
    const center = new THREE.Vector3(0, 0, 0);
    const spawned = updateAirdrops(s, 10000, center, 100);
    for (const d of spawned) {
      expect(d.position.x).toBeLessThan(100);
      expect(d.position.z).toBeLessThan(100);
      expect(d.position.distanceTo(center)).toBeLessThanOrEqual(100);
    }
  });

  it('respects maxDrops', () => {
    const s = createAirdropSystem(1, 2);
    updateAirdrops(s, 1, new THREE.Vector3(0, 0, 0), 400);
    updateAirdrops(s, 2, new THREE.Vector3(0, 0, 0), 400);
    updateAirdrops(s, 3, new THREE.Vector3(0, 0, 0), 400);
    expect(s.airdrops.length).toBe(2);
  });

  it('claims crate only once and returns high-tier loot', () => {
    const s = createAirdropSystem(10000, 4);
    const spawned = updateAirdrops(s, 10000, new THREE.Vector3(0, 0, 0), 400);
    const loot = claimAirdrop(s, spawned[0].id);
    expect(loot).not.toBeNull();
    expect(claimAirdrop(s, spawned[0].id)).toBeNull();
    expect(loot!.some((l) => l.type === 'armor')).toBe(true);
  });
});

describe('feedback helpers', () => {
  it('formats compass bearings', () => {
    expect(formatCompassBearing(0)).toBe('N');
    expect(formatCompassBearing(Math.PI)).toBe('S');
    expect(formatCompassBearing(-Math.PI / 2)).toBe('W');
  });

  it('formats timers', () => {
    expect(formatTimer(0)).toBe('0:00');
    expect(formatTimer(65000)).toBe('1:05');
    expect(formatTimer(25 * 60 * 1000)).toBe('25:00');
  });

  it('formats placement', () => {
    expect(formatPlacement(1)).toBe('1st');
    expect(formatPlacement(2)).toBe('2nd');
    expect(formatPlacement(3)).toBe('3rd');
    expect(formatPlacement(7)).toBe('7th');
  });

  it('hit marker classes', () => {
    expect(hitMarkerClass(false, false)).toBe('none');
    expect(hitMarkerClass(true, false)).toBe('hit');
    expect(hitMarkerClass(true, true)).toBe('kill');
  });

  it('placement XP', () => {
    expect(xpForPlacement(10, 1)).toBe(100);
    expect(xpForPlacement(10, 10)).toBe(10);
  });

  it('kill feed entries have unique ids', () => {
    const a = makeKillFeedEntry('k', 'v', 'shot', 1);
    const b = makeKillFeedEntry('k', 'v', 'zone', 2);
    expect(a.id).not.toBe(b.id);
  });
});

describe('audio', () => {
  it('does not throw without an AudioContext (node/jsdom)', () => {
    const am = new AudioManager();
    expect(() => am.play('shot')).not.toThrow();
    am.setVolume(0.5);
    am.setMuted(true);
    expect(am.isMuted()).toBe(true);
    am.setMuted(false);
    am.dispose();
  });
});
