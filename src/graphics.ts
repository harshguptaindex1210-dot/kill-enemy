import * as THREE from 'three';
import type { QualityPreset } from './scene';

export function applyRendererLook(renderer: THREE.WebGLRenderer, quality: QualityPreset): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality === 'high' ? 1.22 : quality === 'medium' ? 1.14 : 1.04;
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
        'uniform vec3 topColor,bottomColor,sunDir;varying vec3 vWorldPosition;void main(){vec3 d=normalize(vWorldPosition);float h=pow(clamp(d.y*.5+.5,0.,1.),.55);vec3 c=mix(bottomColor,topColor,h);c+=vec3(1.,.9,.75)*pow(max(dot(d,sunDir),0.),96.)*.38;gl_FragColor=vec4(c,1.);}',
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
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#455838';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) {
    const v = 42 + Math.random() * 48;
    g.fillStyle = `rgba(${v | 0},${(v * 0.88) | 0},${(v * 0.52) | 0},0.14)`;
    g.fillRect((Math.random() * 64) | 0, (Math.random() * 64) | 0, 2, 2);
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
    color: 0x3a6a32,
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
