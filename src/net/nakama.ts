import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';

let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;

export type NakamaSocket = Socket;

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

/** Connects a realtime socket for match play. */
export async function connectSocket(s: Session): Promise<Socket> {
  if (socket) return socket;
  socket = getClient().createSocket(false, false);
  await socket.connect(s, false);
  return socket;
}

export async function disconnectSocket() {
  if (socket) {
    socket.disconnect(false);
    socket = null;
  }
}

/** Registers a disconnect handler; returns a cleanup fn. */
export function onSocketDisconnect(s: Socket, cb: () => void): () => void {
  s.ondisconnect = cb;
  return () => {
    s.ondisconnect = () => {};
  };
}

/** Creates an authoritative match via socket.createMatch() and returns its id. */
export async function createMatchViaSocket(s: Socket): Promise<string> {
  const match = await s.createMatch();
  return match.match_id;
}

/** Joins an existing authoritative match. */
export async function joinMatch(s: Socket, matchId: string) {
  await s.joinMatch(matchId);
}

/** Sends an input frame (JSON string) to the match on OP_INPUT. */
export async function sendMatchInput(s: Socket, matchId: string, data: string) {
  await s.sendMatchState(matchId, 1, data);
}

/**
 * Joins the matchmaking queue for an online match (#40). Returns the ticket so
 * the client can cancel via removeFromMatchmaker.
 */
export async function addToMatchmaker(s: Socket): Promise<string> {
  const matched = await s.addMatchmaker('*', 2, 10);
  return matched.ticket;
}

/** Leaves the matchmaking queue by ticket. */
export async function removeFromMatchmaker(s: Socket, ticket: string) {
  await s.removeMatchmaker(ticket);
}

/** Registers the handler for a successful matchmaker match; returns cleanup. */
export function onMatchmakerMatched(s: Socket, cb: (matchId: string) => void): () => void {
  s.onmatchmakermatched = (m) => {
    if (m && m.match_id) cb(m.match_id);
  };
  return () => {
    s.onmatchmakermatched = () => {};
  };
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
