import { describe, it, expect } from 'vitest';
import {
  defaultStats,
  recordMatch,
  recordMatchOnce,
  addXP,
  createWriteId,
  createStorageKey,
  ensureMaxLevelStats,
  MAX_PLAYER_LEVEL,
  xpForLevel,
} from '../src/persistence';

describe('persistence', () => {
  it('creates default stats', () => {
    const s = defaultStats();
    expect(s.wins).toBe(0);
    expect(s.level).toBe(1);
  });

  it('adds XP and levels up at 1000', () => {
    const s = defaultStats();
    addXP(s, 1000);
    expect(s.xp).toBe(1000);
    expect(s.level).toBe(2);
  });

  it('records match stats', () => {
    const s = defaultStats();
    recordMatch(s, true, 5, 200, 150);
    expect(s.matches).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.kills).toBe(5);
    expect(s.damage).toBe(200);
    expect(s.xp).toBe(150);
  });

  it('generates unique write IDs', () => {
    const id1 = createWriteId();
    const id2 = createWriteId();
    expect(id1).not.toBe(id2);
  });

  it('creates storage key from userId', () => {
    const key = createStorageKey('user123');
    expect(key).toContain('user123');
    expect(key).toContain('player_data');
  });

  it('records a match once per write id (idempotent under retry)', () => {
    const s = defaultStats();
    const id = createWriteId();
    const first = recordMatchOnce(s, id, true, 3, 100, 120);
    expect(first.applied).toBe(true);
    expect(s.matches).toBe(1);
    expect(s.wins).toBe(1);
    const retry = recordMatchOnce(s, id, true, 3, 100, 120);
    expect(retry.applied).toBe(false);
    expect(s.matches).toBe(1);
    expect(s.xp).toBe(120);
  });

  it('allows a fresh write id to record again', () => {
    const s = defaultStats();
    const id1 = createWriteId();
    const id2 = createWriteId();
    recordMatchOnce(s, id1, false, 1, 50, 60);
    recordMatchOnce(s, id2, false, 2, 90, 90);
    expect(s.matches).toBe(2);
    expect(s.kills).toBe(3);
  });

  it('XP sums placement contribution via recordMatch', () => {
    const s = defaultStats();
    recordMatch(s, false, 2, 100, 45);
    recordMatch(s, true, 4, 200, 90);
    expect(s.xp).toBe(135);
    expect(s.level).toBe(1);
    addXP(s, 900);
    expect(s.level).toBe(2);
  });

  it('boosts stats to configured max level floor', () => {
    const boosted = ensureMaxLevelStats(defaultStats());
    expect(boosted.level).toBe(MAX_PLAYER_LEVEL);
    expect(boosted.xp).toBe(xpForLevel(MAX_PLAYER_LEVEL));
  });
});
