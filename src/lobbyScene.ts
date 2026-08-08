import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './renderer';
import { addGradientSky, applyTealFog, configureSunShadow } from './graphics';
import { createRobotModel, updateRobotAnim } from './robot';
import { attachHeldWeaponKit, createHeldWeaponKit, syncHeldWeaponKit } from './heldWeapons';
import type { QualityPreset } from './scene';

export interface LobbyCosmetics {
  chassisColor: number;
  rifleColor: number;
  pistolColor: number;
}

export interface LobbySceneHandle {
  start(): void;
  stop(): void;
  setCosmetics(cosmetics: LobbyCosmetics): void;
  dispose(): void;
}

/** Lightweight 3D backdrop for the lobby — robot on a podium, orbit camera, no match sim. */
export function createLobbyScene(
  canvas: HTMLCanvasElement,
  quality: QualityPreset,
  cosmetics: LobbyCosmetics
): LobbySceneHandle {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:0;pointer-events:none;';

  const renderer = createRenderer(canvas, quality);
  const scene = new THREE.Scene();
  addGradientSky(scene, { topColor: 0x0a1018, bottomColor: 0x1a2838, radius: 40 });
  applyTealFog(scene, 5, 20, 0x0a1218);

  const shadowsOn = quality === 'medium';

  const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 60);
  camera.position.set(2.8, 1.6, 3.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.2;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.enablePan = false;

  const ambient = new THREE.AmbientLight(0x4a5868, 0.32);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xd8c8a8, 1.65);
  key.position.set(3, 5.5, 2.5);
  if (shadowsOn) configureSunShadow(key, 3, 1024, true);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6a8a5a, 0.48);
  rim.position.set(-2.5, 2.5, -3);
  scene.add(rim);

  const backRim = new THREE.DirectionalLight(0x4a6078, 0.28);
  backRim.position.set(0, 2, -4);
  scene.add(backRim);

  const podiumGlow = new THREE.PointLight(0x7a8f5c, 0.65, 4.5, 2);
  podiumGlow.position.set(0, 0.5, 0);
  scene.add(podiumGlow);

  const floorGlow = new THREE.PointLight(0x5a7a8a, 0.28, 6, 2);
  floorGlow.position.set(0, 0.1, 1.5);
  scene.add(floorGlow);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 32),
    new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.88, metalness: 0.32 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = shadowsOn;
  scene.add(floor);

  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.05, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.5, metalness: 0.52 })
  );
  podium.position.y = 0.175;
  podium.castShadow = shadowsOn;
  podium.receiveShadow = shadowsOn;
  scene.add(podium);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.04, 8, 48),
    new THREE.MeshStandardMaterial({
      color: 0x7a8f5c,
      emissive: 0x4a5e34,
      emissiveIntensity: 0.5,
      metalness: 0.75,
      roughness: 0.22,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  scene.add(ring);

  const { group: robotGroup, anim } = createRobotModel(cosmetics.chassisColor);
  robotGroup.position.y = 0.35;
  robotGroup.rotation.y = Math.PI * 0.12;
  robotGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = shadowsOn;
      obj.receiveShadow = shadowsOn;
    }
  });
  scene.add(robotGroup);

  const held = createHeldWeaponKit({
    rifle: cosmetics.rifleColor,
    pistol: cosmetics.pistolColor,
  });
  attachHeldWeaponKit(robotGroup, held);
  syncHeldWeaponKit(held, 'rifle');

  let raf = 0;
  let last = performance.now();
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateRobotAnim(anim, dt);
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const applyCosmetics = (c: LobbyCosmetics) => {
    createRobotModel(c.chassisColor);
    robotGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        const mat = obj.material;
        if (mat.emissiveIntensity > 0.5) return;
        const tint = new THREE.Color(c.chassisColor);
        if (mat.metalness > 0.65)
          mat.color.copy(tint.clone().lerp(new THREE.Color(0xffffff), 0.35));
        else mat.color.copy(tint.clone().multiplyScalar(0.55));
      }
    });
    held.rifle.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color.setHex(c.rifleColor);
      }
    });
    held.pistol.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color.setHex(c.pistolColor);
      }
    });
  };

  applyCosmetics(cosmetics);
  window.addEventListener('resize', onResize);

  return {
    start() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    setCosmetics(c) {
      applyCosmetics(c);
    },
    dispose() {
      this.stop();
      window.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m?.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
