import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './renderer';
import { MAP_BOUND, MAP_SIZE, POI_RADIUS } from './constants';

export type QualityPreset = 'low' | 'medium';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[];
}

export function createScene(
  canvas: HTMLCanvasElement,
  quality: QualityPreset = 'medium'
): SceneBundle {
  const renderer = createRenderer(canvas, quality);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6a9ec4);
  scene.fog = new THREE.Fog(0x6a9ec4, MAP_BOUND * 0.5, MAP_BOUND * 1.6);

  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, MAP_BOUND * 4);
  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 10;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI / 2.1;

  const ambientLight = new THREE.AmbientLight(0xa8c4ff, 0.75);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffe0a8, 1.9);
  dirLight.position.set(150, 200, 100);
  if (quality === 'medium') {
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -MAP_BOUND;
    dirLight.shadow.camera.right = MAP_BOUND;
    dirLight.shadow.camera.top = MAP_BOUND;
    dirLight.shadow.camera.bottom = -MAP_BOUND;
    dirLight.shadow.camera.far = MAP_BOUND * 1.5;
  }
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x9ed7ff, 0x3a5a28, 0.55);
  scene.add(hemiLight);

  // Ground — textured grid
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5a8a3a,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality === 'medium';
  scene.add(ground);

  // Grid helper
  const gridHelper = new THREE.GridHelper(MAP_SIZE, 28, 0x3d6b2e, 0x2a4a22);
  scene.add(gridHelper);

  // Road circles connecting POIs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.9 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4, POI_RADIUS * 1.4), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x / 2, 0.05, z / 2);
    road.lookAt(0, 0.05, 0);
    scene.add(road);
  }

  // Vegetation scatter — simple cylinders
  if (quality === 'medium') {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const leafPalette = [0x2f8f3a, 0x3cb043, 0x228b22, 0x56a02c, 0x1e7a34];
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 4);
    const leafGeo = new THREE.SphereGeometry(0.8, 4, 4);

    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * (MAP_BOUND - 40);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Skip if near a POI
      const poiCoords: [number, number][] = [];
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        poiCoords.push([Math.cos(a) * POI_RADIUS, Math.sin(a) * POI_RADIUS]);
      }
      const nearPoi = poiCoords.some(([px, pz]) => Math.abs(x - px) < 40 && Math.abs(z - pz) < 40);
      if (nearPoi) continue;

      const leafMat = new THREE.MeshStandardMaterial({
        color: leafPalette[i % leafPalette.length],
        roughness: 0.8,
      });
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1;
      tree.add(trunk);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 2.8 + Math.random() * 0.5;
      leaf.scale.set(1, 0.8 + Math.random() * 0.4, 1);
      tree.add(leaf);
      tree.position.set(x, 0, z);
      scene.add(tree);
    }
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

    const wallMat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColors[i], roughness: 0.8 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColors[i],
      roughness: 0.55,
      metalness: 0.25,
    });

    // Main building
    const mainH = 25 + Math.random() * 15;
    const mainGeo = new THREE.BoxGeometry(30, mainH, 25);
    const main = new THREE.Mesh(mainGeo, wallMat);
    main.position.y = mainH / 2;
    main.castShadow = quality === 'medium';
    main.receiveShadow = quality === 'medium';
    group.add(main);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 23), roofMat);
    roof.position.y = mainH + 1;
    group.add(roof);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffe08a,
      emissive: 0xffc04d,
      emissiveIntensity: 0.35,
    });
    for (let w = 0; w < 4; w++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.1), winMat);
      const wx = -10 + w * 7;
      win.position.set(wx, mainH * 0.6, 12.6);
      group.add(win);
    }

    // Side building
    const sideH = 12 + Math.random() * 8;
    const side = new THREE.Mesh(new THREE.BoxGeometry(15, sideH, 15), accentMat);
    side.position.set(22, sideH / 2, 5);
    side.castShadow = quality === 'medium';
    group.add(side);

    // Ground pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.9 })
    );
    pad.position.y = -0.25;
    group.add(pad);

    scene.add(group);
    pois.push({ name: names[i], group, position: new THREE.Vector3(x, 0, z) });
  }

  return { scene, camera, renderer, controls, pois };
}
