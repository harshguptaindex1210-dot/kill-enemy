import * as THREE from 'three';
import type { QualityPreset } from './scene';

export function applyRendererLook(renderer: THREE.WebGLRenderer, quality: QualityPreset): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality === 'high' ? 1.26 : quality === 'medium' ? 1.18 : 1.06;
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
        'uniform vec3 topColor,bottomColor,sunDir;varying vec3 vWorldPosition;void main(){vec3 d=normalize(vWorldPosition);float h=pow(clamp(d.y*.5+.5,0.,1.),.48);vec3 c=mix(bottomColor,topColor,h);c=mix(c,c*.82+vec3(.14,.09,.04),pow(1.-h,2.2)*.42);c+=vec3(1.,.88,.68)*pow(max(dot(d,sunDir),0.),88.)*.45;gl_FragColor=vec4(c,1.);}',
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
    g.arc((Math.random() * 128) | 0, (Math.random() * 128) | 0, 8 + Math.random() * 14, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 28; i++) {
    g.fillStyle = 'rgba(58,48,32,0.1)';
    g.fillRect((Math.random() * 120) | 0, (Math.random() * 128) | 0, 8 + ((Math.random() * 10) | 0), 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function applyTealFog(
  scene: THREE.Scene,
  near: number,
  far: number,
  color = 0x9aa8a0
): void {
  scene.fog = new THREE.Fog(color, near, far);
  scene.background = null;
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
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3520,
    roughness: 0.94,
    metalness: 0.02,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4a7a38,
    roughness: 0.88,
    metalness: 0.03,
  });

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
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    roughness: 0.96,
    metalness: 0,
    vertexColors: false,
  });
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
    tint.setHSL(0.28 + Math.random() * 0.06, 0.42 + Math.random() * 0.12, 0.34 + Math.random() * 0.1);

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
