import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './renderer';
import {
  addGradientSky,
  applyTealFog,
  configureSunShadow,
  groundTextureFor,
  scatterInstancedTrees,
  scatterInstancedGrass,
  scatterPalms,
  scatterParkedCars,
} from './graphics';
import { buildPoiGroup, poiDistrictAt } from './poiVisuals';
import { MAP_BOUND, MAP_SIZE, POI_RADIUS } from './constants';
import { isMobileDevice } from './platform';
import { mapPreset, type MapId } from './mapPresets';

export type QualityPreset = 'low' | 'medium' | 'high';

const TREE_COUNTS: Record<QualityPreset, number> = { low: 0, medium: 80, high: 80 };
const GRASS_COUNTS: Record<QualityPreset, number> = { low: 0, medium: 220, high: 320 };

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[];
  mapId: MapId;
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

function poiCoords(): [number, number][] {
  const coords: [number, number][] = [];
  for (let j = 0; j < 4; j++) {
    const a = (j / 4) * Math.PI * 2;
    coords.push([Math.cos(a) * POI_RADIUS, Math.sin(a) * POI_RADIUS]);
  }
  return coords;
}

function skipNearPoi(coords: [number, number][], pad: number) {
  return (x: number, z: number) =>
    coords.some(([px, pz]) => Math.abs(x - px) < pad && Math.abs(z - pz) < pad);
}

export function createScene(
  canvas: HTMLCanvasElement,
  quality: QualityPreset = 'medium',
  mapId: MapId = 'meadow'
): SceneBundle {
  const renderer = createRenderer(canvas, quality);
  const map = mapPreset(mapId);
  const scene = new THREE.Scene();
  const skyDetail = quality === 'low' ? { segments: 16, rings: 8 } : { segments: 24, rings: 12 };
  addGradientSky(scene, {
    topColor: map.skyTop,
    bottomColor: map.skyBottom,
    radius: MAP_BOUND * 3,
    ...skyDetail,
  });
  applyTealFog(scene, MAP_BOUND * map.fogNear, MAP_BOUND * map.fogFar, map.fogColor);

  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, MAP_BOUND * 4);
  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 10;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI / 2.1;

  scene.add(new THREE.AmbientLight(map.ambientColor, map.ambientIntensity));

  const dirLight = new THREE.DirectionalLight(map.sunColor, map.sunIntensity);
  dirLight.position.set(118, 78, 152);
  if (quality !== 'low')
    configureSunShadow(dirLight, MAP_BOUND, quality === 'high' ? 2048 : 1024, quality === 'high');
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x6a88a8, map.id === 'city' ? 0.14 : 0.2);
  fillLight.position.set(-88, 46, -108);
  scene.add(fillLight);

  scene.add(new THREE.HemisphereLight(map.hemiSky, map.hemiGround, map.hemiIntensity));

  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTextureFor(map.groundKind, MAP_SIZE / 18),
    color: map.groundTint,
    roughness: map.groundKind === 'asphalt' ? 0.88 : 0.96,
    metalness: map.groundKind === 'asphalt' ? 0.08 : 0.02,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality !== 'low';
  scene.add(ground);

  const roadW = map.roadKind === 'highway' ? 7 : 4;
  const roadColor = map.roadKind === 'highway' ? 0x2a2a32 : 0x282430;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const roadMat = new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: 0.88,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, POI_RADIUS * 1.4), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.y = -angle;
    road.position.set(x / 2, 0.05, z / 2);
    scene.add(road);
    if (map.roadKind === 'highway') {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.35, POI_RADIUS * 1.35),
        new THREE.MeshStandardMaterial({ color: 0xd8b840, roughness: 0.7, metalness: 0.05 })
      );
      line.rotation.x = -Math.PI / 2;
      line.rotation.y = -angle;
      line.position.set(x / 2, 0.06, z / 2);
      scene.add(line);
    }
  }

  const coords = poiCoords();
  const treeCount = TREE_COUNTS[quality];
  if (treeCount > 0 && map.treeKind === 'forest') {
    scatterInstancedTrees(scene, {
      count: treeCount,
      minDist: 30,
      maxDist: MAP_BOUND - 40,
      skipNear: skipNearPoi(coords, 40),
      castShadow: quality !== 'low' && !isMobileDevice(),
    });
  } else if (treeCount > 0 && map.treeKind === 'palm') {
    const palms = isMobileDevice() ? Math.floor(treeCount * 0.45) : treeCount;
    scatterPalms(scene, {
      count: palms,
      minDist: 14,
      maxDist: MAP_BOUND - 24,
      skipNear: skipNearPoi(coords, 32),
    });
  } else if (map.treeKind === 'sparse' && quality !== 'low') {
    scatterInstancedTrees(scene, {
      count: Math.floor(treeCount * 0.35),
      minDist: 36,
      maxDist: MAP_BOUND - 36,
      skipNear: skipNearPoi(coords, 40),
      castShadow: false,
    });
  }

  let grassCount = Math.floor(GRASS_COUNTS[quality] * map.grassMul);
  if (grassCount > 0 && isMobileDevice()) grassCount = Math.floor(grassCount * 0.55);
  if (grassCount > 0) {
    scatterInstancedGrass(scene, {
      count: grassCount,
      minDist: 8,
      maxDist: MAP_BOUND - 20,
      skipNear: skipNearPoi(coords, 28),
    });
  }

  if (map.parkedCars && quality !== 'low') {
    scatterParkedCars(scene, isMobileDevice() ? 14 : 24, MAP_BOUND);
  }

  const pois: { name: string; group: THREE.Group; position: THREE.Vector3 }[] = [];
  const shadows = quality !== 'low';
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * POI_RADIUS;
    const z = Math.sin(angle) * POI_RADIUS;
    const district = poiDistrictAt(i);
    const group = buildPoiGroup(district, i, quality, shadows, {
      scale: map.poiScale,
      urban: map.urbanPoi,
    });
    group.position.set(x, 0, z);
    scene.add(group);
    pois.push({ name: district, group, position: new THREE.Vector3(x, 0, z) });
  }

  return { scene, camera, renderer, controls, pois, mapId };
}
