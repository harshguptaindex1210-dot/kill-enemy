import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  deployGlooWall,
  raycastGlooWalls,
  resolveGlooWallCollisions,
  GLOO_WALL_PLACE_DIST,
  type GlooWallSystem,
} from '../src/glooWall';

function emptyGloo(): GlooWallSystem {
  return { walls: [], nextId: 1 };
}

describe('glooWall', () => {
  it('places a wall in front of the player', () => {
    const sys = emptyGloo();
    const pos = new THREE.Vector3(0, 0.9, 0);
    const wall = deployGlooWall(sys, 'player', pos, 0, 0, 90)!;
    expect(wall).not.toBeNull();
    expect(wall.z).toBeCloseTo(-GLOO_WALL_PLACE_DIST, 1);
  });

  it('blocks hitscan through the panel', () => {
    const sys = emptyGloo();
    deployGlooWall(sys, 'player', new THREE.Vector3(0, 0.9, 0), 0, 0, 90);
    const origin = new THREE.Vector3(0, 1.2, 2);
    const dir = new THREE.Vector3(0, 0, -1);
    const hit = raycastGlooWalls(origin, dir, 10, sys.walls);
    expect(hit).not.toBeNull();
    expect(hit!).toBeGreaterThan(0);
    expect(hit!).toBeGreaterThan(3);
    expect(hit!).toBeLessThan(4.5);
  });

  it('pushes units out of the wall volume', () => {
    const sys = emptyGloo();
    deployGlooWall(sys, 'player', new THREE.Vector3(0, 0.9, 0), 0, 0, 90);
    const pos = new THREE.Vector3(0, 0.9, -GLOO_WALL_PLACE_DIST);
    resolveGlooWallCollisions(pos, sys.walls, 0.4);
    expect(Math.hypot(pos.x, pos.z - -GLOO_WALL_PLACE_DIST)).toBeGreaterThan(0.05);
  });
});
