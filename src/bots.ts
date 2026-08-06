import * as THREE from 'three';
import type { PlayerInput } from './player';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotProfile {
  difficulty: BotDifficulty;
  aimError: number;
  reactionMs: number;
  fireIntervalMs: number;
  strafe: boolean;
  moveSpeed: number;
  preferredRange: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    difficulty: 'easy',
    aimError: 0.42,
    reactionMs: 1400,
    fireIntervalMs: 4500,
    strafe: false,
    moveSpeed: 5,
    preferredRange: 22,
  },
  medium: {
    difficulty: 'medium',
    aimError: 0.28,
    reactionMs: 900,
    fireIntervalMs: 3800,
    strafe: true,
    moveSpeed: 5.5,
    preferredRange: 18,
  },
  hard: {
    difficulty: 'hard',
    aimError: 0.18,
    reactionMs: 650,
    fireIntervalMs: 3000,
    strafe: true,
    moveSpeed: 6,
    preferredRange: 15,
  },
};

export type BotGoal = 'combat' | 'loot' | 'zone' | 'roam';

export interface BotBrain {
  profile: BotProfile;
  goal: BotGoal;
  targetLootId: number | null;
  lastGoalChange: number;
  lastShotTime: number;
  strafeDir: 1 | -1;
  strafeTimer: number;
}

export function createBotBrain(difficulty: BotDifficulty): BotBrain {
  return {
    profile: BOT_PROFILES[difficulty],
    goal: 'roam',
    targetLootId: null,
    lastGoalChange: 0,
    lastShotTime: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
  };
}

export interface BotContext {
  brain: BotBrain;
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  time: number;
  dt: number;
  enemy: { position: THREE.Vector3 } | null;
  loot: { id: number; position: THREE.Vector3 } | null;
  safeCenter: THREE.Vector3;
  safeRadius: number;
  weaponReady: boolean;
  needsReload: boolean;
}

const SENSITIVITY = 0.002;
const SIGHT_RANGE = 140;
const ZONE_MARGIN = 25;
const LOOT_RANGE = 40;
const ROAM_RANGE = 80;
const HEAD_HEIGHT = 1.4;

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function angleTo(from: THREE.Vector3, to: THREE.Vector3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.atan2(-dx, -dz);
}

export function decideBotInput(ctx: BotContext): PlayerInput {
  const { brain, pos } = ctx;
  const p = brain.profile;

  const isOutsideSafe = pos.distanceTo(ctx.safeCenter) > ctx.safeRadius - ZONE_MARGIN;
  const inSight = ctx.enemy && ctx.enemy.position.distanceTo(pos) <= SIGHT_RANGE;

  let goal: BotGoal = 'roam';
  if (inSight) goal = 'combat';
  else if (isOutsideSafe) goal = 'zone';
  else if (ctx.loot && ctx.loot.position.distanceTo(pos) <= LOOT_RANGE) goal = 'loot';

  if (goal !== brain.goal) {
    brain.goal = goal;
    brain.lastGoalChange = ctx.time;
    brain.targetLootId = ctx.loot ? ctx.loot.id : null;
  }

  let targetYaw = ctx.yaw;
  let targetPitch = ctx.pitch;
  let desiredRange = ROAM_RANGE;
  let distToTarget = ROAM_RANGE;
  let forward = false;
  let backward = false;
  let strafeDir = 0;
  let fire = false;
  let reload = false;
  let skill = false;

  const toPoint = (pt: THREE.Vector3): number => {
    targetYaw = angleTo(pos, pt);
    const dist = pos.distanceTo(pt);
    const vertical = pt.y + HEAD_HEIGHT - (pos.y + 1.2);
    targetPitch = Math.max(-1.2, Math.min(1.2, Math.atan2(-vertical, Math.max(dist, 0.1))));
    return dist;
  };

  if (goal === 'combat' && ctx.enemy) {
    const dist = toPoint(ctx.enemy.position);
    distToTarget = dist;
    desiredRange = p.preferredRange;
    // Chase until close — prior kiting band (backward when dist < preferredRange-4) made bots flee on approach.
    const meleeDist = 4;
    forward = dist > meleeDist;
    backward = p.strafe && dist < meleeDist + 1 && dist > meleeDist * 0.5;
    if (p.strafe && ctx.time - brain.lastGoalChange > 400) {
      if (ctx.time - brain.strafeTimer > 1500) {
        brain.strafeTimer = ctx.time;
        brain.strafeDir = brain.strafeDir === 1 ? -1 : 1;
      }
      strafeDir = brain.strafeDir;
    }

    const yawErr = Math.abs(wrapAngle(targetYaw - ctx.yaw));
    const pitchErr = Math.abs(wrapAngle(targetPitch - ctx.pitch));
    const reactionDone = ctx.time - brain.lastGoalChange >= p.reactionMs;
    const cooldownDone = ctx.time - brain.lastShotTime >= p.fireIntervalMs;
    if (
      reactionDone &&
      cooldownDone &&
      yawErr < Math.max(0.28, p.aimError * 2.2) &&
      pitchErr < 0.4
    ) {
      if (ctx.weaponReady && Math.random() < 0.55) {
        fire = true;
        brain.lastShotTime = ctx.time;
        if (Math.random() < 0.2) skill = true;
      } else if (ctx.needsReload) {
        reload = true;
      }
    }
  } else if (goal === 'zone') {
    distToTarget = toPoint(ctx.safeCenter);
    forward = distToTarget > 3;
  } else if (goal === 'loot' && ctx.loot) {
    distToTarget = toPoint(ctx.loot.position);
    desiredRange = 1.5;
    forward = distToTarget > 2;
  } else {
    const roamTarget = new THREE.Vector3(
      pos.x + Math.sin(brain.lastGoalChange + pos.z) * ROAM_RANGE * 0.5,
      pos.y,
      pos.z + Math.cos(brain.lastGoalChange + pos.x) * ROAM_RANGE * 0.5
    );
    distToTarget = toPoint(roamTarget);
    forward = distToTarget > 5;
  }

  const yawDelta = wrapAngle(targetYaw - ctx.yaw);
  const pitchDelta = wrapAngle(targetPitch - ctx.pitch);
  const aimNoise = (Math.random() - 0.5) * p.aimError;

  return {
    forward,
    backward,
    left: strafeDir === -1,
    right: strafeDir === 1,
    sprint: forward && distToTarget > desiredRange + 10,
    crouch: false,
    jump: false,
    aim: goal === 'combat',
    fire,
    reload,
    skill,
    weapon1: false,
    weapon2: false,
    weapon3: false,
    mouseX: -(yawDelta + aimNoise) / SENSITIVITY,
    mouseY: -pitchDelta / SENSITIVITY,
  };
}

export function pickDifficulty(seed: number): BotDifficulty {
  const r = seededRandom(seed);
  if (r < 0.4) return 'easy';
  if (r < 0.75) return 'medium';
  return 'hard';
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
