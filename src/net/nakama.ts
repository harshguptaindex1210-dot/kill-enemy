import { Client, Session } from '@heroiclabs/nakama-js';

let client: Client | null = null;
let session: Session | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client('defaultkey', '127.0.0.1', '7350', false);
  }
  return client;
}

export async function authenticateGuest(): Promise<Session> {
  const c = getClient();
  const id = `guest_${Math.random().toString(36).slice(2, 10)}`;
  session = await c.authenticateCustom(id);
  return session;
}

export async function authenticateEmail(email: string, password: string): Promise<Session> {
  const c = getClient();
  session = await c.authenticateEmail(email, password);
  return session;
}

export async function reconnectSession(token: string): Promise<Session | null> {
  try {
    session = Session.restore(token);
    return session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (session && session.isexpired(Date.now() / 1000)) {
    session = null;
  }
  return session;
}

export interface ServerStats {
  wins: number;
  kills: number;
  matches: number;
  xp: number;
  level: number;
  damage: number;
}

/**
 * Writes player stats to Nakama storage, idempotent per writeId (INV-6).
 * Returns false when offline/unauthenticated so callers can fall back to local.
 */
export async function saveStatsToServer(
  userId: string,
  stats: ServerStats,
  writeId: string
): Promise<boolean> {
  const s = getSession();
  if (!s || !s.user_id) return false;
  try {
    await getClient().writeStorageObjects(s, [
      {
        collection: 'player_data',
        key: `${userId}_${writeId}`,
        value: { userId, writeId, stats },
        permission_read: 2,
        permission_write: 0,
      },
    ]);
    return true;
  } catch {
    return false;
  }
}
