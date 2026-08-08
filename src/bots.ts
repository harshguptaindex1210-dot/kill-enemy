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
    fireIntervalMs: 2800,
    strafe: false,
    moveSpeed: 5,
    preferredRange: 22,
  },
  medium: {
    difficulty: 'medium',
    aimError: 0.28,
    reactionMs: 900,
    fireIntervalMs: 2200,
    strafe: true,
    moveSpeed: 5.5,
    preferredRange: 18,
  },
  hard: {
    difficulty: 'hard',
    aimError: 0.18,
    reactionMs: 650,
    fireIntervalMs: 1800,
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
  lastThinkMs: number;
  lastInput: PlayerInput | null;
  /** Fixed offset so bots ring the target instead of stacking on one spot. */
  flankAngle: number;
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
    lastThinkMs: 0,
    lastInput: null,
    flankAngle: Math.random() * Math.PI * 2,
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
  /** Other bot positions within separation range — used to avoid stacking. */
  allyPositions?: THREE.Vector3[];
}

const SENSITIVITY = 0.002;
const SIGHT_RANGE = 140;
const ZONE_MARGIN = 25;
const LOOT_RANGE = 40;
const ROAM_RANGE = 80;
const HEAD_HEIGHT = 1.4;
const SEPARATION_RANGE = 18;
const SEPARATION_RADIUS = 7;

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
    const enemy = ctx.enemy.position;
    const dx = enemy.x - pos.x;
    const dz = enemy.z - pos.z;
    const toEnemyLen = Math.hypot(dx, dz);
    const flankDist = p.preferredRange;
    const awayX = toEnemyLen > 0.1 ? -dx / toEnemyLen : Math.sin(brain.flankAngle);
    const awayZ = toEnemyLen > 0.1 ? -dz / toEnemyLen : Math.cos(brain.flankAngle);
    const slotX = awayX * Math.cos(brain.flankAngle) - awayZ * Math.sin(brain.flankAngle);
    const slotZ = awayX * Math.sin(brain.flankAngle) + awayZ * Math.cos(brain.flankAngle);
    const flankPoint = new THREE.Vector3(
      enemy.x + slotX * flankDist,
      pos.y,
      enemy.z + slotZ * flankDist
    );
    const moveTarget = toEnemyLen > p.preferredRange + 2 ? flankPoint : enemy;
    const moveDist = toPoint(moveTarget);
    distToTarget = moveDist;
    desiredRange = p.preferredRange;
    const moveYawErr = wrapAngle(targetYaw - ctx.yaw);
    forward = moveDist > 1.5 && Math.abs(moveYawErr) < 0.75;
    backward = false;
    if (p.strafe && toEnemyLen > p.preferredRange + 6 && ctx.time - brain.lastGoalChange > 400) {
      if (ctx.time - brain.strafeTimer > 1500) {
        brain.strafeTimer = ctx.time;
        brain.strafeDir = brain.strafeDir === 1 ? -1 : 1;
      }
      strafeDir = brain.strafeDir;
    }

    // Aim at the enemy for fire checks and mouse deltas.
    const aimYaw = angleTo(pos, enemy);
    const aimDist = pos.distanceTo(enemy);
    const vertical = enemy.y + HEAD_HEIGHT - (pos.y + 1.2);
    const aimPitch = Math.max(-1.2, Math.min(1.2, Math.atan2(-vertical, Math.max(aimDist, 0.1))));
    targetYaw = aimYaw;
    targetPitch = aimPitch;

    const yawErr = wrapAngle(aimYaw - ctx.yaw);
    const pitchErr = Math.abs(aimPitch - ctx.pitch);
    const reactionDone = ctx.time - brain.lastGoalChange >= p.reactionMs * 0.65;
    const cooldownDone = ctx.time - brain.lastShotTime >= p.fireIntervalMs;
    if (
      reactionDone &&
      cooldownDone &&
      Math.abs(yawErr) < Math.max(0.38, p.aimError * 2.8) &&
      pitchErr < 0.55
    ) {
      if (ctx.weaponReady && Math.random() < 0.88) {
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

  // Steer away from nearby allies so squads don't collapse onto one point.
  if (ctx.allyPositions?.length) {
    let sepX = 0;
    let sepZ = 0;
    for (const ally of ctx.allyPositions) {
      const sdx = pos.x - ally.x;
      const sdz = pos.z - ally.z;
      const sd = Math.hypot(sdx, sdz);
      if (sd > 0.1 && sd < SEPARATION_RANGE) {
        const push = (SEPARATION_RADIUS - sd) / SEPARATION_RADIUS;
        sepX += (sdx / sd) * push;
        sepZ += (sdz / sd) * push;
      }
    }
    if (Math.hypot(sepX, sepZ) > 0.05) {
      const sepYaw = Math.atan2(sepX, sepZ);
      const sepErr = wrapAngle(sepYaw - ctx.yaw);
      if (sepErr > 0.2) {
        strafeDir = 1;
        forward = false;
      } else if (sepErr < -0.2) {
        strafeDir = -1;
        forward = false;
      } else if (Math.abs(sepErr) < 0.35) {
        forward = true;
      }
    }
  }

  const yawDelta = wrapAngle(targetYaw - ctx.yaw);
  const pitchDelta = targetPitch - ctx.pitch;
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
