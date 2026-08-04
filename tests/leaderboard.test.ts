import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const session = { user_id: 'user-1', isexpired: () => false };
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  clear: () => storage.clear(),
};

vi.mock('../src/net/nakama', () => ({
  getClient: () => ({ rpc }),
  getSession: () => session,
}));

import {
  appendLocalHistory,
  fetchLeaderboard,
  loadLocalHistory,
  mapLeaderboardRecords,
  recordMatchResult,
  topN,
} from '../src/net/leaderboard';

describe('leaderboard (#41)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    storage.clear();
    rpc.mockReset();
  });

  it('caps local match history at twenty newest records', () => {
    for (let i = 0; i < 21; i++) {
      appendLocalHistory({
        matchId: `match-${i}`,
        writeId: `write-${i}`,
        placement: i + 1,
        kills: 0,
        damage: 0,
        won: false,
        mode: 'local',
        timestamp: i,
      });
    }

    const history = loadLocalHistory();
    expect(history).toHaveLength(20);
    expect(history[0].matchId).toBe('match-20');
    expect(history.at(-1)?.matchId).toBe('match-1');
  });

  it('sorts top records without mutating input', () => {
    const records = [{ score: 1 }, { score: 3 }, { score: 2 }];
    expect(topN(records, (record) => record.score, 2)).toEqual([{ score: 3 }, { score: 2 }]);
    expect(records).toEqual([{ score: 1 }, { score: 3 }, { score: 2 }]);
  });

  it('maps Nakama records with safe defaults', () => {
    expect(
      mapLeaderboardRecords([{ owner_id: 'u1', username: 'robot', score: 999, subscore: 4 }])
    ).toEqual([{ ownerId: 'u1', username: 'robot', score: 999, kills: 4, placement: 0 }]);
  });

  it('records local matches without submitting to the seasonal board', async () => {
    await expect(
      recordMatchResult({
        matchId: 'local-1',
        placement: 1,
        kills: 3,
        damage: 100,
        won: true,
        mode: 'local',
      })
    ).resolves.toEqual({ local: true, online: false });

    expect(loadLocalHistory()).toHaveLength(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('submits online results and fetches the top ten through RPCs', async () => {
    rpc.mockResolvedValueOnce({ payload: { submitted: true } }).mockResolvedValueOnce({
      payload: {
        records: [{ ownerId: 'u1', username: 'robot', score: 999, kills: 2, placement: 1 }],
      },
    });

    await expect(
      recordMatchResult({
        matchId: 'online-1',
        placement: 1,
        kills: 2,
        damage: 80,
        won: true,
        mode: 'online',
      })
    ).resolves.toEqual({ local: true, online: true });

    await expect(fetchLeaderboard(50)).resolves.toEqual([
      { ownerId: 'u1', username: 'robot', score: 999, kills: 2, placement: 1 },
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, session, 'submit_score', expect.any(Object));
    expect(rpc).toHaveBeenNthCalledWith(2, session, 'list_leaderboard', { limit: 10 });
  });
});
