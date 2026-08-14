import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { aimDirection, updateCamera, CAMERA_FOV_TPS, CAMERA_FOV_FPS } from '../src/camera';

describe('camera POV', () => {
  it('aimDirection follows pitch for vertical look', () => {
    const flat = aimDirection(0, 0, new THREE.Vector3());
    expect(flat.y).toBeCloseTo(0, 5);
    expect(flat.z).toBeCloseTo(-1, 5);

    const up = aimDirection(0, Math.PI / 4, new THREE.Vector3());
    expect(up.y).toBeGreaterThan(0.6);
  });

  it('TPS camera looks along pitch, not only at player torso', () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
    const pos = new THREE.Vector3(0, 0, 0);
    updateCamera(camera, 0, 0.6, 1.6, 'tps', pos, 0.016, { snapPosition: true });
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    expect(forward.y).toBeGreaterThan(0.35);

    updateCamera(camera, 0, -0.5, 1.6, 'tps', pos, 0.016, { snapPosition: true });
    const down = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    expect(down.y).toBeLessThan(-0.2);
  });

  it('switches FOV between TPS and FPS modes', () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
    const pos = new THREE.Vector3(0, 0, 0);
    updateCamera(camera, 0, 0, 1.6, 'tps', pos, 0.05, { snapPosition: true });
    expect(camera.fov).toBe(CAMERA_FOV_TPS);
    updateCamera(camera, 0, 0, 1.6, 'fps', pos, 0.05, { snapPosition: true });
    expect(camera.fov).toBe(CAMERA_FOV_FPS);
    expect(CAMERA_FOV_FPS).toBeLessThan(CAMERA_FOV_TPS);
  });
});
