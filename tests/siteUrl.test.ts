import { describe, it, expect } from 'vitest';
import { GAME_PLAY_URL, GAME_SHARE_URL, GAME_SHARE_TEXT } from '../src/siteUrl';

describe('siteUrl', () => {
  it('exposes canonical direct play/share URLs', () => {
    expect(GAME_PLAY_URL).toBe('https://harshguptaindex1210-dot.github.io/kill-enemy/');
    expect(GAME_SHARE_URL).toBe(GAME_PLAY_URL);
    expect(GAME_SHARE_TEXT).toContain(GAME_SHARE_URL);
  });
});
