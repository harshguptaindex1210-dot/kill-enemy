import * as THREE from 'three';
import type { ShootingTarget } from './targets';

export interface TargetMeshParts {
  group: THREE.Group;
  board: THREE.Mesh;
}

const POST_GEO = new THREE.CylinderGeometry(0.08, 0.1, 1, 6);
const BOARD_GEO = new THREE.BoxGeometry(1.2, 1.2, 0.08);
const POST_MAT = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.85 });

function buildTargetMesh(target: ShootingTarget): TargetMeshParts {
  const group = new THREE.Group();
  group.position.set(target.position.x, 0, target.position.z);
  group.rotation.y = target.yaw;
  const post = new THREE.Mesh(POST_GEO, POST_MAT);
  post.position.y = 0.5;
  group.add(post);
  const board = new THREE.Mesh(
    BOARD_GEO,
    new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      emissive: 0x443300,
      emissiveIntensity: 0.25,
      roughness: 0.55,
    })
  );
  board.position.y = 1.1;
  group.add(board);
  return { group, board };
}

function syncTargetMesh(parts: TargetMeshParts, target: ShootingTarget, simTime: number) {
  const mat = parts.board.material as THREE.MeshStandardMaterial;
  if (!target.alive) {
    parts.board.rotation.x = -Math.PI / 2.4;
    mat.emissiveIntensity = 0.05;
    mat.color.setHex(0x666655);
    return;
  }
  parts.board.rotation.x = 0;
  const flash = simTime - target.lastHitTime < 180;
  mat.emissiveIntensity = flash ? 1.2 : 0.25;
  mat.color.setHex(flash ? 0xffffff : 0xffdd44);
}

export function mountTargetMeshes(scene: THREE.Scene, targets: ShootingTarget[]) {
  const map = new Map<string, TargetMeshParts>();
  for (const t of targets) {
    const parts = buildTargetMesh(t);
    scene.add(parts.group);
    map.set(t.id, parts);
  }
  return map;
}

export function syncTargetMeshes(
  map: Map<string, TargetMeshParts>,
  targets: ShootingTarget[],
  simTime: number
) {
  for (const t of targets) {
    const parts = map.get(t.id);
    if (parts) syncTargetMesh(parts, t, simTime);
  }
}
