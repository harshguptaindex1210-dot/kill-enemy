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
import { InputBatcher, InterpolationBuffer, type InterpolatedEntity } from './interpolation';
import { RollbackEngine, type InputFrame } from '../netcode';
import { isMobileDevice } from '../platform';
import {
  TICK_MS,
  encodeInput,
  decodeSnapshot,
  type WireInput,
  type WireSnapshot,
} from './protocol';
import { OP_SNAPSHOT } from './protocol';
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
  /** Server clock offset (performance.now - server time_ms) once calibrated. */
  private clockOffset: number | null = null;
  /** Input frames queued since the last 20 Hz client tick. */
  private pending = new InputBatcher<WireInput>();

  rollback: RollbackEngine;
  interp = new InterpolationBuffer();
  private selfEntity = 'player';
  private disconnected = false;

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

  get selfId(): string {
    return this.selfEntity;
  }

  get localServer(): LocalServer | null {
    return this.local;
  }

  async connect(): Promise<void> {
    if (this.mode === 'local') {
      this.local = new LocalServer(
        {
          onSnapshot: (snap) => this.handleSnapshot(snap),
          onEvents: this.cb.onEvents,
        },
        { botCount: isMobileDevice() ? 6 : 9 }
      );
      return;
    }
    this.session = getSession() ?? (await authenticateGuest());
    this.selfEntity = this.session.user_id;
    this.rollback = new RollbackEngine(this.selfEntity, new THREE.Vector3(0, 0.9, 0));
    this.socket = await connectSocket(this.session);
    onSocketDisconnect(this.socket, () => this.handleDisconnect());
    this.socket.onmatchdata = (m) => {
      if (m.op_code === OP_SNAPSHOT) {
        const snap = decodeSnapshot(m.data);
        this.handleSnapshot(snap);
      }
    };
  }

  /** Local: spawn the in-process server + start match. Online: create + join. */
  async startMatch(): Promise<string> {
    if (this.mode === 'local') {
      this.local!.start();
      // Bootstrap snapshot so the render loop has spawn pose before the first interval tick.
      this.local!.step();
      this.matchId = 'local-match';
    } else {
      this.matchId = await createMatchViaSocket(this.socket!);
      await joinMatch(this.socket!, this.matchId);
    }
    this.flushTimer = setInterval(() => this.flushInputs(), TICK_MS);
    return this.matchId;
  }

  /**
   * Online only: joins a match already created by the matchmaker hook (bot fill
   * caps at 10). Used by the "Play Online" flow (#40).
   */
  async joinExistingMatch(matchId: string): Promise<string> {
    this.matchId = matchId;
    await joinMatch(this.socket!, this.matchId);
    this.flushTimer = setInterval(() => this.flushInputs(), TICK_MS);
    return this.matchId;
  }

  /** Queue an input frame; sent at 20 Hz by flushInputs(). */
  sendInput(input: WireInput) {
    this.pending.push(input);
  }

  private flushInputs() {
    const frames = this.pending.flush();
    if (frames.length === 0) return;
    let merged = frames[frames.length - 1];
    if (frames.length > 1) {
      let sumMouseX = 0;
      let sumMouseY = 0;
      let fire = false;
      let reload = false;
      let jump = false;
      for (const f of frames) {
        sumMouseX += f.mouseX ?? 0;
        sumMouseY += f.mouseY ?? 0;
        if (f.fire) fire = true;
        if (f.reload) reload = true;
        if (f.jump) jump = true;
      }
      merged = {
        ...merged,
        mouseX: sumMouseX,
        mouseY: sumMouseY,
        fire,
        reload,
        jump,
      };
    }
    const input = { ...merged, seq: ++this.seq };
    // Demo/local server is authoritative in-process — client prediction fights MatchSim.
    if (this.mode !== 'local') {
      this.rollback.applyInput(this.toPredictionInput(input), 1 / 20, 0);
    }
    if (this.mode === 'local') {
      this.local?.sendInput(input);
    } else if (this.socket) {
      void sendMatchInput(this.socket, this.matchId, encodeInput(input));
    }
  }

  get latency(): number {
    return this.latencyMs;
  }

  private handleSnapshot(snap: WireSnapshot) {
    if (!snap || !snap.entities) return;
    this.interp.push(snap);
    this.measureLatency(snap);
    const self = snap.entities[this.selfEntity];
    if (self) {
      const pos = new THREE.Vector3(self.px / 100, self.py / 100, self.pz / 100);
      const vel = new THREE.Vector3(self.vx / 100, self.vy / 100, self.vz / 100);
      if (this.mode === 'local') {
        // Adopt server pose directly — no rollback replay in demo online mode.
        this.rollback.localState.pos.copy(pos);
        this.rollback.localState.vel.copy(vel);
        this.rollback.localState.health = self.hp;
        this.rollback.yaw = self.yaw / 100;
        const ack = snap.acks?.[this.selfEntity] ?? snap.tick;
        this.rollback.lastAckedTick = Math.max(this.rollback.lastAckedTick, ack);
        this.rollback.inputs = [];
      } else {
        this.rollback.applySnapshot({
          tick: snap.tick,
          entities: {
            [this.selfEntity]: { pos, vel, health: self.hp },
          },
          inputAck: snap.acks?.[this.selfEntity],
          yaw: self.yaw / 100,
        });
      }
    }
    this.cb.onSnapshot(snap);
  }

  /** Interpolated remote entities at server time `timeMs`. */
  sampleRemotes(timeMs: number): InterpolatedEntity[] | null {
    return this.interp.sample(timeMs);
  }

  /**
   * Estimates one-way latency from the server tick timestamp. The server clock
   * increment (serverWriterTime - serverReaderTick) is only meaningful when we
   * reuse the same RTT; calibrate an offset on the first snapshot, then measure
   * how far behind the latest snapshot is. Clamped non-negative.
   */
  private measureLatency(snap: WireSnapshot) {
    // Local server shares the process clock; skip measurement.
    if (this.mode !== 'online') return;
    const now = performance.now();
    if (this.clockOffset === null) {
      // First sample: assume the offset equals this snapshot's age. Subsequent
      // samples then drift as network delay changes.
      this.clockOffset = now - snap.time_ms;
      this.latencyMs = 0;
      return;
    }
    const delayed = now - snap.time_ms - this.clockOffset;
    this.latencyMs = Math.max(0, Math.round(delayed));
    this.cb.onLatency?.(this.latencyMs);
  }

  private handleDisconnect() {
    if (this.disconnected) return;
    this.disconnected = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.cb.onDisconnect();
  }

  private toPredictionInput(input: WireInput): InputFrame {
    return {
      seq: input.seq,
      forward: input.forward ?? false,
      backward: input.backward ?? false,
      left: input.left ?? false,
      right: input.right ?? false,
      sprint: input.sprint ?? false,
      jump: input.jump ?? false,
      aim: input.aim ?? false,
      mouseX: input.mouseX ?? 0,
      mouseY: input.mouseY ?? 0,
      fire: input.fire ?? false,
      reload: input.reload ?? false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
    };
  }

  dispose() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.local?.dispose();
    this.socket?.disconnect(false);
  }
}

export { getClient };
