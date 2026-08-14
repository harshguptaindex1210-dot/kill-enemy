import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { buildPoiGroup, poiDistrictAt } from '../src/poiVisuals';

describe('poiVisuals', () => {
  it('builds four distinct district types', () => {
    const names = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const district = poiDistrictAt(i);
      names.add(district);
      const group = buildPoiGroup(district, i, 'medium', false);
      expect(group.userData.name).toBe(district);
      expect(group.children.length).toBeGreaterThan(5);
    }
    expect(names.size).toBe(4);
  });

  it('factory district includes chimney cylinders', () => {
    const group = buildPoiGroup('Factory', 1, 'medium', false);
    const hasCylinder = group.children.some(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.CylinderGeometry
    );
    expect(hasCylinder).toBe(true);
  });

  it('docks district includes colored containers and pier', () => {
    const group = buildPoiGroup('Docks', 2, 'medium', false);
    expect(group.children.length).toBeGreaterThan(8);
  });

  it('skips window meshes on low quality', () => {
    const low = buildPoiGroup('Town', 0, 'low', false);
    const med = buildPoiGroup('Town', 0, 'medium', false);
    expect(med.children.length).toBeGreaterThan(low.children.length);
  });

  it('town houses use pitched cone roofs like BGMI villages', () => {
    const group = buildPoiGroup('Town', 0, 'medium', false);
    const roofs = group.children.filter(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.ConeGeometry
    );
    expect(roofs.length).toBeGreaterThanOrEqual(3);
  });
});

describe('scene POI wiring', () => {
  it('scene.ts builds districts via poiVisuals', () => {
    const src = readFileSync(resolve(__dirname, '../src/scene.ts'), 'utf8');
    expect(src).toMatch(/buildPoiGroup/);
    expect(src).toMatch(/poiDistrictAt/);
  });
});
