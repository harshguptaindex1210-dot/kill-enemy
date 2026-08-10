import * as THREE from 'three';
import type { GlooWall } from './glooWall';

const bag = new Map<number, THREE.Mesh>();
let geo: THREE.BoxGeometry | null = null;
let mat: THREE.MeshBasicMaterial | null = null;

export function paintGlooWalls(scene: THREE.Scene, walls: GlooWall[]) {
  const active = new Set<number>();
  for (const w of walls) {
    active.add(w.id);
    let mesh = bag.get(w.id);
    if (!mesh) {
      geo ??= new THREE.BoxGeometry(2.4, 1.55, 0.14);
      mat ??= new THREE.MeshBasicMaterial({ color: 0x3a9bd8, transparent: true, opacity: 0.72 });
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      bag.set(w.id, mesh);
    }
    mesh.visible = true;
    mesh.position.set(w.x, 0.775, w.z);
    mesh.rotation.y = w.yaw;
  }
  for (const [id, mesh] of bag) {
    if (!active.has(id)) {
      mesh.visible = false;
      scene.remove(mesh);
      bag.delete(id);
    }
  }
}
