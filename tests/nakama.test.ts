import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGuestSession = {
  token: 'fake-token',
  user_id: 'u1',
  username: 'guest',
  created_at: 0,
  expires_at: 9999999999,
  vars: {},
  isexpired: () => false,
};
const mockEmailSession = {
  token: 'email-token',
  user_id: 'u2',
  username: 'test',
  created_at: 0,
  expires_at: 9999999999,
  vars: {},
  isexpired: () => false,
};
const mockRestoredSession = {
  token: 'restored-token',
  user_id: 'u1',
  username: 'guest',
  created_at: 0,
  expires_at: 9999999999,
  vars: {},
  isexpired: () => false,
};

vi.mock('@heroiclabs/nakama-js', () => ({
  Client: vi.fn().mockImplementation((_key, _host, _port, _ssl) => ({
    useSSL: _ssl ?? false,
    authenticateCustom: vi.fn().mockResolvedValue(mockGuestSession),
    authenticateEmail: vi.fn().mockResolvedValue(mockEmailSession),
    writeStorageObjects: vi.fn().mockResolvedValue([{ key: 'ok' }]),
  })),
  Session: { restore: vi.fn().mockReturnValue(mockRestoredSession) },
}));

describe('nakama client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('authenticates as guest', async () => {
    const { authenticateGuest } = await import('../src/net/nakama');
    const s = await authenticateGuest();
    expect(s.token).toBe('fake-token');
  });

  it('authenticates with email', async () => {
    const { authenticateEmail } = await import('../src/net/nakama');
    const s = await authenticateEmail('test@test.com', 'password');
    expect(s.token).toBe('email-token');
  });

  it('reconnects with existing token', async () => {
    const { reconnectSession } = await import('../src/net/nakama');
    const s = await reconnectSession('old-token');
    expect(s?.token).toBe('restored-token');
  });

  it('writes stats to storage after auth with a write id', async () => {
    const nakama = await import('../src/net/nakama');
    await nakama.authenticateGuest();
    const written = await nakama.saveStatsToServer(
      'u1',
      { wins: 1, kills: 3, matches: 1, xp: 120, level: 1, damage: 100 },
      'write_123'
    );
    expect(written).toBe(true);
  });

  it('skips server write when unauthenticated', async () => {
    const nakama = await import('../src/net/nakama');
    const written = await nakama.saveStatsToServer(
      'u1',
      { wins: 0, kills: 0, matches: 0, xp: 0, level: 1, damage: 0 },
      'write_456'
    );
    expect(written).toBe(false);
  });
});
