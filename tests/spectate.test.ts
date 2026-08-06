import { describe, it, expect } from 'vitest';
import { resolveSpectateTarget } from '../src/game';

describe('spectate target resolution', () => {
  it('cycles to the next alive unit on F press', () => {
    const alive = ['bot_1', 'bot_2', 'bot_3'];
    expect(resolveSpectateTarget('bot_1', alive)).toBe('bot_2');
    expect(resolveSpectateTarget('bot_2', alive)).toBe('bot_3');
    expect(resolveSpectateTarget('bot_3', alive)).toBe('bot_1');
  });

  it('auto-advances when current target is dead or missing', () => {
    const alive = ['bot_2', 'bot_3'];
    expect(resolveSpectateTarget('bot_1', alive)).toBe('bot_2');
    expect(resolveSpectateTarget(null, alive)).toBe('bot_2');
  });

  it('returns null when no alive targets remain', () => {
    expect(resolveSpectateTarget('bot_1', [])).toBeNull();
  });
});
