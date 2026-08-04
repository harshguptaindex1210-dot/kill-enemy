import { describe, it, expect } from 'vitest';
import {
  makeKillFeedEntry,
  formatCompassBearing,
  formatTimer,
  formatPlacement,
  hitMarkerClass,
  xpForPlacement,
} from '../src/feedback';

describe('feedback pure helpers (#31)', () => {
  it('builds a kill feed entry with id/cause/time', () => {
    const e = makeKillFeedEntry('a', 'b', 'shot', 1234);
    expect(e.killerId).toBe('a');
    expect(e.victimId).toBe('b');
    expect(e.cause).toBe('shot');
    expect(e.time).toBe(1234);
    expect(e.id).toBeGreaterThan(0);
  });

  it('formats compass bearings for all eight directions', () => {
    expect(formatCompassBearing(0)).toBe('N');
    expect(formatCompassBearing(Math.PI / 4)).toBe('NE');
    expect(formatCompassBearing(Math.PI / 2)).toBe('E');
    expect(formatCompassBearing(Math.PI)).toBe('S');
    expect(formatCompassBearing(-Math.PI / 2)).toBe('W');
    expect(formatCompassBearing((3 * Math.PI) / 4)).toBe('SE');
  });

  it('formats the match timer as M:SS', () => {
    expect(formatTimer(0)).toBe('0:00');
    expect(formatTimer(61000)).toBe('1:01');
    expect(formatTimer(-100)).toBe('0:00');
  });

  it('formats placements with ordinal suffixes', () => {
    expect(formatPlacement(1)).toBe('1st');
    expect(formatPlacement(2)).toBe('2nd');
    expect(formatPlacement(3)).toBe('3rd');
    expect(formatPlacement(4)).toBe('4th');
  });

  it('classifies hit markers by hit and kill', () => {
    expect(hitMarkerClass(false, false)).toBe('none');
    expect(hitMarkerClass(true, false)).toBe('hit');
    expect(hitMarkerClass(true, true)).toBe('kill');
  });

  it('grants placement XP down to a floor of 10', () => {
    expect(xpForPlacement(10, 1)).toBe(100);
    expect(xpForPlacement(10, 10)).toBe(10);
    expect(xpForPlacement(5, 5)).toBe(10);
  });
});
