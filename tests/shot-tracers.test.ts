import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createShotTracerPool } from '../src/shotTracers';

describe('shot tracers', () => {
  it('shows a streak then recycles the mesh after lifetime', () => {
    const scene = new THREE.Scene();
    const pool = createShotTracerPool();
    const muzzle = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(0, 0, -1);
    pool.spawn(scene, muzzle, dir, 1000);
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh.visible).toBe(true);
    pool.expire(1050);
    expect(mesh.visible).toBe(true);
    pool.expire(1100);
    expect(mesh.visible).toBe(false);
    pool.spawn(scene, muzzle, dir, 1200);
    expect(scene.children).toHaveLength(1);
    expect(mesh.visible).toBe(true);
    pool.dispose(scene);
  });

  it('local and online matches share the pool (no per-shot timeout)', () => {
    const game = readFileSync(resolve(__dirname, '../src/game.ts'), 'utf8');
    const online = readFileSync(resolve(__dirname, '../src/net/onlineGame.ts'), 'utf8');
    expect(game).toMatch(/createShotTracerPool/);
    expect(online).toMatch(/createShotTracerPool/);
    expect(game).not.toMatch(/setTimeout\(\(\) => \{\s*this\.scene\.remove\(fx\.tracer\)/);
    expect(online).not.toMatch(
      /window\.setTimeout\(\(\) => \{\s*this\.scene\.remove\(fx\.tracer\)/
    );
  });
});
