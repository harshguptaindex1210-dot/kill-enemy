import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  allowDemoOnlineFallback,
  getNakamaConfig,
  isLocalBrowserHost,
  isLocalNakamaEndpoint,
  onlineUnavailableMessage,
} from '../src/net/nakamaConfig';

describe('nakamaConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to local dev Nakama endpoint', () => {
    expect(getNakamaConfig()).toEqual({
      host: '127.0.0.1',
      port: '7350',
      useSSL: false,
      serverKey: 'defaultkey',
    });
    expect(isLocalNakamaEndpoint()).toBe(true);
  });

  it('reads custom Nakama env vars', () => {
    vi.stubEnv('VITE_NAKAMA_HOST', 'nakama.example.com');
    vi.stubEnv('VITE_NAKAMA_PORT', '443');
    vi.stubEnv('VITE_NAKAMA_SSL', 'true');
    vi.stubEnv('VITE_NAKAMA_KEY', 'prod-key');
    expect(getNakamaConfig()).toEqual({
      host: 'nakama.example.com',
      port: '443',
      useSSL: true,
      serverKey: 'prod-key',
    });
    expect(isLocalNakamaEndpoint()).toBe(false);
  });

  it('allows demo online fallback on static hosts without Nakama', () => {
    expect(allowDemoOnlineFallback(getNakamaConfig(), 'harshguptaindex1210-dot.github.io')).toBe(
      true
    );
    expect(allowDemoOnlineFallback(getNakamaConfig(), 'localhost')).toBe(false);
  });

  it('forces demo fallback when VITE_ONLINE_DEMO=true', () => {
    vi.stubEnv('VITE_ONLINE_DEMO', 'true');
    expect(allowDemoOnlineFallback(getNakamaConfig(), 'localhost')).toBe(true);
  });

  it('builds actionable error messages', () => {
    expect(onlineUnavailableMessage(new Error('fetch failed'), getNakamaConfig(), 'localhost')).toBe(
      'Nakama not running — run: docker compose up -d, then Play Online'
    );
    expect(
      onlineUnavailableMessage(new Error('timeout'), getNakamaConfig(), 'game.example.com')
    ).toContain('Could not reach online server');
  });

  it('detects local browser hosts', () => {
    expect(isLocalBrowserHost('127.0.0.1')).toBe(true);
    expect(isLocalBrowserHost('localhost')).toBe(true);
    expect(isLocalBrowserHost('harshguptaindex1210-dot.github.io')).toBe(false);
  });
});
