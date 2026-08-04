import { describe, it, expect } from 'vitest';
import {
  createMatch,
  startCountdown,
  tickMatch,
  toResults,
  registerDamage,
  killPlayer,
  calculateXP,
} from '../src/match';

describe('match countdown + drop timing', () => {
  it('countdown advances to dropping after duration', () => {
    const m = createMatch(['p1', 'p2']);
    startCountdown(m, 0);
    expect(m.phase).toBe('countdown');
    tickMatch(m, 1, 1000);
    expect(m.phase).toBe('countdown');
    tickMatch(m, 1, 5000);
    expect(m.phase).toBe('dropping');
  });

  it('dropping advances to playing', () => {
    const m = createMatch(['p1', 'p2']);
    startCountdown(m, 0);
    tickMatch(m, 1, 5000);
    expect(m.phase).toBe('dropping');
    tickMatch(m, 1, 8000);
    expect(m.phase).toBe('playing');
  });

  it('force-ends by max duration even with multiple alive', () => {
    const m = createMatch(['p1', 'p2', 'p3']);
    startCountdown(m, 0);
    tickMatch(m, 1, 5000);
    tickMatch(m, 1, 8000);
    expect(m.phase).toBe('playing');
    killPlayer(m, 'p1', 'p2');
    m.maxDuration = 1000;
    tickMatch(m, 1, 25 * 60 * 1000);
    expect(m.phase).toBe('ended');
    expect(m.winnerId).toBeDefined();
  });

  it('no-one-alive end picks last killer', () => {
    const m = createMatch(['p1', 'p2']);
    killPlayer(m, 'p2', 'p1');
    expect(m.phase).toBe('ended');
    expect(m.winnerId).toBe('p1');
  });
});

describe('damage and XP', () => {
  it('accumulates damage for alive players', () => {
    const m = createMatch(['p1', 'p2']);
    registerDamage(m, 'p1', 40);
    registerDamage(m, 'p1', 15);
    expect(m.players.p1.damage).toBe(55);
  });

  it('does not record damage for dead players', () => {
    const m = createMatch(['p1', 'p2']);
    killPlayer(m, 'p2', 'p1');
    registerDamage(m, 'p2', 50);
    expect(m.players.p2.damage).toBe(0);
  });

  it('XP includes damage contribution', () => {
    const m = createMatch(['p1', 'p2', 'p3']);
    registerDamage(m, 'p1', 100);
    killPlayer(m, 'p3', 'p1');
    killPlayer(m, 'p2', 'p1');
    const xp = calculateXP(m, 'p1');
    expect(xp).toBeGreaterThan(25 + 20 + 10);
  });

  it('transitions to results', () => {
    const m = createMatch(['p1', 'p2']);
    killPlayer(m, 'p2', 'p1');
    toResults(m);
    expect(m.phase).toBe('results');
  });

  it('records kill cause', () => {
    const m = createMatch(['p1', 'p2']);
    killPlayer(m, 'p2', 'p1', 'grenade');
    expect(m.lastKill?.cause).toBe('grenade');
    expect(m.lastKill?.victimId).toBe('p2');
  });
});
