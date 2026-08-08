import * as THREE from 'three';
import { styleMat } from './artStyle';

export interface RobotAnimState {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
  root: THREE.Object3D;
}

/** Titanfall-style robot; `teamColor` tints chassis + accents (default human blue). */
export function createRobotModel(teamColor = 0x3366cc): {
  group: THREE.Group;
  anim: RobotAnimState;
} {
  const group = new THREE.Group();
  const base = new THREE.Color(teamColor);
  const body = base.clone().multiplyScalar(0.55);
  const accent = base.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const optic = base.clone().lerp(new THREE.Color(0x00ffff), 0.55);

  const bodyMat = styleMat(body.getHex(), 'paint');
  const accentMat = styleMat(accent.getHex(), 'metal');
  const opticMat = styleMat(optic.getHex(), 'emissive', optic.getHex(), 0.72);
  const darkMat = styleMat(0x222233, 'rubber');

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), bodyMat);
  torso.position.y = 0.9;
  group.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.15), accentMat);
  chest.position.set(0, 1.0, 0.35);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), bodyMat);
  head.position.y = 1.6;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), opticMat);
  visor.position.set(0, 1.6, 0.22);
  group.add(visor);

  const upperArmGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.4);
  [-0.55, 0.55].forEach((x, i) => {
    const arm = new THREE.Mesh(upperArmGeo, bodyMat);
    arm.position.set(x, 1.2, 0);
    arm.rotation.x = i === 0 ? 0.2 : -0.2;
    group.add(arm);
  });

  const lowerArmGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.35);
  [-0.6, 0.6].forEach((x) => {
    const arm = new THREE.Mesh(lowerArmGeo, accentMat);
    arm.position.set(x, 0.85, 0);
    group.add(arm);
  });

  const upperLegGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.45);
  [-0.2, 0.2].forEach((x) => {
    const leg = new THREE.Mesh(upperLegGeo, bodyMat);
    leg.position.set(x, 0.35, 0);
    group.add(leg);
  });

  const lowerLegGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.4);
  [-0.2, 0.2].forEach((x) => {
    const leg = new THREE.Mesh(lowerLegGeo, accentMat);
    leg.position.set(x, -0.05, 0);
    group.add(leg);
  });

  const footGeo = new THREE.BoxGeometry(0.18, 0.08, 0.25);
  [-0.2, 0.2].forEach((x) => {
    const foot = new THREE.Mesh(footGeo, darkMat);
    foot.position.set(x, -0.25, 0.05);
    group.add(foot);
  });

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
      tracks: [{ prop: '.position[y]', times: [0, 1, 2], values: [0, 0.02, 0] }],
    },
    walk: {
      duration: 0.5,
      loop: true,
      tracks: [{ prop: '.position[y]', times: [0, 0.25, 0.5], values: [0, 0.04, 0] }],
    },
    run: {
      duration: 0.3,
      loop: true,
      tracks: [{ prop: '.position[y]', times: [0, 0.15, 0.3], values: [0, 0.06, 0] }],
    },
    jump: {
      duration: 0.3,
      loop: false,
      tracks: [{ prop: '.scale[y]', times: [0, 0.1, 0.2, 0.3], values: [1, 0.9, 1.05, 1] }],
    },
    crouch: {
      duration: 0.2,
      loop: false,
      tracks: [{ prop: '.scale[y]', times: [0, 0.15], values: [1, 0.65] }],
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
          values: [0, 0.1, 0],
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
  const cur = anim.actions[anim.current];
  if (cur) cur.fadeOut(0.1);
  anim.actions[next].reset().fadeIn(0.1).play();
  anim.current = next;
}

export function updateRobotAnim(anim: RobotAnimState, dt: number) {
  anim.mixer.update(dt);
}
