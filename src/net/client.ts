import * as THREE from 'three';
import type { Session } from '@heroiclabs/nakama-js';
import {
  connectSocket,
  createMatchViaSocket,
  getClient,
  getSession,
  joinMatch,
  sendMatchInput,
  onSocketDisconnect,
  authenticateGuest,
  type NakamaSocket,
} from './nakama';
import { LocalServer } from './localServer';
import { InterpolationBuffer, type InterpolatedEntity } from './interpolation';
import { RollbackEngine } from '../netcode';
import { TICK_MS, encodeInput, type WireInput, type WireSnapshot } from './protocol';
import type { SimEvent } from '../gameplay';

export type MatchMode = 'local' | 'online';

export interface MatchClientCallbacks {
  onSnapshot: (snap: WireSnapshot) => void;
  onDisconnect: () => void;
  onEvents?: (events: SimEvent[]) => void;
  onLatency?: (ms: number) => void;
}

/**
 * Unifies online (Nakama authoritative) and local (in-process server) play behind
 * one client path (#39). Sends inputs per tick, receives snapshots, feeds a
 * RollbackEngine for the local player and an InterpolationBuffer for remotes.
 */
export class MatchClient {
  mode: MatchMode;
  private cb: MatchClientCallbacks;
  private local: LocalServer | null = null;
  private socket: NakamaSocket | null = null;
  private session: Session | null = null;
  private matchId = '';
  private seq = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private latencyMs = 0;
  /** Input frames queued since the last flush. */
  private pending: WireInput[] = [];

  rollback: RollbackEngine;
  interp = new InterpolationBuffer();
  private selfEntity = 'player';

  constructor(mode: MatchMode, cb: MatchClientCallbacks) {
    this.mode = mode;
    this.cb = cb;
    this.rollback = new RollbackEngine(this.selfEntity, new THREE.Vector3(0, 0.9, 0));
  }

  get connected(): boolean {
    return this.mode === 'local' ? this.local !== null : this.socket !== null;
  }

  get matchIdString(): string {
    return this.matchId;
  }

  async connect(): Promise<void> {
    if (this.mode === 'local') {
      this.local = new LocalServer(
        {
          onSnapshot: (snap) => this.handleSnapshot(snap),
          onEvents: this.cb.onEvents,
        },
        { botCount: 9 }
      );
      return;
    }
    this.session = getSession() ?? (await authenticateGuest());
    this.socket = await connectSocket(this.session);
    onSocketDisconnect(this.socket, () => this.handleDisconnect());
  }

  /** Local: spawn the in-process server + start match. Online: create + join. */
  async startMatch(): Promise<string> {
    if (this.mode === 'local') {
      this.local!.start();
      return 'local-match';
    }
    this.matchId = await createMatchViaSocket(this.socket!);
    await joinMatch(this.socket!, this.matchId);
    this.flushTimer = setInterval(() => this.flushInputs(), TICK_MS);
    return this.matchId;
  }

  /** Queue an input frame; sent at 20 Hz by flushInputs(). */
  sendInput(input: WireInput) {
    this.pending.push(input);
  }

  /** Local mode: pull one server tick (used by the browser/sim driver). */
  stepLocal() {
    this.local?.step();
  }

  private flushInputs() {
    if (this.pending.length === 0) return;
    this.seq++;
    const latest = this.pending[this.pending.length - 1];
    this.pending = [];
    void sendMatchInput(this.socket!, this.matchId, encodeInput({ ...latest, seq: this.seq }));
  }

  get latency(): number {
    return this.latencyMs;
  }

  private handleSnapshot(snap: WireSnapshot) {
    if (!snap || !snap.entities) return;
    this.interp.push(snap);
    const self = snap.entities[this.selfEntity];
    if (self) {
      this.rollback.applySnapshot({
        tick: snap.tick,
        entities: {
          [this.selfEntity]: {
            pos: new THREE.Vector3(self.px / 100, self.py / 100, self.pz / 100),
            vel: new THREE.Vector3(self.vx / 100, self.vy / 100, self.vz / 100),
            health: self.hp,
          },
        },
      });
    }
    this.cb.onSnapshot(snap);
  }

  /** Interpolated remote entities at server time `timeMs`. */
  sampleRemotes(timeMs: number): InterpolatedEntity[] | null {
    return this.interp.sample(timeMs);
  }

  private handleDisconnect() {
    this.cb.onDisconnect();
  }

  dispose() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.local?.dispose();
    this.socket?.disconnect(false);
  }
}

export { getClient };
