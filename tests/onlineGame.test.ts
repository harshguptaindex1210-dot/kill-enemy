import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { resolveLocalPlayerPose } from '../src/net/onlineGame';
import { MatchClient } from '../src/net/client';
import { quantize, type WireSnapshot } from '../src/net/protocol';

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

describe('online local player pose', () => {
  it('uses in-process sim state for local demo mode', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    client.localServer!.start();
    const unit = client.localServer!.sim.units.get('player')!;
    unit.player.position.set(3, 0.9, 4);

    const pose = resolveLocalPlayerPose(client);
    expect(pose.x).toBe(3);
    expect(pose.z).toBe(4);
    expect(pose.y).toBeCloseTo(0.9, 1);
    client.dispose();
  });

  it('falls back to rollback when local sim is unavailable', () => {
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
    expect(camera.position.x).toBeCloseTo(9.5, 1);
    expect(camera.position.z).toBeCloseTo(9.05, 1);
    expect(camera.position.y).toBeGreaterThan(2.5);
  });
});

describe('online camera height', () => {
  it('onlineGame.ts uses live sim eye height for the camera', () => {
    const src = readFileSync(resolve(__dirname, '../src/net/onlineGame.ts'), 'utf8');
    expect(src).toMatch(/localEyeHeight\(\)/);
    expect(src).toMatch(/getEyeHeight\(\)/);
    expect(src).not.toMatch(/updateCamera\([\s\S]*?,\s*1\.6,/);
  });
});

describe('online respawn wiring', () => {
  it('onlineGame.ts tracks death and wires touch respawn', () => {
    const src = readFileSync(resolve(__dirname, '../src/net/onlineGame.ts'), 'utf8');
    expect(src).toMatch(/private dead = false/);
    expect(src).toMatch(/respawnHuman/);
    expect(src).toMatch(/showRespawn:\s*this\.dead/);
    expect(src).toMatch(/showRespawn/);
    expect(src).toMatch(/onRespawn/);
    expect(src).toMatch(/respawnUnit\(this\.client\.selfId\)/);
  });
});
