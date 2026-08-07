import * as THREE from 'three';
import type { QualityPreset } from './scene';

/** ACES tone mapping + sRGB output — richer PBR response, no extra bundle cost. */
export function applyRendererLook(renderer: THREE.WebGLRenderer, quality: QualityPreset): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality === 'medium' ? 1.12 : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export interface SkyOptions {
  topColor?: number;
  bottomColor?: number;
  radius?: number;
}

/** Procedural gradient sky dome — zero texture downloads. */
export function addGradientSky(scene: THREE.Scene, options: SkyOptions = {}): THREE.Mesh {
  const topColor = new THREE.Color(options.topColor ?? 0x3a7a9a);
  const bottomColor = new THREE.Color(options.bottomColor ?? 0x8ec8e8);
  const radius = options.radius ?? 800;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
      },
      vertexShader:
        'varying vec3 vWorldPosition;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorldPosition=wp.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:
        'uniform vec3 topColor,bottomColor;varying vec3 vWorldPosition;void main(){float h=pow(clamp(normalize(vWorldPosition).y*0.5+0.5,0.0,1.0),0.72);gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0);}',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  scene.add(mesh);
  return mesh;
}

export function applyTealFog(scene: THREE.Scene, near: number, far: number, color = 0x5a9ab0): void {
  scene.fog = new THREE.Fog(color, near, far);
  scene.background = null;
}

export function configureSunShadow(
  light: THREE.DirectionalLight,
  bound: number,
  mapSize = 2048
): void {
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.camera.near = 1;
  light.shadow.camera.far = bound * 1.8;
  light.shadow.camera.left = -bound;
  light.shadow.camera.right = bound;
  light.shadow.camera.top = bound;
  light.shadow.camera.bottom = -bound;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.025;
  light.shadow.radius = 2;
}

export interface TreeScatterOptions {
  count: number;
  minDist: number;
  maxDist: number;
  skipNear?: (x: number, z: number) => boolean;
  castShadow?: boolean;
}

/** Instanced low-poly trees — cheap draw calls, richer foliage. */
export function scatterInstancedTrees(scene: THREE.Scene, opts: TreeScatterOptions): void {
  const { count, minDist, maxDist, skipNear, castShadow = false } = opts;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.92, metalness: 0.02 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.82, metalness: 0.04 });

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
