import * as THREE from 'three';
import { styleMat } from './artStyle';

export interface RobotAnimState {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
  root: THREE.Object3D;
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
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.34), vestMat);
  vest.position.set(0, 1.22, 0.02);
  group.add(vest);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.26), skinMat);
  torso.position.set(0, 1.2, 0);
  group.add(torso);

  const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.06), plateMat);
  plateL.position.set(-0.22, 1.24, 0.2);
  group.add(plateL);
  const plateR = plateL.clone();
  plateR.position.x = 0.22;
  group.add(plateR);

  [-0.18, 0.12, -0.12].forEach((x, i) => {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), pouchMat);
    pouch.position.set(x, 1.08, 0.2);
    pouch.rotation.y = i * 0.08;
    group.add(pouch);
  });

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.28), pantsMat);
  pelvis.position.set(0, 0.96, 0);
  group.add(pelvis);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8), skinMat);
  neck.position.set(0, 1.48, 0);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), skinMat);
  head.position.set(0, 1.6, 0.02);
  head.scale.set(1, 1.08, 0.95);
  group.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat);
  helmet.position.set(0, 1.64, 0);
  helmet.scale.set(1.05, 0.9, 1.05);
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), visorMat);
  visor.position.set(0, 1.6, 0.14);
  group.add(visor);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.14), hairMat);
  hair.position.set(0, 1.7, -0.06);
  group.add(hair);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), pouchMat);
  backpack.position.set(0, 1.18, -0.22);
  group.add(backpack);

  const upperArmGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.34, 8);
  const lowerArmGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.32, 8);
  const handGeo = new THREE.BoxGeometry(0.08, 0.1, 0.06);
  const upperLegGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.42, 8);
  const lowerLegGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.4, 8);
  const bootGeo = new THREE.BoxGeometry(0.14, 0.1, 0.26);

  for (const side of [-1, 1] as const) {
    const sx = side;

    const armband = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), armbandMat);
    armband.position.set(0.34 * sx, 1.38, 0.04);
    group.add(armband);

    const upperArm = new THREE.Mesh(upperArmGeo, vestMat);
    upperArm.position.set(0.36 * sx, 1.28, 0);
    upperArm.rotation.z = side * 0.12;
    group.add(upperArm);

    const lowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
    lowerArm.position.set(0.4 * sx, 0.98, 0.04);
    lowerArm.rotation.z = side * 0.08;
    group.add(lowerArm);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0.42 * sx, 0.78, 0.05);
    group.add(hand);

    const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
    upperLeg.position.set(0.13 * sx, 0.66, 0);
    group.add(upperLeg);

    const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
    lowerLeg.position.set(0.13 * sx, 0.28, 0);
    group.add(lowerLeg);

    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0.13 * sx, 0.05, 0.04);
    group.add(boot);
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
