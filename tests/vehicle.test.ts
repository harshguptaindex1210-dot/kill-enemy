import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVehicle, updateVehicle, findNearbyVehicle } from '../src/vehicle';

describe('vehicles', () => {
  it('creates sedan with full health', () => {
    const v = createVehicle('sedan', new THREE.Vector3(0, 0, 0));
    expect(v.state.health).toBe(200);
    expect(v.state.type).toBe('sedan');
    expect(v.state.occupied).toBe(false);
  });

  it('creates buggy with lower health', () => {
    const v = createVehicle('buggy', new THREE.Vector3(0, 0, 0));
    expect(v.state.health).toBe(150);
  });

  it('creates motorbike with high speed and low health', () => {
    const v = createVehicle('motorbike', new THREE.Vector3(0, 0, 0));
    expect(v.state.health).toBe(100);
    expect(v.state.type).toBe('motorbike');
  });

  it('moves forward with throttle', () => {
    const v = createVehicle('sedan', new THREE.Vector3(0, 0.5, 0));
    updateVehicle(v.state, 1, 0, 1 / 60, 0);
    expect(v.state.speed).toBeGreaterThan(0);
    expect(v.state.position.z).toBeGreaterThan(0);
  });

  it('steers left when steer input is negative', () => {
    const v = createVehicle('sedan', new THREE.Vector3(0, 0.5, 0));
    v.state.speed = 20;
    const rotBefore = v.state.rotation;
    updateVehicle(v.state, 1, -1, 1 / 60, 0);
    expect(v.state.rotation).toBeGreaterThan(rotBefore);
  });

  it('finds nearby unoccupied vehicle', () => {
    const v = createVehicle('sedan', new THREE.Vector3(0, 0.5, 0));
    const pos = new THREE.Vector3(2, 0, 0);
    const found = findNearbyVehicle([v], pos, 3);
    expect(found).not.toBeNull();
    expect(found?.state.type).toBe('sedan');
  });

  it('does not find occupied vehicle', () => {
    const v = createVehicle('sedan', new THREE.Vector3(0, 0.5, 0));
    v.state.occupied = true;
    const found = findNearbyVehicle([v], new THREE.Vector3(0, 0, 0), 3);
    expect(found).toBeNull();
  });
});
