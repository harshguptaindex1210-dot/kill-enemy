import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  decodeSnapshot,
  encodeInput,
  entityWorld,
  quantize,
  snapshotsConverged,
  type WireSnapshot,
} from '../src/net/protocol';
import { InterpolationBuffer, InputBatcher } from '../src/net/interpolation';
import { RollbackEngine, type InputFrame } from '../src/netcode';
import { MatchClient } from '../src/net/client';

function makeSnap(overrides: Partial<WireSnapshot> & { tick: number }): WireSnapshot {
  return {
    time_ms: overrides.tick * 50,
    phase: 'playing',
    alive: 2,
    zone: { cx: 0, cz: 0, r: 40000, dps: 1, phase: 1 },
    entities: {},
    loot: [],
    ...overrides,
  };
}

function entity(px: number, pz: number, opts: Partial<Record<string, number>> = {}) {
  return {
    px: quantize(px),
    py: quantize(0.9),
    pz: quantize(pz),
    vx: 0,
    vy: 0,
    vz: 0,
    hp: 100,
    ar: 0,
    al: 1,
    yaw: 0,
    ...opts,
  };
}

function frame(seq: number, patch: Partial<InputFrame> = {}): InputFrame {
  return {
    seq,
    forward: false,
    backward: false,
    left: false,
    right: false,
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
    ...patch,
  };
}

describe('#39 snapshot deserialization', () => {
  it('decodes a wire snapshot into world coordinates', () => {
    const snap = makeSnap({
      tick: 4,
      entities: { u1: entity(10, -20, { hp: 70, yaw: quantize(1.5) }) },
    });
    const decoded = decodeSnapshot(JSON.stringify(snap));
    const w = entityWorld(decoded.entities.u1);
    expect(w.x).toBe(10);
    expect(w.z).toBe(-20);
    expect(w.health).toBe(70);
    expect(w.yaw).toBeCloseTo(1.5, 2);
  });

  it('encodes an input frame as JSON with seq', () => {
    const raw = encodeInput({ seq: 9, forward: true, mouseX: 120 });
    expect(JSON.parse(raw)).toMatchObject({ seq: 9, forward: true, mouseX: 120 });
  });

  it('snapshotsConverged only accepted when within tolerance on matching tick', () => {
    const a = makeSnap({
      tick: 2,
      entities: { p1: entity(5, 0) },
    });
    const b = makeSnap({
      tick: 2,
      entities: { p1: entity(5, 4) }, // 4m difference
    });
    const c = makeSnap({
      tick: 3,
      entities: { p1: entity(5, 0) },
    });
    expect(snapshotsConverged(a, b, 'p1', 5)).toBe(true);
    expect(snapshotsConverged(a, b, 'p1', 2)).toBe(false);
    expect(snapshotsConverged(a, c, 'p1', 5)).toBe(false);
  });
});

describe('#39 interpolation buffer', () => {
  it('returns null before any snapshot', () => {
    const buf = new InterpolationBuffer();
    expect(buf.sample(0)).toBeNull();
    expect(buf.latest).toBeNull();
  });

  it('flattens a single snapshot for all entities', () => {
    const buf = new InterpolationBuffer();
    buf.push(makeSnap({ tick: 1, entities: { p1: entity(1, 2) } }));
    const out = buf.sample(50);
    expect(out).not.toBeNull();
    expect(out![0]).toMatchObject({ id: 'p1', x: 1, z: 2, alive: true });
  });

  it('interpolates between bracketing snapshots', () => {
    const buf = new InterpolationBuffer();
    // tick 1 at t=50ms, tick 2 at t=100ms
    buf.push(makeSnap({ tick: 1, entities: { p1: entity(0, 0) } }));
    buf.push(makeSnap({ tick: 2, entities: { p1: entity(2, 0) } }));
    const mid = buf.sample(75); // halfway
    expect(mid![0].x).toBeCloseTo(1, 1); // 0 -> 2m, halfway = 1m
  });

  it('trims old snapshots beyond the buffer window', () => {
    const buf = new InterpolationBuffer();
    for (let tick = 1; tick <= 30; tick++) {
      buf.push(makeSnap({ tick, entities: { p1: entity(tick * 10, 0) } }));
    }
    expect(buf.latest!.tick).toBe(30);
  });
});

describe('#39 input batching', () => {
  it('accumulates inputs until flushed', () => {
    const batcher = new InputBatcher();
    batcher.push({ seq: 1 });
    batcher.push({ seq: 2 });
    expect(batcher.pending).toBe(2);
    const batch = batcher.flush();
    expect(batch).toEqual([{ seq: 1 }, { seq: 2 }]);
    expect(batcher.pending).toBe(0);
  });

  it('returns empty on flush when idle', () => {
    const batcher = new InputBatcher();
    expect(batcher.flush()).toEqual([]);
  });
});

describe('#39 reconciliation replay', () => {
  it('replays unacked inputs on top of a server snapshot', () => {
    const engine = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    // client predicted forward twice (seq 1, 2)
    engine.applyInput(frame(1, { forward: true }), 1 / 20, 0);
    engine.applyInput(frame(2, { forward: true }), 1 / 20, 0);
    const predictedZ = engine.localState.pos.z;
    expect(predictedZ).toBeLessThan(0);

    // server says we only got to z=-0.5 (corroborates seq 1, rejects 2)
    const serverPos = new THREE.Vector3(0, 0.9, -0.5);
    engine.reconcile(
      {
        tick: 500,
        inputAck: 1,
        entities: { p1: { pos: serverPos, vel: new THREE.Vector3(), health: 100 } },
      },
      1 / 20,
      0
    );

    // state rewound to server, then seq 2 reapplied
    expect(engine.localState.pos.x).toBe(0);
    expect(engine.localState.pos.z).toBeLessThan(-0.5);
    expect(engine.lastAckedTick).toBe(1);
  });

  it('predicts forward relative to yaw so server does not fight the client', () => {
    const engine = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    // Rotate yaw to +pi/2 via mouseX (sensitivity 0.002; negative mouseX increases yaw).
    const mouseX = -Math.PI / 2 / 0.002;
    engine.applyInput(frame(1, { forward: true, mouseX }), 1 / 20, 0);
    expect(engine.yaw).toBeCloseTo(Math.PI / 2, 3);
    // Forward vector = (-sin(yaw), 0, -cos(yaw)) = (-1, 0, 0) at yaw=+pi/2.
    expect(engine.localState.pos.x).toBeLessThan(0);
    expect(Math.abs(engine.localState.pos.z)).toBeLessThan(0.01);
  });

  it('reconcile honours server yaw when replaying unacked inputs', () => {
    const engine = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    engine.applyInput(frame(1, { forward: true }), 1 / 20, 0);
    engine.applyInput(frame(2, { forward: true }), 1 / 20, 0);
    engine.reconcile(
      {
        tick: 10,
        inputAck: 1,
        yaw: Math.PI / 2,
        entities: {
          p1: { pos: new THREE.Vector3(0, 0.9, 0), vel: new THREE.Vector3(), health: 100 },
        },
      },
      1 / 20,
      0
    );
    // Replay of seq 2 with server yaw=+pi/2 pushes local state along -X.
    expect(engine.localState.pos.x).toBeLessThan(0);
    expect(Math.abs(engine.localState.pos.z)).toBeLessThan(0.01);
  });

  it('health adopts when drift is small, prediction kept', () => {
    const engine = new RollbackEngine('p1', new THREE.Vector3(0, 0.9, 0));
    engine.applyInput(frame(1, { forward: true }), 1 / 20, 0);
    engine.applySnapshot({
      tick: 1,
      entities: {
        p1: {
          pos: engine.localState.pos.clone(),
          vel: engine.localState.vel.clone(),
          health: 55,
        },
      },
    });
    expect(engine.localState.health).toBe(55);
    expect(engine.lastAckedTick).toBe(1);
  });
});

describe('#39 client path', () => {
  const snap = makeSnap({
    tick: 1,
    entities: {
      player: entity(1, 3, { hp: 88 }),
      bot1: entity(5, -1),
    },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('feeds snapshots into rollback + interpolation (local mode)', async () => {
    const onSnapshot = vi.fn();
    const client = new MatchClient('local', { onSnapshot, onDisconnect: () => {} });
    const push = vi.spyOn(client.interp, 'push').mockImplementation(() => {});
    // drive directly through the public surface the local loop uses
    await client.connect();
    (client as unknown as { handleSnapshot: (s: WireSnapshot) => void }).handleSnapshot(snap);
    expect(push).toHaveBeenCalledWith(snap);
    expect(client.rollback.localState.health).toBe(88);
    expect(onSnapshot).toHaveBeenCalledWith(snap);
    client.dispose();
  });

  it('sampleRemotes returns interpolated entities', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    (client as unknown as { handleSnapshot: (s: WireSnapshot) => void }).handleSnapshot(snap);
    const remotes = client.sampleRemotes(50);
    const player = remotes?.find((e) => e.id === 'player');
    expect(player).toMatchObject({ x: 1, z: 3, health: 88 });
    client.dispose();
  });
});
