import * as THREE from 'three';
import { styleMat } from './artStyle';

export interface RobotAnimState {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
  root: THREE.Object3D;
}

/** Shared soldier primitives — one GPU buffer per shape across all rigs. */
const SOLDIER_GEO = {
  vest: new THREE.BoxGeometry(0.62, 0.52, 0.34),
  torso: new THREE.BoxGeometry(0.48, 0.42, 0.26),
  plate: new THREE.BoxGeometry(0.14, 0.28, 0.06),
  pouch: new THREE.BoxGeometry(0.1, 0.12, 0.08),
  pelvis: new THREE.BoxGeometry(0.44, 0.18, 0.28),
  neck: new THREE.CylinderGeometry(0.09, 0.1, 0.1, 6),
  head: new THREE.SphereGeometry(0.14, 8, 8),
  helmet: new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62),
  visor: new THREE.BoxGeometry(0.2, 0.06, 0.06),
  hair: new THREE.BoxGeometry(0.12, 0.04, 0.14),
  backpack: new THREE.BoxGeometry(0.36, 0.42, 0.18),
  upperArm: new THREE.CylinderGeometry(0.075, 0.085, 0.34, 6),
  lowerArm: new THREE.CylinderGeometry(0.065, 0.075, 0.32, 6),
  hand: new THREE.BoxGeometry(0.08, 0.1, 0.06),
  upperLeg: new THREE.CylinderGeometry(0.11, 0.12, 0.42, 6),
  lowerLeg: new THREE.CylinderGeometry(0.09, 0.1, 0.4, 6),
  boot: new THREE.BoxGeometry(0.14, 0.1, 0.26),
  armband: new THREE.BoxGeometry(0.08, 0.06, 0.08),
};

function addSoldierMesh(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  position: THREE.Vector3Like,
  rotation?: { x?: number; y?: number; z?: number }
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position as THREE.Vector3);
  if (rotation) {
    if (rotation.x !== undefined) mesh.rotation.x = rotation.x;
    if (rotation.y !== undefined) mesh.rotation.y = rotation.y;
    if (rotation.z !== undefined) mesh.rotation.z = rotation.z;
  }
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

/** BGMI / PUBG-style tactical soldier; `teamColor` tints vest + armband. */
export function createRobotModel(teamColor = 0x3366cc): {
  group: THREE.Group;
  anim: RobotAnimState;
} {
  const group = new THREE.Group();
  const base = new THREE.Color(teamColor);
  const vestColor = base.clone().lerp(new THREE.Color(0x3d4a32), 0.35);
  const plateColor = base.clone().multiplyScalar(0.45);
  const armbandColor = base.clone();

  const skinMat = styleMat(0xc49a6c, 'paint');
  const vestMat = styleMat(vestColor.getHex(), 'paint');
  const plateMat = styleMat(plateColor.getHex(), 'metal');
  const helmetMat = styleMat(0x3a4038, 'metal');
  const visorMat = styleMat(0x1a2228, 'glass');
  const pantsMat = styleMat(0x4a5240, 'concrete');
  const bootMat = styleMat(0x1e1c18, 'rubber');
  const pouchMat = styleMat(0x2e3428, 'concrete');
  const armbandMat = styleMat(armbandColor.getHex(), 'paint');
  const hairMat = styleMat(0x2a2018, 'rubber');

  // Vest is first child — team tint readable at distance (matches robot.test.ts).
  addSoldierMesh(group, SOLDIER_GEO.vest, vestMat, { x: 0, y: 1.22, z: 0.02 });
  addSoldierMesh(group, SOLDIER_GEO.torso, skinMat, { x: 0, y: 1.2, z: 0 });

  addSoldierMesh(group, SOLDIER_GEO.plate, plateMat, { x: -0.22, y: 1.24, z: 0.2 });
  addSoldierMesh(group, SOLDIER_GEO.plate, plateMat, { x: 0.22, y: 1.24, z: 0.2 });

  [-0.18, 0.12, -0.12].forEach((x, i) => {
    addSoldierMesh(group, SOLDIER_GEO.pouch, pouchMat, { x, y: 1.08, z: 0.2 }, { y: i * 0.08 });
  });

  addSoldierMesh(group, SOLDIER_GEO.pelvis, pantsMat, { x: 0, y: 0.96, z: 0 });
  addSoldierMesh(group, SOLDIER_GEO.neck, skinMat, { x: 0, y: 1.48, z: 0 });
  const head = addSoldierMesh(group, SOLDIER_GEO.head, skinMat, { x: 0, y: 1.6, z: 0.02 });
  head.scale.set(1, 1.08, 0.95);

  const helmet = addSoldierMesh(group, SOLDIER_GEO.helmet, helmetMat, { x: 0, y: 1.64, z: 0 });
  helmet.scale.set(1.05, 0.9, 1.05);
  addSoldierMesh(group, SOLDIER_GEO.visor, visorMat, { x: 0, y: 1.6, z: 0.14 });
  addSoldierMesh(group, SOLDIER_GEO.hair, hairMat, { x: 0, y: 1.7, z: -0.06 });
  addSoldierMesh(group, SOLDIER_GEO.backpack, pouchMat, { x: 0, y: 1.18, z: -0.22 });

  for (const side of [-1, 1] as const) {
    const sx = side;
    addSoldierMesh(group, SOLDIER_GEO.armband, armbandMat, { x: 0.34 * sx, y: 1.38, z: 0.04 });
    addSoldierMesh(
      group,
      SOLDIER_GEO.upperArm,
      vestMat,
      { x: 0.36 * sx, y: 1.28, z: 0 },
      { z: side * 0.12 }
    );
    addSoldierMesh(
      group,
      SOLDIER_GEO.lowerArm,
      skinMat,
      { x: 0.4 * sx, y: 0.98, z: 0.04 },
      { z: side * 0.08 }
    );
    addSoldierMesh(group, SOLDIER_GEO.hand, skinMat, { x: 0.42 * sx, y: 0.78, z: 0.05 });
    addSoldierMesh(group, SOLDIER_GEO.upperLeg, pantsMat, { x: 0.13 * sx, y: 0.66, z: 0 });
    addSoldierMesh(group, SOLDIER_GEO.lowerLeg, pantsMat, { x: 0.13 * sx, y: 0.28, z: 0 });
    addSoldierMesh(group, SOLDIER_GEO.boot, bootMat, { x: 0.13 * sx, y: 0.05, z: 0.04 });
  }

  const anim = createAnimState(group);
  anim.actions.idle.play();
  return { group, anim };
}

function createAnimState(target: THREE.Object3D): RobotAnimState {
  const mixer = new THREE.AnimationMixer(target);
  const actions: Record<string, THREE.AnimationAction> = {};
  const defs: Record<
    string,
    {
      duration: number;
      loop: boolean;
      tracks: { prop: string; times: number[]; values: number[] }[];
    }
  > = {
    idle: {
      duration: 2,
      loop: true,
      tracks: [{ prop: '.position[y]', times: [0, 1, 2], values: [0, 0.015, 0] }],
    },
    walk: {
      duration: 0.5,
      loop: true,
      tracks: [
        { prop: '.position[y]', times: [0, 0.25, 0.5], values: [0, 0.035, 0] },
        { prop: '.rotation[z]', times: [0, 0.25, 0.5], values: [0, 0.02, 0] },
      ],
    },
    run: {
      duration: 0.3,
      loop: true,
      tracks: [
        { prop: '.position[y]', times: [0, 0.15, 0.3], values: [0, 0.055, 0] },
        { prop: '.rotation[z]', times: [0, 0.15, 0.3], values: [0, 0.035, 0] },
      ],
    },
    jump: {
      duration: 0.3,
      loop: false,
      tracks: [{ prop: '.scale[y]', times: [0, 0.1, 0.2, 0.3], values: [1, 0.92, 1.04, 1] }],
    },
    crouch: {
      duration: 0.2,
      loop: false,
      tracks: [{ prop: '.scale[y]', times: [0, 0.15], values: [1, 0.72] }],
    },
    melee: {
      duration: 0.25,
      loop: false,
      tracks: [
        {
          prop: '.rotation[y]',
          times: [0, 0.1, 0.25],
          values: [0, Math.PI / 2, 0],
        },
        {
          prop: '.position[y]',
          times: [0, 0.1, 0.25],
          values: [0, 0.08, 0],
        },
      ],
    },
  };

  for (const [name, def] of Object.entries(defs)) {
    const tracks = def.tracks.map((t) => new THREE.NumberKeyframeTrack(t.prop, t.times, t.values));
    const clip = new THREE.AnimationClip(name, def.duration, tracks);
    const action = mixer.clipAction(clip);
    action.setLoop(def.loop ? THREE.LoopRepeat : THREE.LoopOnce, def.loop ? Infinity : 1);
    actions[name] = action;
  }

  return { mixer, actions, current: 'idle', root: target };
}

export function transitionAnim(anim: RobotAnimState, next: string) {
  if (anim.current === next || !anim.actions[next]) return;
  if (anim.current === 'jump' || anim.current === 'crouch') {
    anim.root.scale.y = 1;
  }
  anim.root.rotation.z = 0;
  const cur = anim.actions[anim.current];
  if (cur) cur.fadeOut(0.1);
  anim.actions[next].reset().fadeIn(0.1).play();
  anim.current = next;
}

export function updateRobotAnim(anim: RobotAnimState, dt: number) {
  anim.mixer.update(dt);
}
