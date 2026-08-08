import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './renderer';
import {
  addGradientSky,
  applyTealFog,
  configureSunShadow,
  createDirtGroundTexture,
  scatterInstancedTrees,
  scatterInstancedGrass,
} from './graphics';
import { buildPoiGroup, poiDistrictAt } from './poiVisuals';
import { MAP_BOUND, MAP_SIZE, POI_RADIUS } from './constants';
import { isMobileDevice } from './platform';

export type QualityPreset = 'low' | 'medium' | 'high';

const TREE_COUNTS: Record<QualityPreset, number> = { low: 0, medium: 80, high: 80 };
const GRASS_COUNTS: Record<QualityPreset, number> = { low: 0, medium: 220, high: 320 };

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[];
}

export function disposeScene(bundle: SceneBundle) {
  bundle.controls.dispose();
  bundle.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) m?.dispose();
    }
  });
  bundle.renderer.dispose();
}

export function createScene(
  canvas: HTMLCanvasElement,
  quality: QualityPreset = 'medium'
): SceneBundle {
  const renderer = createRenderer(canvas, quality);

  const scene = new THREE.Scene();
  const skyDetail = quality === 'low' ? { segments: 16, rings: 8 } : { segments: 24, rings: 12 };
  addGradientSky(scene, {
    topColor: 0x2a4a68,
    bottomColor: 0xe8c090,
    radius: MAP_BOUND * 3,
    ...skyDetail,
  });
  applyTealFog(scene, MAP_BOUND * 0.52, MAP_BOUND * 1.45, 0xd8c0a0);

  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, MAP_BOUND * 4);
  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 10;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI / 2.1;

  const ambientLight = new THREE.AmbientLight(0x706860, 0.26);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffe0b8, 3.35);
  dirLight.position.set(118, 78, 152);
  if (quality !== 'low')
    configureSunShadow(dirLight, MAP_BOUND, quality === 'high' ? 2048 : 1024, quality === 'high');
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x6a88a8, 0.2);
  fillLight.position.set(-88, 46, -108);
  scene.add(fillLight);

  const hemiLight = new THREE.HemisphereLight(0xa8c8e8, 0x3a3428, 0.38);
  scene.add(hemiLight);

  // Ground — textured grid
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMat = new THREE.MeshStandardMaterial({
    map: createDirtGroundTexture(MAP_SIZE / 18),
    color: 0xe0ead8,
    roughness: 0.96,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality !== 'low';
  scene.add(ground);

  // Road circles connecting POIs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x282430,
      roughness: 0.9,
      metalness: 0.08,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4, POI_RADIUS * 1.4), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.y = -angle;
    road.position.set(x / 2, 0.05, z / 2);
    scene.add(road);
  }

  // Vegetation — instanced; fewer trees on low, no tree shadows on mobile
  const treeCount = TREE_COUNTS[quality];
  if (treeCount > 0) {
    const poiCoords: [number, number][] = [];
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      poiCoords.push([Math.cos(a) * POI_RADIUS, Math.sin(a) * POI_RADIUS]);
    }
    const skipNearPoi = (x: number, z: number) =>
      poiCoords.some(([px, pz]) => Math.abs(x - px) < 40 && Math.abs(z - pz) < 40);

    scatterInstancedTrees(scene, {
      count: treeCount,
      minDist: 30,
      maxDist: MAP_BOUND - 40,
      skipNear: skipNearPoi,
      castShadow: quality !== 'low' && !isMobileDevice(),
    });
  }

  let grassCount = GRASS_COUNTS[quality];
  if (grassCount > 0 && isMobileDevice()) grassCount = Math.floor(grassCount * 0.55);
  if (grassCount > 0) {
    const poiCoords: [number, number][] = [];
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      poiCoords.push([Math.cos(a) * POI_RADIUS, Math.sin(a) * POI_RADIUS]);
    }
    const skipNearPoiGrass = (x: number, z: number) =>
      poiCoords.some(([px, pz]) => Math.abs(x - px) < 28 && Math.abs(z - pz) < 28);

    scatterInstancedGrass(scene, {
      count: grassCount,
      minDist: 8,
      maxDist: MAP_BOUND - 20,
      skipNear: skipNearPoiGrass,
    });
  }

  // POIs — distinct district silhouettes (town, factory, docks, hilltop)
  const pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[] = [];
  const poiCount = 4;
  const shadows = quality !== 'low';

  for (let i = 0; i < poiCount; i++) {
    const angle = (i / poiCount) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const district = poiDistrictAt(i);
    const group = buildPoiGroup(district, i, quality, shadows);
    group.position.set(x, 0, z);
    scene.add(group);
    pois.push({ name: district, group, position: new THREE.Vector3(x, 0, z) });
  }

  return { scene, camera, renderer, controls, pois };
}
