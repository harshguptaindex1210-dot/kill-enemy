import * as THREE from 'three';

const AXIS = new THREE.Vector3(0, 0, 1);
const LEN = 18;
const LIFE_MS = 90;

type Fx = { tracer: THREE.Mesh; until: number };

/** Shared hitscan streak: pool meshes, expire on the frame loop (no setTimeout). */
export function createShotTracerPool() {
  const geo = new THREE.BoxGeometry(0.08, 0.08, LEN);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
  const idle: Fx[] = [];
  const live: Fx[] = [];
  return {
    spawn(scene: THREE.Scene, muzzle: THREE.Vector3, dir: THREE.Vector3, now: number) {
      const fx = idle.pop() ?? { tracer: new THREE.Mesh(geo, mat), until: 0 };
      fx.tracer.position.copy(muzzle).addScaledVector(dir, LEN / 2);
      fx.tracer.quaternion.setFromUnitVectors(AXIS, dir);
      fx.tracer.visible = true;
      if (!fx.tracer.parent) scene.add(fx.tracer);
      fx.until = now + LIFE_MS;
      live.push(fx);
    },
    expire(now: number) {
      for (let i = live.length - 1; i >= 0; i--) {
        const fx = live[i]!;
        if (now < fx.until) continue;
        fx.tracer.visible = false;
        idle.push(fx);
        live.splice(i, 1);
      }
    },
    dispose(scene: THREE.Scene) {
      for (const fx of live) scene.remove(fx.tracer);
      for (const fx of idle) scene.remove(fx.tracer);
      live.length = 0;
      idle.length = 0;
      geo.dispose();
      mat.dispose();
    },
  };
}
