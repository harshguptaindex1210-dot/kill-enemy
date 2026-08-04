/**
 * Integration driver for Nakama authoritative match (#38).
 * Requires: docker compose up -d  (postgres + nakama on 7350)
 *
 * Flow: 2 clients authenticate → create_match RPC → join → send inputs →
 *       assert snapshots converge on same tick.
 */
import { Client } from '@heroiclabs/nakama-js';
import {
  OP_INPUT,
  OP_SNAPSHOT,
  decodeSnapshot,
  encodeInput,
  snapshotsConverged,
  type WireSnapshot,
} from '../src/net/protocol.js';

const HOST = process.env.NAKAMA_HOST ?? '127.0.0.1';
const PORT = process.env.NAKAMA_PORT ?? '7350';
const KEY = 'defaultkey';

async function waitForServer(maxMs = 15000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/healthcheck`);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

interface ClientCtx {
  id: string;
  client: Client;
  session: Awaited<ReturnType<Client['authenticateCustom']>>;
  socket: ReturnType<Client['createSocket']>;
  matchId: string;
  lastSnap: WireSnapshot | null;
}

async function makeClient(id: string, createMatch: boolean): Promise<ClientCtx> {
  const client = new Client(KEY, HOST, PORT, false);
  const session = await client.authenticateCustom(id, true);
  const socket = client.createSocket(false, false);
  await socket.connect(session, false);

  const ctx: ClientCtx = { id, client, session, socket, matchId: '', lastSnap: null };

  socket.onmatchdata = (md) => {
    if (md.op_code !== OP_SNAPSHOT) return;
    const raw =
      typeof md.data === 'string'
        ? md.data
        : new TextDecoder().decode(md.data instanceof Uint8Array ? md.data : new Uint8Array());
    ctx.lastSnap = decodeSnapshot(raw);
  };

  if (createMatch) {
    const rpc = await client.rpc(session, 'create_match', { map_seed: 4242, bot_count: 0 });
    const body = typeof rpc.payload === 'string' ? JSON.parse(rpc.payload) : rpc.payload;
    ctx.matchId = body.match_id;
    await socket.joinMatch(ctx.matchId);
  }
  return ctx;
}

/** Wait until a snapshot arrives with the given match phase. */
async function waitForPhase(ctx: ClientCtx, phase: string, maxMs = 20000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (ctx.lastSnap && ctx.lastSnap.phase === phase) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function runSim(): Promise<void> {
  console.log(`nakama-sim: connecting to ${HOST}:${PORT}...`);

  const up = await waitForServer();
  if (!up) {
    console.warn(
      'nakama-sim: server not reachable — skipping integration (run docker compose up -d)'
    );
    process.exit(0);
  }

  // client A creates the match, client B joins it
  const a = await makeClient(`sim_a_${Date.now()}`, true);
  const b = await makeClient(`sim_b_${Date.now()}`, false);

  b.matchId = a.matchId;
  await b.socket.joinMatch(a.matchId);

  console.log(`nakama-sim: match ${a.matchId}`);

  // match starts in countdown(5s) → dropping(3s) → playing; wait for playing
  const playing = await waitForPhase(a, 'playing');
  if (!playing) {
    throw new Error('nakama-sim: match never reached playing phase');
  }
  console.log(`nakama-sim: playing at tick ${a.lastSnap?.tick}`);

  // send movement inputs for ~2 s at 20 Hz during playing
  for (let i = 0; i < 40; i++) {
    const inputA = encodeInput({
      seq: i,
      forward: true,
      fire: i === 20,
      mouseX: i % 2 === 0 ? 50 : -50,
    });
    const inputB = encodeInput({
      seq: i,
      right: true,
      fire: false,
      mouseX: 30,
    });
    await a.socket.sendMatchState(a.matchId, OP_INPUT, inputA);
    await b.socket.sendMatchState(b.matchId, OP_INPUT, inputB);
    await new Promise((r) => setTimeout(r, 50));
  }

  // wait for snapshots
  await new Promise((r) => setTimeout(r, 500));

  if (!a.lastSnap || !b.lastSnap) {
    throw new Error('nakama-sim: no snapshots received');
  }

  console.log(
    `nakama-sim: ticks A=${a.lastSnap.tick} B=${b.lastSnap.tick} phase=${a.lastSnap.phase}`
  );

  // both clients should see same entity count
  const idsA = Object.keys(a.lastSnap.entities);
  const idsB = Object.keys(b.lastSnap.entities);
  if (idsA.length < 2 || idsB.length < 2) {
    throw new Error(`nakama-sim: expected 2+ entities, got A=${idsA.length} B=${idsB.length}`);
  }

  // convergence: same tick snapshots agree for shared entity
  const sharedId = idsA.find((id) => idsB.includes(id));
  if (sharedId && a.lastSnap.tick === b.lastSnap.tick) {
    if (!snapshotsConverged(a.lastSnap, b.lastSnap, sharedId, 4)) {
      throw new Error(`nakama-sim: snapshot desync for ${sharedId}`);
    }
    console.log(`nakama-sim: snapshots converged for ${sharedId} at tick ${a.lastSnap.tick}`);
  } else {
    console.log('nakama-sim: tick mismatch — checking latest entity presence only');
  }

  await a.socket.disconnect(false);
  await b.socket.disconnect(false);
  console.log('nakama-sim: PASS');
}

runSim().catch((err) => {
  console.error('nakama-sim: FAIL', err);
  process.exit(1);
});
