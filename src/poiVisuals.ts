import * as THREE from 'three';

type QualityPreset = 'low' | 'medium' | 'high';

export type PoiDistrict = 'Town' | 'Factory' | 'Docks' | 'Hilltop';

const DISTRICTS: PoiDistrict[] = ['Town', 'Factory', 'Docks', 'Hilltop'];

const PALETTE: Record<PoiDistrict, { wall: number; roof: number; accent: number }> = {
  Town: { wall: 0x8a7a62, roof: 0x3d3028, accent: 0x9a8040 },
  Factory: { wall: 0x5a6578, roof: 0x2a3038, accent: 0x506070 },
  Docks: { wall: 0x7a5a42, roof: 0x352820, accent: 0x8a6840 },
  Hilltop: { wall: 0x6a7a58, roof: 0x3a4530, accent: 0x4a5a38 },
};

const URBAN_PALETTE: typeof PALETTE = {
  Town: { wall: 0x9a9aa8, roof: 0x484850, accent: 0x707880 },
  Factory: { wall: 0x7a8088, roof: 0x383840, accent: 0x606870 },
  Docks: { wall: 0x8a8078, roof: 0x404038, accent: 0x686058 },
  Hilltop: { wall: 0x888890, roof: 0x404048, accent: 0x585860 },
};

function stdMat(color: number, rough = 0.84, metal = 0.06): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  shadows: boolean
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  return m;
}

function addWindows(
  group: THREE.Group,
  faceZ: number,
  baseY: number,
  cols: number,
  rows: number,
  spacing: number,
  shadows: boolean
) {
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xd4c090,
    emissive: 0xb89040,
    emissiveIntensity: 0.34,
    roughness: 0.42,
    metalness: 0.12,
  });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const win = box(
        1.8,
        2.4,
        0.12,
        winMat,
        -spacing + c * spacing,
        baseY + r * 3.2,
        faceZ,
        shadows
      );
      group.add(win);
    }
  }
}

function addPad(group: THREE.Group, shadows: boolean) {
  group.add(box(52, 0.5, 42, stdMat(0x3a4048, 0.92, 0.1), 0, -0.25, 0, shadows));
}

function buildTown(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  urban: boolean
) {
  const pal = urban ? URBAN_PALETTE : PALETTE;
  const p = pal.Town;
  const wall = stdMat(p.wall);
  const roof = stdMat(p.roof, 0.88, 0.04);
  const accent = stdMat(p.accent, 0.72, 0.16);
  const mainH = 26 + (idx % 2) * 8;
  group.add(box(28, mainH, 22, wall, 0, mainH / 2, 0, shadows));
  group.add(box(26, 2, 20, roof, 0, mainH + 1, 0, shadows));
  group.add(box(4, 14, 4, accent, -10, 7, 10, shadows));
  group.add(box(3, 6, 3, roof, -10, 15, 10, shadows));
  group.add(box(14, 10, 12, accent, 18, 5, -6, shadows));
  group.add(box(12, 1.5, 10, roof, 18, 10.75, -6, shadows));
  if (quality !== 'low') addWindows(group, 11.2, mainH * 0.35, 4, 2, 5.5, shadows);
  addPad(group, shadows);
}

function buildFactory(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  urban: boolean
) {
  const pal = urban ? URBAN_PALETTE : PALETTE;
  const p = pal.Factory;
  const wall = stdMat(p.wall);
  const roof = stdMat(p.roof, 0.9, 0.08);
  const metal = stdMat(p.accent, 0.55, 0.35);
  const mainH = 16 + (idx % 2) * 4;
  group.add(box(38, mainH, 28, wall, 0, mainH / 2, 0, shadows));
  group.add(box(36, 2.5, 26, roof, 0, mainH + 1.25, 0, shadows));
  for (let s = 0; s < 2; s++) {
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 18, 6), metal);
    chim.position.set(-12 + s * 24, mainH + 9, -8);
    chim.castShadow = shadows;
    group.add(chim);
  }
  group.add(box(22, 8, 14, metal, 20, 4, 10, shadows));
  group.add(box(8, 3, 3, stdMat(0x8a5030, 0.7, 0.2), -6, mainH * 0.55, 14.2, shadows));
  if (quality !== 'low') addWindows(group, 14.2, 4, 3, 1, 6, shadows);
  addPad(group, shadows);
}

function buildDocks(
  group: THREE.Group,
  _idx: number,
  shadows: boolean,
  quality: QualityPreset,
  urban: boolean
) {
  const pal = urban ? URBAN_PALETTE : PALETTE;
  const p = pal.Docks;
  const wood = stdMat(p.wall, 0.92, 0.04);
  const roof = stdMat(p.roof, 0.88, 0.06);
  group.add(box(34, 12, 20, wood, 0, 6, 0, shadows));
  group.add(box(32, 1.5, 18, roof, 0, 12.75, 0, shadows));
  const containers = [0xc04030, 0x305080, 0x408050];
  for (let c = 0; c < 3; c++) {
    group.add(box(6, 4.5, 12, stdMat(containers[c], 0.78, 0.22), -14 + c * 8, 2.25, 14, shadows));
  }
  group.add(box(2.5, 16, 2.5, stdMat(0x909090, 0.6, 0.4), 16, 8, -4, shadows));
  group.add(box(14, 1.2, 1.2, stdMat(0xb0a080, 0.65, 0.3), 10, 15, -4, shadows));
  const pier = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 28), stdMat(0x5a4838, 0.95, 0.02));
  pier.position.set(-4, 0.2, 22);
  pier.receiveShadow = shadows;
  group.add(pier);
  if (quality !== 'low') addWindows(group, 10.2, 5, 2, 1, 7, shadows);
  addPad(group, shadows);
}

function buildHilltop(
  group: THREE.Group,
  idx: number,
  shadows: boolean,
  quality: QualityPreset,
  urban: boolean
) {
  const pal = urban ? URBAN_PALETTE : PALETTE;
  const p = pal.Hilltop;
  const wall = stdMat(p.wall);
  const roof = stdMat(p.roof, 0.88, 0.05);
  const bunker = stdMat(p.accent, 0.8, 0.12);
  group.add(box(24, 8, 20, bunker, 0, 4, 0, shadows));
  group.add(box(22, 1.2, 18, roof, 0, 8.6, 0, shadows));
  const towerH = 22 + (idx % 2) * 6;
  group.add(box(8, towerH, 8, wall, 16, towerH / 2, -8, shadows));
  group.add(box(7, 1.2, 7, roof, 16, towerH + 0.6, -8, shadows));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), stdMat(0xc8d0d8, 0.45, 0.55));
  dish.scale.set(1, 0.35, 1);
  dish.position.set(16, towerH + 2.5, -8);
  dish.castShadow = shadows;
  group.add(dish);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, towerH + 4, 5),
    stdMat(0x707880, 0.5, 0.4)
  );
  mast.position.set(16, (towerH + 4) / 2, -8);
  mast.castShadow = shadows;
  group.add(mast);
  if (quality !== 'low') addWindows(group, 4.2, 3, 2, 1, 5, shadows);
  addPad(group, shadows);
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
