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
  /** Confirmed state from the last snapshot, used as replay base (INV-2). */
  private baseState: EntityState;

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
    this.step(this.localState, input, dt, groundY);
    this.tick++;
  }

  /**
   * Reconciliation replay: snap local state to the confirmed server state, then
   * re-simulate every unacked input (seq > snapshot.tick) on top of it.
   */
  reconcile(snapshot: Snapshot, dt = 1 / 20, groundY = 0) {
    const serverEnt = snapshot.entities[this.entityId];
    if (!serverEnt) return;

    this.lastAckedTick = Math.max(this.lastAckedTick, snapshot.tick);
    this.baseState.pos.copy(serverEnt.pos);
    this.baseState.vel.copy(serverEnt.vel);
    this.baseState.health = serverEnt.health;

    this.localState.pos.copy(serverEnt.pos);
    this.localState.vel.copy(serverEnt.vel);
    this.localState.health = serverEnt.health;

    for (const inp of this.inputs) {
      if (inp.seq > snapshot.tick) this.step(this.localState, inp, dt, groundY);
    }
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
      this.lastAckedTick = Math.max(this.lastAckedTick, snapshot.tick);
    }
  }

  /** Single movement step used by both prediction and replay. */
  private step(state: EntityState, input: InputFrame, dt: number, groundY: number) {
    const speed = input.sprint ? 9 : 6;
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const move = new THREE.Vector3();
    if (input.forward) move.add(forward);
    if (input.backward) move.sub(forward);
    if (input.left) move.sub(right);
    if (input.right) move.add(right);
    if (move.length() > 0) move.normalize().multiplyScalar(speed);

    state.vel.x = move.x;
    state.vel.z = move.z;
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
