import * as THREE from 'three';
import type { QualityPreset } from './scene';
import { styleMat } from './artStyle';

export function applyRendererLook(renderer: THREE.WebGLRenderer, quality: QualityPreset): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality === 'high' ? 1.32 : quality === 'medium' ? 1.22 : 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export interface SkyOptions {
  topColor?: number;
  bottomColor?: number;
  radius?: number;
  segments?: number;
  rings?: number;
}

const SKY_SUN_DIR = new THREE.Vector3(0.52, 0.4, 0.72).normalize();

export function addGradientSky(scene: THREE.Scene, options: SkyOptions = {}): THREE.Mesh {
  const topColor = new THREE.Color(options.topColor ?? 0x243a52);
  const bottomColor = new THREE.Color(options.bottomColor ?? 0xb8a898);
  const radius = options.radius ?? 800;
  const segments = options.segments ?? 24;
  const rings = options.rings ?? 12;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, rings),
    new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
        sunDir: { value: SKY_SUN_DIR },
      },
      vertexShader:
        'varying vec3 vWorldPosition;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorldPosition=wp.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:
        'uniform vec3 topColor,bottomColor,sunDir;varying vec3 vWorldPosition;void main(){vec3 d=normalize(vWorldPosition);float h=pow(clamp(d.y*.5+.5,0.,1.),.48);vec3 c=mix(bottomColor,topColor,h);c=mix(c,c*.82+vec3(.14,.09,.04),pow(1.-h,2.2)*.42);c+=vec3(1.,.88,.68)*pow(max(dot(d,sunDir),0.),88.)*.45;c=mix(c,bottomColor,pow(1.-h,3.5)*.18);gl_FragColor=vec4(c,1.);}',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  scene.add(mesh);
  return mesh;
}

export function createDirtGroundTexture(repeat = 16): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a5c38';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) {
    const v = 34 + Math.random() * 58;
    g.fillStyle = `rgba(${v | 0},${(v * 0.94) | 0},${(v * 0.5) | 0},0.14)`;
    const s = 2 + ((Math.random() * 3) | 0);
    g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, s, s);
  }
  for (let i = 0; i < 18; i++) {
    const v = 52 + Math.random() * 36;
    g.fillStyle = `rgba(${v | 0},${(v * 1.02) | 0},${(v * 0.55) | 0},0.1)`;
    g.beginPath();
    g.arc(
      (Math.random() * 128) | 0,
      (Math.random() * 128) | 0,
      8 + Math.random() * 14,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  for (let i = 0; i < 28; i++) {
    g.fillStyle = 'rgba(58,48,32,0.1)';
    g.fillRect(
      (Math.random() * 120) | 0,
      (Math.random() * 128) | 0,
      8 + ((Math.random() * 10) | 0),
      1
    );
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function createAsphaltGroundTexture(repeat = 16): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3c42';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) {
    const v = 48 + Math.random() * 28;
    g.fillStyle = `rgba(${v | 0},${v | 0},${(v + 4) | 0},0.12)`;
    g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 3, 3);
  }
  g.strokeStyle = 'rgba(220,190,80,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(128, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function createSandGroundTexture(repeat = 16): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8a870';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    const v = 160 + Math.random() * 50;
    g.fillStyle = `rgba(${v | 0},${(v * 0.82) | 0},${(v * 0.48) | 0},0.16)`;
    g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function groundTextureFor(
  kind: 'dirt' | 'asphalt' | 'sand',
  repeat: number
): THREE.CanvasTexture {
  if (kind === 'asphalt') return createAsphaltGroundTexture(repeat);
  if (kind === 'sand') return createSandGroundTexture(repeat);
  return createDirtGroundTexture(repeat);
}

export function applyTealFog(
  scene: THREE.Scene,
  near: number,
  far: number,
  color = 0x9aa8a0
): void {
  void near;
  const density = 2.35 / Math.max(far, 1);
  scene.fog = new THREE.FogExp2(color, density);
  scene.background = null;
}

export interface MapLightingPreset {
  ambientColor: number;
  ambientIntensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  mapId: 'meadow' | 'city' | 'desert';
}

/** Three-point sun + fill + rim for readable characters and unified outdoor look. */
export function addMapLighting(
  scene: THREE.Scene,
  preset: MapLightingPreset,
  quality: QualityPreset,
  bound: number
): THREE.DirectionalLight {
  scene.add(new THREE.AmbientLight(preset.ambientColor, preset.ambientIntensity));

  const sun = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
  sun.position.set(118, 92, 148);
  if (quality !== 'low') {
    configureSunShadow(sun, bound, quality === 'high' ? 2048 : 1024, quality === 'high');
  }
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x7a9cb8, preset.mapId === 'city' ? 0.24 : 0.3);
  fill.position.set(-96, 52, -118);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(preset.sunColor, preset.mapId === 'desert' ? 0.44 : 0.36);
  rim.position.set(-132, 74, -92);
  scene.add(rim);

  scene.add(
    new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity + 0.08)
  );

  return sun;
}

export function configureSunShadow(
  light: THREE.DirectionalLight,
  bound: number,
  mapSize = 2048,
  soft = true
): void {
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.camera.near = 1;
  light.shadow.camera.far = bound * 1.8;
  light.shadow.camera.left = -bound;
  light.shadow.camera.right = bound;
  light.shadow.camera.top = bound;
  light.shadow.camera.bottom = -bound;
  light.shadow.bias = -0.00035;
  light.shadow.normalBias = 0.028;
  light.shadow.radius = soft ? 2.5 : 0;
}

export interface TreeScatterOptions {
  count: number;
  minDist: number;
  maxDist: number;
  skipNear?: (x: number, z: number) => boolean;
  castShadow?: boolean;
}

export function scatterInstancedTrees(scene: THREE.Scene, opts: TreeScatterOptions): void {
  const { count, minDist, maxDist, skipNear, castShadow = false } = opts;
  const trunkMat = styleMat(0x4a3520, 'rubber');
  const leafMat = styleMat(0x4a7a38, 'foliage');

  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 5);
  const leafGeo = new THREE.SphereGeometry(0.8, 5, 4);

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
  trunkMesh.castShadow = castShadow;
  leafMesh.castShadow = castShadow;

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 4;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (skipNear?.(x, z)) continue;

    const scale = 0.85 + Math.random() * 0.35;
    dummy.position.set(x, 1, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(x, 2.8 + Math.random() * 0.5, z);
    dummy.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(placed, dummy.matrix);

    placed++;
  }

  trunkMesh.count = placed;
  leafMesh.count = placed;
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;

  scene.add(trunkMesh);
  scene.add(leafMesh);
}

export interface GrassScatterOptions {
  count: number;
  minDist: number;
  maxDist: number;
  skipNear?: (x: number, z: number) => boolean;
}

/** Crossed grass billboards — cheap meadow fill for battle-royale outdoor maps. */
export function scatterInstancedGrass(scene: THREE.Scene, opts: GrassScatterOptions): void {
  const { count, minDist, maxDist, skipNear } = opts;
  const bladeGeo = new THREE.PlaneGeometry(0.35, 0.75);
  bladeGeo.translate(0, 0.38, 0);
  const bladeMat = styleMat(0xffffff, 'foliage');
  bladeMat.side = THREE.DoubleSide;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, count * 2);
  blades.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 2 * 3), 3);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 5;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (skipNear?.(x, z)) continue;

    const scale = 0.7 + Math.random() * 0.55;
    const yaw = Math.random() * Math.PI;
    tint.setHSL(
      0.28 + Math.random() * 0.06,
      0.42 + Math.random() * 0.12,
      0.34 + Math.random() * 0.1
    );

    for (let b = 0; b < 2; b++) {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, yaw + b * (Math.PI / 2), 0);
      dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.2), scale);
      dummy.updateMatrix();
      const idx = placed * 2 + b;
      blades.setMatrixAt(idx, dummy.matrix);
      blades.setColorAt(idx, tint);
    }
    placed++;
  }

  blades.count = placed * 2;
  blades.instanceMatrix.needsUpdate = true;
  if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
  scene.add(blades);
}

export function scatterPalms(scene: THREE.Scene, opts: GrassScatterOptions): void {
  const { count, minDist, maxDist, skipNear } = opts;
  const trunkMat = styleMat(0x8a6840, 'rubber');
  const leafMat = styleMat(0x4a8a38, 'foliage');
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 3.2, 5);
  const leafGeo = new THREE.SphereGeometry(0.55, 5, 4);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 4) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (skipNear?.(x, z)) continue;
    const scale = 0.9 + Math.random() * 0.5;
    dummy.position.set(x, 1.6 * scale, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.set(x, 3.4 * scale, z);
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  leaves.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(leaves);
}

export function scatterParkedCars(scene: THREE.Scene, count: number, bound: number): void {
  const colors = [0xc04030, 0x305080, 0xd0d0d8, 0x202028, 0x408050];
  const geo = new THREE.BoxGeometry(1.8, 0.9, 3.6);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const mat = styleMat(colors[i % colors.length]!, 'paint');
    const car = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * (bound - 30);
    car.position.set(Math.cos(angle) * dist, 0.45, Math.sin(angle) * dist);
    car.rotation.y = Math.random() * Math.PI;
    scene.add(car);
    void dummy;
  }
}
