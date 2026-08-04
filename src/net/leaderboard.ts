import { createWriteId } from '../persistence';

export interface MatchRecord {
  matchId: string;
  writeId: string;
  placement: number;
  kills: number;
  damage: number;
  won: boolean;
  mode: 'local' | 'online';
  timestamp: number;
}

export interface LeaderboardEntry {
  ownerId: string;
  username: string;
  score: number;
  kills: number;
  placement: number;
}

export const LEADERBOARD_ID = 'robot_arena_season_1';
const HISTORY_KEY = 'robot_arena_history_v1';
const MAX_HISTORY = 20;

/** Tracks submitted writeIds so a retried (INV-6) submission never double-counts. */
const submittedWriteIds = new Set<string>();

/** Lazy-load nakama so local play never pulls the socket client into the entry chunk. */
async function nakamaApi() {
  return import('./nakama');
}

/** Appends a match record to the local history log (capped). */
export function appendLocalHistory(record: MatchRecord): MatchRecord[] {
  let history = loadLocalHistory();
  history = [record, ...history].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore write failures
  }
  return history;
}

export function loadLocalHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MatchRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Sorts records by a numeric key, descending, and returns the top N. */
export function topN<T>(records: T[], key: (r: T) => number, n: number): T[] {
  return [...records].sort((a, b) => key(b) - key(a)).slice(0, n);
}

/**
 * Records a finished match. Always appends to local history; when authenticated
 * online, also submits to the Nakama seasonal leaderboard. Idempotent per
 * writeId (INV-6). Returns { local: true, online: boolean }.
 */
export async function recordMatchResult(
  partial: Omit<MatchRecord, 'writeId' | 'timestamp'>
): Promise<{ local: boolean; online: boolean }> {
  const writeId = createWriteId();
  const record: MatchRecord = { ...partial, writeId, timestamp: Date.now() };
  appendLocalHistory(record);

  if (record.mode !== 'online') return { local: true, online: false };
  return submitOnlineMatchRecord(record);
}

/**
 * Submits an existing online record. Keeping the write ID on the record makes
 * retrying safe across a transient request failure.
 */
export async function submitOnlineMatchRecord(
  record: MatchRecord
): Promise<{ local: boolean; online: boolean }> {
  const { getClient, getSession } = await nakamaApi();
  const s = getSession();
  if (!s || !s.user_id) return { local: true, online: false };
  if (submittedWriteIds.has(record.writeId)) return { local: true, online: true };

  try {
    await getClient().rpc(s, 'submit_score', {
      writeId: record.writeId,
      placement: record.placement,
      kills: record.kills,
      damage: record.damage,
      won: record.won,
      mode: record.mode,
    });
    submittedWriteIds.add(record.writeId);
    return { local: true, online: true };
  } catch {
    return { local: true, online: false };
  }
}

/** Maps a Nakama leaderboard record list to local entries. */
export function mapLeaderboardRecords(
  records: {
    owner_id?: string;
    username?: string;
    score?: number;
    subscore?: number;
    metadata?: object;
  }[]
): LeaderboardEntry[] {
  return records.map((r) => {
    const meta = (r.metadata ?? {}) as { placement?: number };
    return {
      ownerId: r.owner_id ?? '?',
      username: r.username ?? r.owner_id ?? '?',
      score: r.score ?? 0,
      kills: r.subscore ?? 0,
      placement: meta.placement ?? 0,
    };
  });
}

/** Fetches the top `limit` leaderboard records; returns [] when offline. */
export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const { getClient, getSession } = await nakamaApi();
  const s = getSession();
  if (!s || !s.user_id) return [];
  try {
    const response = await getClient().rpc(s, 'list_leaderboard', {
      limit: Math.max(1, Math.min(limit, 10)),
    });
    const payload = response.payload as { records?: LeaderboardEntry[] } | undefined;
    return payload?.records ?? [];
  } catch {
    return [];
  }
}
