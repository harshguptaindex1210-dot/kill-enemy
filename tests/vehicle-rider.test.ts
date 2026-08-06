import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createVehicle,
  riderWorldPose,
  seatOffsetForVehicle,
  shouldShowUnitRig,
} from '../src/vehicle';

describe('vehicle rider visibility (#48)', () => {
  it('keeps alive riders visible whether mounted or not', () => {
    expect(shouldShowUnitRig(true)).toBe(true);
    expect(shouldShowUnitRig(false)).toBe(false);
  });

  it('places motorbike rider above the bike body, not at chassis origin', () => {
    const v = createVehicle('motorbike', new THREE.Vector3(10, 0.5, -5));
    v.state.rotation = 0;
    const pose = riderWorldPose('motorbike', v.state.position, v.state.rotation);
    const seat = seatOffsetForVehicle('motorbike');
    expect(pose.position.y).toBeCloseTo(v.state.position.y + seat.y, 5);
    expect(pose.position.z).toBeCloseTo(v.state.position.z + seat.z, 5);
    expect(pose.yaw).toBe(0);
  });

  it('places sedan and buggy riders on a driver seat offset', () => {
    for (const type of ['sedan', 'buggy'] as const) {
      const v = createVehicle(type, new THREE.Vector3(0, 0.5, 0));
      v.state.rotation = Math.PI / 2;
      const pose = riderWorldPose(type, v.state.position, v.state.rotation);
      const seat = seatOffsetForVehicle(type);
      expect(pose.position.y).toBeCloseTo(v.state.position.y + seat.y, 5);
      expect(pose.yaw).toBeCloseTo(Math.PI / 2, 5);
      // At yaw π/2, local -x (left seat) maps toward -world Z / +X depending on basis —
      // ensure we left the origin.
      expect(pose.position.distanceTo(v.state.position)).toBeGreaterThan(0.3);
    }
  });
});
