import * as THREE from 'three';
import { styleMat } from './artStyle';

type QualityPreset = 'low' | 'medium' | 'high';

export type PoiDistrict = 'Town' | 'Factory' | 'Docks' | 'Hilltop';

const DISTRICTS: PoiDistrict[] = ['Town', 'Factory', 'Docks', 'Hilltop'];

const PALETTE: Record<PoiDistrict, { wall: number; roof: number; accent: number }> = {
  Town: { wall: 0xc8b89a, roof: 0x8a4030, accent: 0x6a5848 },
  Factory: { wall: 0x8a8a7a, roof: 0x4a4038, accent: 0x6a7078 },
  Docks: { wall: 0xb8a078, roof: 0x6a3830, accent: 0x8a6840 },
  Hilltop: { wall: 0xd0c4a8, roof: 0x7a3828, accent: 0x5a6a50 },
};

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const ROOF = new THREE.ConeGeometry(1, 1, 4);
const CHIM = new THREE.CylinderGeometry(1, 1.15, 1, 6);

function mat(color: number): THREE.MeshStandardMaterial {
  return styleMat(color, 'concrete');
}

function mesh(
  geo: THREE.BufferGeometry,
  m: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  shadows: boolean,
  yaw = 0
): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = yaw;
  o.castShadow = shadows;
  o.receiveShadow = shadows;
  return o;
}

function house(
  group: THREE.Group,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  yaw: number,
  wall: THREE.Material,
  roof: THREE.Material,
  shadows: boolean
) {
  group.add(mesh(UNIT, wall, x, h / 2, z, w, h, d, shadows, yaw));
  const rad = Math.max(w, d) * 0.74;
  const top = mesh(ROOF, roof, x, h + 1.15, z, rad, 2.3, rad, shadows, yaw + Math.PI / 4);
  group.add(top);
}

function windows(
  group: THREE.Group,
  x: number,
  z: number,
  faceZ: number,
  baseY: number,
  cols: number,
  shadows: boolean
) {
  const glass = styleMat(0x2a3540, 'glass', 0x88c0e0, 0.22);
  for (let c = 0; c < cols; c++) {
    group.add(mesh(UNIT, glass, x - 2.2 + c * 2.2, baseY, z + faceZ, 0.9, 1.1, 0.12, shadows));
  }
}

function pad(group: THREE.Group, shadows: boolean) {
  group.add(mesh(UNIT, mat(0x6a6a62), 0, 0.04, 0, 48, 0.08, 38, shadows));
}

function buildTown(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  _urban: boolean
) {
  const p = PALETTE.Town;
  const wall = mat(p.wall);
  const roof = mat(p.roof);
  const trim = mat(p.accent);
  const spots: [number, number, number, number, number, number][] = [
    [-8, -6, 8, 7, 5.2, 0.2],
    [7, -4, 7.2, 6.4, 4.6, -0.4],
    [-6, 8, 6.5, 6, 4.4, 0.5],
    [9, 7, 9, 7.5, 6.1, 0.1],
    [0, 1, 5.5, 5.2, 3.8 + (idx % 2), -0.15],
  ];
  for (const [x, z, w, d, h, yaw] of spots) house(group, x, z, w, d, h, yaw, wall, roof, shadows);
  group.add(mesh(UNIT, trim, 2, 0.45, -12, 10, 0.9, 0.35, shadows));
  if (quality !== 'low') {
    windows(group, -8, -6, 3.6, 2.4, 2, shadows);
    windows(group, 9, 7, 3.85, 2.8, 3, shadows);
  }
  pad(group, shadows);
}

function buildFactory(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  _urban: boolean
) {
  const p = PALETTE.Factory;
  const wall = mat(p.wall);
  const roof = mat(p.roof);
  const metal = mat(p.accent);
  group.add(mesh(UNIT, wall, -4, 4.2, 0, 22, 8.4, 12, shadows));
  group.add(mesh(UNIT, roof, -4, 8.7, 0, 23, 0.6, 13, shadows));
  house(group, 14, 6, 8, 7, 4.2, 0.2, wall, roof, shadows);
  house(group, 12, -8, 7, 6, 3.8, -0.3, wall, roof, shadows);
  for (let s = 0; s < 2; s++) {
    const chim = mesh(CHIM, metal, -10 + s * 8, 12 + (idx % 2), -3, 1.3, 8, 1.3, shadows);
    group.add(chim);
  }
  if (quality !== 'low') windows(group, -4, 0, 6.1, 3.2, 4, shadows);
  pad(group, shadows);
}

function buildDocks(
  group: THREE.Group,
  _idx: number,
  shadows: boolean,
  quality: QualityPreset,
  _urban: boolean
) {
  const p = PALETTE.Docks;
  const wall = mat(p.wall);
  const roof = mat(p.roof);
  house(group, -6, -2, 12, 9, 5.4, 0, wall, roof, shadows);
  house(group, 8, -4, 8, 7, 4.6, 0.25, wall, roof, shadows);
  const containers = [0xc04030, 0x305080, 0x408050];
  for (let c = 0; c < 3; c++) {
    group.add(mesh(UNIT, mat(containers[c]), -12 + c * 7, 1.4, 12, 6, 2.8, 3.2, shadows));
  }
  group.add(mesh(UNIT, mat(0x5a4838), -2, 0.18, 18, 16, 0.36, 10, shadows));
  if (quality !== 'low') windows(group, -6, -2, 4.55, 2.6, 3, shadows);
  pad(group, shadows);
}

function buildHilltop(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  _urban: boolean
) {
  const p = PALETTE.Hilltop;
  const wall = mat(p.wall);
  const roof = mat(p.roof);
  house(group, -6, 2, 9, 8, 5, 0.15, wall, roof, shadows);
  house(group, 7, -3, 7.5, 6.5, 4.4, -0.35, wall, roof, shadows);
  house(group, 2, 9, 6, 6, 3.6 + (idx % 2), 0.4, wall, roof, shadows);
  const tower = mesh(CHIM, mat(p.accent), 14, 7, -8, 1.6, 14, 1.6, shadows);
  group.add(tower);
  if (quality !== 'low') windows(group, -6, 2, 4.1, 2.5, 2, shadows);
  pad(group, shadows);
}

const BUILDERS: Record<
  PoiDistrict,
  (g: THREE.Group, idx: number, shadows: boolean, q: QualityPreset, urban: boolean) => void
> = {
  Town: buildTown,
  Factory: buildFactory,
  Docks: buildDocks,
  Hilltop: buildHilltop,
};

export interface PoiBuildStyle {
  scale?: number;
  urban?: boolean;
}

/** Battle-royale POI cluster with a distinct silhouette per district. */
export function buildPoiGroup(
  district: PoiDistrict,
  index: number,
  quality: QualityPreset,
  shadows: boolean,
  style: PoiBuildStyle = {}
): THREE.Group {
  const group = new THREE.Group();
  group.userData.name = district;
  const scale = style.scale ?? 1;
  const urban = style.urban ?? false;
  BUILDERS[district](group, index, shadows, quality, urban);
  if (scale !== 1) group.scale.setScalar(scale);
  return group;
}

export function poiDistrictAt(index: number): PoiDistrict {
  return DISTRICTS[index % DISTRICTS.length]!;
}
