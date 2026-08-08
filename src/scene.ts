import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './renderer';
import {
  addGradientSky,
  applyTealFog,
  configureSunShadow,
  scatterInstancedTrees,
} from './graphics';
import { MAP_BOUND, MAP_SIZE, POI_RADIUS } from './constants';
import { isMobileDevice } from './platform';

export type QualityPreset = 'low' | 'medium' | 'high';

const TREE_COUNTS: Record<QualityPreset, number> = { low: 0, medium: 80, high: 80 };

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
    topColor: 0x1a3d5c,
    bottomColor: 0x6a98b8,
    radius: MAP_BOUND * 3,
    ...skyDetail,
  });
  applyTealFog(scene, MAP_BOUND * 0.38, MAP_BOUND * 1.42, 0x6a98a8);

  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, MAP_BOUND * 4);
  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 10;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI / 2.1;

  const ambientLight = new THREE.AmbientLight(0x8aa8c8, 0.32);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffe4b8, 2.55);
  dirLight.position.set(121, 92, 158);
  if (quality !== 'low') configureSunShadow(dirLight, MAP_BOUND, 1024, false);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x7098b8, 0.28);
  fillLight.position.set(-90, 50, -110);
  scene.add(fillLight);

  const hemiLight = new THREE.HemisphereLight(0x88b8d8, 0x2a4a1e, 0.48);
  scene.add(hemiLight);

  // Ground — textured grid
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3a5c28,
    roughness: 0.92,
    metalness: 0.04,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality !== 'low';
  scene.add(ground);

  // Grid helper
  const gridHelper = new THREE.GridHelper(MAP_SIZE, 28, 0x3a5a2a, 0x243818);
  gridHelper.position.y = 0.02;
  scene.add(gridHelper);

  // Road circles connecting POIs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2e2e38,
      roughness: 0.92,
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

  // POIs — detailed buildings with distinct district colors
  const pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[] = [];
  const names = ['Town', 'Factory', 'Docks', 'Hilltop'];
  const colors = [0xc4a35a, 0x6a7a9a, 0xb87333, 0x8fbc8f];
  const roofColors = [0x5c4033, 0x3d4555, 0x4a3728, 0x556b2f];
  const accentColors = [0xd4a017, 0x708090, 0xcd853f, 0x6b8e23];

  for (let i = 0; i < names.length; i++) {
    const angle = (i / names.length) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.userData.name = names[i];

    const wallMat = new THREE.MeshStandardMaterial({
      color: colors[i],
      roughness: 0.68,
      metalness: 0.08,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColors[i],
      roughness: 0.75,
      metalness: 0.05,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColors[i],
      roughness: 0.45,
      metalness: 0.35,
    });

    // Main building
    const mainH = 25 + Math.random() * 15;
    const mainGeo = new THREE.BoxGeometry(30, mainH, 25);
    const main = new THREE.Mesh(mainGeo, wallMat);
    main.position.y = mainH / 2;
    main.castShadow = quality !== 'low';
    main.receiveShadow = quality !== 'low';
    group.add(main);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 23), roofMat);
    roof.position.y = mainH + 1;
    group.add(roof);

    // Windows — skip on low preset to cut draw calls
    if (quality !== 'low') {
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xffe08a,
        emissive: 0xffc04d,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.1,
      });
      for (let w = 0; w < 4; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.1), winMat);
        const wx = -10 + w * 7;
        win.position.set(wx, mainH * 0.6, 12.6);
        group.add(win);
      }
    }

    // Side building
    const sideH = 12 + Math.random() * 8;
    const side = new THREE.Mesh(new THREE.BoxGeometry(15, sideH, 15), accentMat);
    side.position.set(22, sideH / 2, 5);
    side.castShadow = quality !== 'low';
    group.add(side);

    // Ground pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85, metalness: 0.15 })
    );
    pad.position.y = -0.25;
    group.add(pad);

    scene.add(group);
    pois.push({ name: names[i], group, position: new THREE.Vector3(x, 0, z) });
  }

  return { scene, camera, renderer, controls, pois };
}
