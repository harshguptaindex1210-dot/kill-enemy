import { describe, it, expect } from 'vitest';
import {
  botFillCount,
  matchLabel,
  parseMatchLabel,
  MATCH_CAP,
  MATCHMAKER_MIN,
  MATCHMAKER_MAX,
} from '../src/net/matchmaking';

describe('matchmaking + bot fill (#40)', () => {
  it('fills remaining slots so lobby reaches 10', () => {
    expect(botFillCount(1)).toBe(9);
    expect(botFillCount(2)).toBe(8);
    expect(botFillCount(10)).toBe(0);
    expect(botFillCount(0)).toBe(10);
  });

  it('clamps over-capacity human counts', () => {
    expect(botFillCount(15)).toBe(0);
    expect(botFillCount(-3)).toBe(10);
  });

  it('match label encodes mode for lobby/debug', () => {
    expect(matchLabel('online')).toBe('battle-royale|online');
    expect(matchLabel('local')).toBe('battle-royale|local');
    expect(parseMatchLabel('battle-royale|online').mode).toBe('online');
    expect(parseMatchLabel('battle-royale|local').mode).toBe('local');
  });

  it('matchmaker allows solo queue and caps at 10', () => {
    expect(MATCHMAKER_MIN).toBe(1);
    expect(MATCHMAKER_MAX).toBe(MATCH_CAP);
    expect(MATCH_CAP).toBe(10);
  });
});
