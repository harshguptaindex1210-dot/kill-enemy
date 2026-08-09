import { describe, it, expect, vi, afterEach } from 'vitest';

describe('siteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes canonical direct play/share URLs', async () => {
    vi.stubEnv('VITE_CACHE_BUST', '');
    const { GAME_PLAY_URL, GAME_SHARE_URL, GAME_SHARE_TEXT } = await import('../src/siteUrl');
    expect(GAME_PLAY_URL).toBe('https://harshguptaindex1210-dot.github.io/kill-enemy/');
    expect(GAME_SHARE_URL).toBe(GAME_PLAY_URL);
    expect(GAME_SHARE_TEXT).toContain(GAME_SHARE_URL);
  });

  it('appends deploy cache-bust when VITE_CACHE_BUST is set', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CACHE_BUST', 'abcdef1234567890');
    const { GAME_PLAY_URL } = await import('../src/siteUrl');
    expect(GAME_PLAY_URL).toBe('https://harshguptaindex1210-dot.github.io/kill-enemy/?v=abcdef1');
  });
});
