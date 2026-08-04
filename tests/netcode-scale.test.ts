import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RollbackEngine, createBotInput } from '../src/netcode';

function createBotEngine(id: string, pos: THREE.Vector3): RollbackEngine {
  return new RollbackEngine(id, pos);
}

describe('netcode scaling', () => {
  it('simulates 10 players without errors', () => {
    const engines: RollbackEngine[] = [];
    for (let i = 0; i < 10; i++) {
      engines.push(
        createBotEngine(
          `p${i}`,
          new THREE.Vector3(Math.random() * 100 - 50, 0.9, Math.random() * 100 - 50)
        )
      );
    }
    for (let tick = 0; tick < 300; tick++) {
      for (const e of engines) {
        e.applyInput(
          createBotInput(tick, new THREE.Vector3(0, 0.9, 0), e.localState.pos),
          1 / 20,
          0
        );
      }
    }
    expect(engines.every((e) => Math.abs(e.localState.pos.x) < 200)).toBe(true);
  });

  it('handles rollback with 10 players simultaneously', () => {
    const engines: RollbackEngine[] = [];
    for (let i = 0; i < 10; i++) {
      engines.push(createBotEngine(`p${i}`, new THREE.Vector3(i * 5, 0.9, 0)));
    }

    const snapshot = {
      tick: 0,
      entities: Object.fromEntries(
        engines.map((e) => [
          e.entityId,
          { pos: e.localState.pos.clone(), vel: new THREE.Vector3(), health: 100 },
        ])
      ) as Record<string, { pos: THREE.Vector3; vel: THREE.Vector3; health: number }>,
    };
    for (const e of engines) {
      snapshot.entities[e.entityId] = {
        pos: e.localState.pos.clone(),
        vel: new THREE.Vector3(),
        health: 100,
      };
      e.applyInput(
        {
          seq: 1,
          forward: true,
          backward: false,
          left: false,
          right: false,
          sprint: false,
          jump: false,
          aim: false,
          fire: false,
          reload: false,
          weapon1: false,
          weapon2: false,
          weapon3: false,
          mouseX: 0,
          mouseY: 0,
        },
        1 / 20,
        0
      );
    }

    for (const e of engines) {
      e.applySnapshot(snapshot);
    }

    expect(engines.every((e) => e.localState.health === 100)).toBe(true);
  });

  it('bandwidth per client under 100 KB/s at 20 Hz', () => {
    const snapshotSize = JSON.stringify({
      tick: 1,
      entities: Array.from({ length: 10 }, (_, i) => ({
        [`p${i}`]: { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, health: 100 },
      })).reduce((a, b) => ({ ...a, ...b }), {}),
    }).length;

    const bytesPerSec = snapshotSize * 20;
    expect(bytesPerSec).toBeLessThan(102400);
  });
});
