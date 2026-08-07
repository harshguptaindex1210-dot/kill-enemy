import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolveLocalPlayerPose } from '../src/net/onlineGame';
import { MatchClient } from '../src/net/client';
import { quantize, type WireSnapshot } from '../src/net/protocol';
import type { InputFrame } from '../src/netcode';

function makeSnap(tick: number, px: number, pz: number): WireSnapshot {
  return {
    tick,
    time_ms: tick * 50,
    phase: 'playing',
    alive: 2,
    zone: { cx: 0, cz: 0, r: 40000, dps: 1, phase: 0 },
    entities: {
      player: {
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
      },
    },
    loot: [],
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

describe('online local player pose', () => {
  it('uses rollback prediction instead of interpolated network samples', () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    client.interp.push(makeSnap(1, 0, 0));
    client.interp.push(makeSnap(2, 4, 0));

    client.rollback.applyInput(frame(1, { forward: true }), 1 / 20, 0);
    const predicted = client.rollback.localState.pos.clone();

    const interpolated = client.sampleRemotes(75);
    const interpSelf = interpolated?.find((e) => e.id === 'player');
    expect(interpSelf).toBeDefined();
    expect(interpSelf!.x).not.toBe(predicted.x);

    const pose = resolveLocalPlayerPose(client);
    expect(pose.x).toBe(predicted.x);
    expect(pose.z).toBe(predicted.z);
    expect(pose.yaw).toBe(client.rollback.yaw);
    client.dispose();
  });

  it('adopts authoritative rollback state for local demo mode', () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    const handle = (
      client as unknown as { handleSnapshot: (s: WireSnapshot) => void }
    ).handleSnapshot.bind(client);
    handle(makeSnap(1, 2, 3));
    handle(makeSnap(2, 8, 9));

    const pose = resolveLocalPlayerPose(client);
    expect(pose.x).toBe(8);
    expect(pose.z).toBe(9);
    client.dispose();
  });
});

describe('camera snap option', () => {
  it('snaps camera position when snapPosition is enabled', async () => {
    const { updateCamera } = await import('../src/camera');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const target = new THREE.Vector3(10, 0.9, 5);
    updateCamera(camera, 0, 0, 1.6, 'tps', target, 1 / 60, { snapPosition: true });
    expect(camera.position.x).toBeCloseTo(target.x + Math.sin(0) * 5.2 + -Math.cos(0) * 0.55, 1);
    expect(camera.position.z).toBeCloseTo(target.z + Math.cos(0) * 5.2 + Math.sin(0) * 0.55, 1);
  });
});
