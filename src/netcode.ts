import * as THREE from 'three';

export interface InputFrame {
  seq: number;
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  aim: boolean;
  mouseX: number;
  mouseY: number;
  fire: boolean;
  reload: boolean;
  weapon1: boolean;
  weapon2: boolean;
  weapon3: boolean;
}

export interface Snapshot {
  tick: number;
  /** Last client input sequence the server applied for this snapshot. */
  inputAck?: number;
  /** Optional server-authoritative yaw for the local entity (radians). */
  yaw?: number;
  entities: Record<string, { pos: THREE.Vector3; vel: THREE.Vector3; health: number }>;
}

export interface EntityState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  health: number;
}

export class RollbackEngine {
  tick = 0;
  inputs: InputFrame[] = [];
  snapshots: Snapshot[] = [];
  localState: EntityState;
  predictedStates: EntityState[] = [];
  /** Latest server-confirmed tick; inputs with seq <= this are acked. */
  lastAckedTick = -1;
  /** Predicted yaw (accumulated from mouseX). Server snapshot may correct. */
  yaw = 0;
  /** Confirmed state from the last snapshot, used as replay base (INV-2). */
  private baseState: EntityState;
  private baseYaw = 0;
  private readonly mouseSensitivity = 0.002;

  constructor(
    public entityId: string,
    startPos: THREE.Vector3
  ) {
    this.localState = { pos: startPos.clone(), vel: new THREE.Vector3(), health: 100 };
    this.baseState = {
      pos: startPos.clone(),
      vel: new THREE.Vector3(),
      health: 100,
    };
  }

  /** Applies an input frame to the local prediction state (no server dependency). */
  applyInput(input: InputFrame, dt: number, groundY: number) {
    this.inputs.push(input);
    this.yaw = wrapAngle(this.yaw - input.mouseX * this.mouseSensitivity);
    this.step(this.localState, input, dt, groundY, this.yaw);
    this.tick++;
  }

  /**
   * Reconciliation replay: snap local state to the confirmed server state, then
   * re-simulate every unacked input (seq > snapshot.tick) on top of it.
   */
  reconcile(snapshot: Snapshot, dt = 1 / 20, groundY = 0) {
    const serverEnt = snapshot.entities[this.entityId];
    if (!serverEnt) return;

    const ack = snapshot.inputAck ?? snapshot.tick;
    this.lastAckedTick = Math.max(this.lastAckedTick, ack);
    this.baseState.pos.copy(serverEnt.pos);
    this.baseState.vel.copy(serverEnt.vel);
    this.baseState.health = serverEnt.health;
    if (snapshot.yaw !== undefined) this.baseYaw = snapshot.yaw;

    this.localState.pos.copy(serverEnt.pos);
    this.localState.vel.copy(serverEnt.vel);
    this.localState.health = serverEnt.health;
    let replayYaw = this.baseYaw;

    for (const inp of this.inputs) {
      if (inp.seq > ack) {
        replayYaw = wrapAngle(replayYaw - inp.mouseX * this.mouseSensitivity);
        this.step(this.localState, inp, dt, groundY, replayYaw);
      }
    }
    this.yaw = replayYaw;
    this.inputs = this.inputs.filter((input) => input.seq > ack);
    this.predictedStates.push({
      pos: this.localState.pos.clone(),
      vel: this.localState.vel.clone(),
      health: this.localState.health,
    });
  }

  applySnapshot(snapshot: Snapshot) {
    this.snapshots.push(snapshot);
    const serverEnt = snapshot.entities[this.entityId];
    if (!serverEnt) return;

    const local = this.localState;
    const server = serverEnt;
    const diff = local.pos.distanceTo(server.pos);

    if (diff > 0.5) {
      this.reconcile(snapshot);
    } else {
      // small drift: adopt server health only, keep prediction
      local.health = server.health;
      const ack = snapshot.inputAck ?? snapshot.tick;
      this.lastAckedTick = Math.max(this.lastAckedTick, ack);
      this.inputs = this.inputs.filter((input) => input.seq > ack);
    }
  }

  /**
   * Single movement step used by both prediction and replay. Mirrors
   * src/player.ts: forward is yaw-rotated (-sin(yaw), 0, -cos(yaw)); right is
   * (forward.z, 0, -forward.x). This must match the server sim or reconciliation
   * will fight the client every tick.
   */
  private step(state: EntityState, input: InputFrame, dt: number, groundY: number, yaw = 0) {
    const speed = input.sprint ? 9 : 6;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rgtX = fwdZ;
    const rgtZ = -fwdX;

    let mx = 0;
    let mz = 0;
    if (input.forward) {
      mx += fwdX;
      mz += fwdZ;
    }
    if (input.backward) {
      mx -= fwdX;
      mz -= fwdZ;
    }
    if (input.left) {
      mx -= rgtX;
      mz -= rgtZ;
    }
    if (input.right) {
      mx += rgtX;
      mz += rgtZ;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
    }

    state.vel.x = mx;
    state.vel.z = mz;
    if (input.jump && state.pos.y <= groundY + 0.9) {
      state.vel.y = 5;
    }
    state.vel.y -= 20 * dt;

    state.pos.x += state.vel.x * dt;
    state.pos.y += state.vel.y * dt;
    state.pos.z += state.vel.z * dt;

    if (state.pos.y < groundY + 0.9) {
      state.pos.y = groundY + 0.9;
      state.vel.y = 0;
    }
  }
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createBotInput(
  seq: number,
  targetPos: THREE.Vector3,
  currentPos: THREE.Vector3
): InputFrame {
  const dx = targetPos.x - currentPos.x;
  const dz = targetPos.z - currentPos.z;
  return {
    seq,
    forward: dz < 0,
    backward: dz > 0,
    left: dx < 0,
    right: dx > 0,
    sprint: false,
    jump: false,
    aim: false,
    mouseX: 0,
    mouseY: 0,
    fire: false,
    reload: false,
    weapon1: false,
    weapon2: false,
    weapon3: false,
  };
}
