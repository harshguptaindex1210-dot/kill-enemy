import * as THREE from 'three';
import type { QualityPreset } from './scene';

/** Bright outdoor probe — gives PBR surfaces sky bounce without an HDR file. */
export function attachDaylightEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  quality: QualityPreset
): { dispose: () => void } {
  if (quality === 'low') return { dispose: () => {} };

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const probe = new THREE.Scene();
  probe.add(new THREE.HemisphereLight(0xd8ecff, 0x6a5840, 1.35));
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(8, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xb8dcff, side: THREE.BackSide })
  );
  probe.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff4d8 })
  );
  sunDisc.position.set(6, 10, 4);
  probe.add(sunDisc);

  const envMap = pmrem.fromScene(probe, 0.08).texture;
  scene.environment = envMap;
  scene.environmentIntensity = quality === 'high' ? 1.15 : 0.95;

  return {
    dispose: () => {
      pmrem.dispose();
      envMap.dispose();
      scene.environment = null;
      scene.environmentIntensity = 1;
    },
  };
}
