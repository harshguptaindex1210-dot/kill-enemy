import * as THREE from 'three';
import {
  createMatch,
  killPlayer,
  registerDamage,
  startCountdown,
  tickMatch,
  type MatchState,
} from './match';
import {
  MAP_BOUND,
  DEFAULT_POI_POSITIONS,
  DEFAULT_OBSTACLES,
  START_BANDAGES,
  START_MEDKITS,
  MAX_MEDKITS,
} from './constants';
import { ZoneLogic } from './zone';
import { createPlayer, type PlayerBundle, type PlayerInput } from './player';
import {
  createWeapon,
  fireWeapon,
  reloadWeapon,
  type WeaponState,
  type WeaponType,
} from './weapons';
import { createInventory, pickupAmmo, type Inventory } from './inventory';
import {
  createMeleeWeapon,
  startMeleeSwing,
  checkMeleeHit,
  updateMeleeSwing,
  type MeleeState,
  type MeleeType,
} from './melee';
import {
  createGrenadeSystem,
  throwGrenade,
  updateGrenades,
  aoeDamageAt,
  type GrenadeSystem,
} from './grenades';
import {
  createBotBrain,
  decideBotInput,
  pickDifficulty,
  type BotBrain,
  type BotDifficulty,
} from './bots';
import { generateLootData, collectLootData, type LootSpawnData } from './loot';
import {
  createAirdropSystem,
  updateAirdrops,
  despawnAirdropsByZone,
  claimAirdrop,
  type Airdrop,
  type AirdropSystem,
} from './airdrop';
import { createVehicle, updateVehicle, type VehicleState, type VehicleType } from './vehicle';
import { SKILL_DEFS, chassisById, type ChassisId, type SkillType } from './cosmetics';
import {
  applyTargetDamage,
  createShootingTargets,
  targetsForHitscan,
  updateTargetRespawns,
  type ShootingTarget,
} from './targets';
import { isMobileDevice } from './platform';

export type DamageCause = 'shot' | 'melee' | 'grenade' | 'zone' | 'vehicle';

export interface SimEvent {
  type:
    | 'kill'
    | 'explosion'
    | 'shot'
    | 'bounce'
    | 'hit'
    | 'pickup'
    | 'airdrop'
    | 'airdropDespawned'
    | 'heal'
    | 'step'
    | 'zone-incoming'
    | 'skill'
    | 'target-hit';
  time: number;
  [key: string]: unknown;
}

export interface SimUnit {
  id: string;
  name: string;
  isBot: boolean;
  botBrain: BotBrain | null;
  player: PlayerBundle;
  health: number;
  armor: number;
  alive: boolean;
  inventory: Inventory;
  weapons: (WeaponState | null)[];
  melee: MeleeState;
  meleeMode: boolean;
  grenadeCount: number;
  heals: { medkit: number; bandage: number };
  healing: { kind: 'medkit' | 'bandage'; until: number; healTotal: number } | null;
  lastDamageTime: number;
  inVehicleId: number | null;
  spawnPos: THREE.Vector3;
  color: number;
  lastStepTime: number;
  lastThrowTime: number;
  skill: SkillType;
  lastSkillTime: number;
  speedBoostUntil: number;
  overcharged: boolean;
}

export interface SimVehicle {
  id: number;
  type: VehicleType;
  state: VehicleState;
  spawnPos: THREE.Vector3;
}

export type VehicleActionReason =
  | 'entered'
  | 'exited'
  | 'not-alive'
  | 'none-available'
  | 'too-far';

export interface VehicleActionResult {
  ok: boolean;
  reason: VehicleActionReason;
  distance?: number;
  vehicleId?: number;
}

export interface MatchSimConfig {
  seed?: number;
  humanId?: string;
  humanName?: string;
  humanChassisId?: ChassisId;
  botCount?: number;
  botDifficulty?: 'mix' | BotDifficulty;
  time?: number;
  obstacles?: { x: number; z: number; r: number }[];
  lootPois?: { name: string; position: THREE.Vector3 }[];
}

const UNIT_RADIUS = 0.6;
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;
const GROUND_Y = 0;
const LOOT_RESPAWN_MS = 30000;
const GRENADE_THROW_COOLDOWN_MS = 800;
const GRENADE_KNOCKBACK = 6;
/** Armor loses half of blocked damage so vests last through paced fights. */
const ARMOR_DRAIN = 0.5;
/** Bot shots/melee deal less damage so the player isn't melted by 9 bots. */
const BOT_DAMAGE_SCALE = 0.45;
/** Distinct bot chassis tints so the arena reads as multi-faction, not all-red. */
const BOT_COLORS = [
  0xcc4444, 0x44cc66, 0xcc8844, 0xcc44aa, 0x44cccc, 0xcccc44, 0xaa66ff, 0xff6644, 0x66aaff,
];

const HEAL_DURATION: Record<'medkit' | 'bandage', number> = { medkit: 4000, bandage: 2000 };
const HEAL_AMOUNT: Record<'medkit' | 'bandage', number> = { medkit: 50, bandage: 15 };

function rngFor(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clampPos(v: THREE.Vector3) {
  v.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, v.x));
  v.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, v.z));
}

function idleInput(): PlayerInput {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
    aim: false,
    fire: false,
    reload: false,
    weapon1: false,
    weapon2: false,
    weapon3: false,
    mouseX: 0,
    mouseY: 0,
  };
}

export class MatchSim {
  match: MatchState;
  zone: ZoneLogic;
  grenades: GrenadeSystem;
  units: Map<string, SimUnit>;
  loot: LootSpawnData[] = [];
  lootRespawns: { id: number; until: number }[] = [];
  vehicles: SimVehicle[] = [];
  airdrops: AirdropSystem;
  targets: ShootingTarget[] = [];
  targetHits = new Map<string, number>();
  events: SimEvent[] = [];
  time: number;
  seed: number;
  order: string[];
  public readonly config: MatchSimConfig;
  private obstacles: { x: number; z: number; r: number }[];
  private rng: () => number;
  private spawnPoints: THREE.Vector3[] = [];
  private zoneDespawned = new Set<number>();

  constructor(config: MatchSimConfig = {}) {
    this.config = config;
    this.seed = config.seed ?? Math.floor(Math.random() * 100000);
    this.rng = rngFor(this.seed);
    this.time = config.time ?? 0;
    this.zone = new ZoneLogic();
    this.grenades = createGrenadeSystem();
    this.airdrops = createAirdropSystem();

    const botCount = config.botCount ?? 9;
    const humanId = config.humanId ?? 'player';
    const humanName = config.humanName ?? 'PLAYER';
    this.order = [humanId];
    for (let i = 1; i <= botCount; i++) this.order.push(`bot_${i}`);
    this.match = createMatch(this.order);

    const obstacles = config.obstacles ?? DEFAULT_OBSTACLES;
    this.obstacles = obstacles;
    this.spawnPoints = this.buildSpawnPoints(this.order.length);

    this.units = new Map();
    this.units.set(humanId, this.createUnit(humanId, humanName, false, null, 0));

    for (let i = 1; i <= botCount; i++) {
      const id = `bot_${i}`;
      const difficulty =
        config.botDifficulty === 'mix' || config.botDifficulty === undefined
          ? pickDifficulty(Math.floor(this.rng() * 1000) + i)
          : config.botDifficulty;
      this.units.set(id, this.createUnit(id, `BOT-${i}`, true, difficulty, i));
    }

    this.loot = generateLootData(config.lootPois ?? DEFAULT_POI_POSITIONS, this.rng);
    this.targets = createShootingTargets();
    this.spawnVehicles();
  }

  private buildSpawnPoints(count: number): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const spread = Math.min(count, 10);
    for (let i = 0; i < count; i++) {
      const a = (i / spread) * Math.PI * 2 + this.rng() * 0.12;
      const radius = 72 + (i % 4) * 24;
      const p = new THREE.Vector3(Math.cos(a) * radius, 0.9, Math.sin(a) * radius);
      if (this.obstacles.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 5)) {
        p.set(Math.cos(a) * 60, 0.9, Math.sin(a) * 60);
      }
      pts.push(p);
    }
    return pts;
  }

  private createUnit(
    id: string,
    name: string,
    isBot: boolean,
    difficulty: BotDifficulty | null,
    index: number
  ): SimUnit {
    const spawn = this.spawnPoints[index % this.spawnPoints.length].clone();
    const player = createPlayer(spawn.clone());
    const meleeType: MeleeType = index % 3 === 0 ? 'knife' : index % 3 === 1 ? 'pan' : 'bat';
    const inventory = createInventory();
    inventory.weapons[0] = 'rifle';
    const chassis = !isBot ? chassisById(this.config?.humanChassisId ?? 'blue') : null;
    const skill: SkillType = !isBot
      ? (chassis?.skill ?? 'speed')
      : (['speed', 'shield', 'overcharge'][index % 3] as SkillType);
    return {
      id,
      name,
      isBot,
      botBrain: isBot ? createBotBrain(difficulty ?? 'medium') : null,
      player,
      health: 100,
      armor: 0,
      alive: true,
      inventory,
      weapons: [createWeapon('rifle'), null],
      melee: createMeleeWeapon(meleeType),
      meleeMode: false,
      grenadeCount: 2,
      heals: { medkit: START_MEDKITS, bandage: START_BANDAGES },
      healing: null,
      lastDamageTime: -100000,
      inVehicleId: null,
      spawnPos: spawn,
      color: isBot ? BOT_COLORS[index % BOT_COLORS.length]! : (chassis?.color ?? 0x3366cc),
      lastStepTime: 0,
      lastThrowTime: -10000,
      skill,
      lastSkillTime: -100000,
      speedBoostUntil: 0,
      overcharged: false,
    };
  }

  private spawnVehicles() {
    const edge = MAP_BOUND - 20;
    const spots: [VehicleType, THREE.Vector3][] = [
      ['sedan', new THREE.Vector3(edge, 0, edge)],
      ['buggy', new THREE.Vector3(-edge, 0, edge)],
      ['sedan', new THREE.Vector3(edge, 0, -edge)],
      ['buggy', new THREE.Vector3(-edge, 0, -edge)],
      ['motorbike', new THREE.Vector3(48, 0, 36)],
      ['motorbike', new THREE.Vector3(-48, 0, 36)],
      ['motorbike', new THREE.Vector3(36, 0, -48)],
      ['motorbike', new THREE.Vector3(-36, 0, -48)],
    ];
    spots.forEach(([type, pos], i) => {
      const { state } = createVehicle(type, pos.clone());
      this.vehicles.push({ id: i + 1, type, state, spawnPos: pos.clone() });
    });
  }

  get aliveUnits(): SimUnit[] {
    return Array.from(this.units.values()).filter((u) => u.alive);
  }

  get humanId(): string {
    return this.order[0];
  }

  startMatch() {
    if (this.match.phase === 'lobby') {
      startCountdown(this.match, this.time);
    }
  }

  update(dt: number, humanInput?: PlayerInput) {
    const dtMs = dt * 1000;
    this.time += dtMs;
    tickMatch(this.match, dtMs, this.time);
    if (
      this.match.phase === 'lobby' ||
      this.match.phase === 'countdown' ||
      this.match.phase === 'dropping'
    ) {
      return;
    }
    if (this.match.phase === 'ended') return;

    for (const unit of this.units.values()) {
      if (!unit.alive) continue;
      const input = unit.isBot ? this.botInput(unit) : (humanInput ?? idleInput());
      this.updateUnit(unit, input, dt);
    }

    this.updateCombat();
    updateTargetRespawns(this.targets, this.time);
    this.updateHealing();
    this.updateZone(dt);
    this.updateGrenadeSim(dt);
    this.updateVehicles(dt);
    this.updateAirdrops();
    this.updateLootRespawns();
  }

  private botInput(unit: SimUnit): PlayerInput {
    const brain = unit.botBrain!;
    const enemy = this.nearestEnemy(unit);
    const inCombat = Boolean(
      enemy && enemy.player.position.distanceTo(unit.player.position) <= 140
    );
    const THINK_MS = inCombat
      ? isMobileDevice()
        ? 80
        : 0
      : isMobileDevice()
        ? 220
        : 80;
    if (brain.lastInput && THINK_MS > 0 && this.time - brain.lastThinkMs < THINK_MS) {
      return brain.lastInput;
    }
    const loot = THINK_MS > 0 ? null : this.nearestLoot(unit);
    const weapon = this.currentWeapon(unit);
    const zone = this.zone;
    const allyPositions: THREE.Vector3[] = [];
    for (const other of this.units.values()) {
      if (other.id === unit.id || !other.alive || !other.isBot) continue;
      const d = other.player.position.distanceTo(unit.player.position);
      if (d < 20) allyPositions.push(other.player.position);
    }
    const input = decideBotInput({
      brain,
      pos: unit.player.position,
      yaw: unit.player.yaw,
      pitch: unit.player.pitch,
      time: this.time,
      dt: 1 / 60,
      enemy: enemy ? { position: enemy.player.position } : null,
      loot,
      safeCenter: zone.center,
      safeRadius: zone.innerRadius,
      weaponReady: weapon ? weapon.ammo > 0 && !weapon.reloading : false,
      needsReload: weapon ? weapon.ammo === 0 : false,
      allyPositions,
    });
    brain.lastInput = input;
    brain.lastThinkMs = this.time;
    return input;
  }

  private nearestEnemy(unit: SimUnit): SimUnit | null {
    let best: SimUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units.values()) {
      if (other.id === unit.id || !other.alive) continue;
      let d = other.player.position.distanceTo(unit.player.position);
      // Prefer hunting the human so local matches feel contested.
      if (!other.isBot) d *= 0.55;
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  private nearestLoot(unit: SimUnit): { id: number; position: THREE.Vector3 } | null {
    let best: { id: number; position: THREE.Vector3 } | null = null;
    let bestDist = Infinity;
    for (const s of this.loot) {
      if (s.collected) continue;
      const d = s.position.distanceTo(unit.player.position);
      if (d < bestDist) {
        bestDist = d;
        best = { id: s.id, position: s.position };
      }
    }
    return best;
  }

  private currentWeapon(unit: SimUnit): WeaponState | null {
    return unit.weapons[unit.inventory.weaponIndex] ?? null;
  }

  private updateUnit(unit: SimUnit, input: PlayerInput, dt: number) {
    const bundle = unit.player;
    const now = this.time;

    if (input.weapon1) this.selectSlot(unit, 0);
    if (input.weapon2) this.selectSlot(unit, 1);
    if (input.weapon3) unit.meleeMode = true;
    if (input.skill) this.triggerSkill(unit.id);
    if (input.heal) this.useHealing(unit.id, 'medkit');

    const weapon = this.currentWeapon(unit);
    if (weapon) {
      if (input.reload && weapon.ammo < weapon.def.magSize && !weapon.reloading) {
        reloadWeapon(weapon, now);
      }
      if (weapon.reloading && now - weapon.reloadStart >= weapon.def.reloadTime * 1000) {
        const type = weapon.def.type;
        const pool = unit.inventory.ammo[type] ?? 0;
        const taken = Math.min(weapon.def.magSize - weapon.ammo, pool);
        weapon.ammo += taken;
        unit.inventory.ammo[type] = pool - taken;
        weapon.reloading = false;
      }
    }

    if (unit.inVehicleId !== null) {
      const v = this.vehicles.find((vv) => vv.id === unit.inVehicleId);
      if (v) {
        const throttle = input.forward ? 1 : input.backward ? -1 : 0;
        const steer = input.left ? 1 : input.right ? -1 : 0;
        updateVehicle(v.state, throttle, steer, dt, GROUND_Y);
        bundle.position.copy(v.state.position);
        bundle.setFacing(v.state.rotation);
        if (v.state.health <= 0) this.eject(unit);
      }
      return;
    }

    const speedMult = now < unit.speedBoostUntil ? 1.4 : 1.0;
    bundle.update(input, dt, GROUND_Y, speedMult);
    clampPos(bundle.position);
    this.resolveObstacles(unit);
    bundle.health = unit.health;

    if (unit.isBot) {
      this.tryPickup(unit.id);
    }

    if (input.fire) {
      if (unit.meleeMode || !weapon) this.tryMelee(unit);
      else if (weapon.def.isProjectile) this.throwGrenadeFor(unit.id);
      else this.tryFire(unit);
    }

    const moveSpeed = Math.hypot(bundle.velocity.x, bundle.velocity.z);
    if (moveSpeed > 1 && now - unit.lastStepTime > 350) {
      unit.lastStepTime = now;
      this.events.push({ type: 'step', time: now, unitId: unit.id });
    }
  }

  private selectSlot(unit: SimUnit, slot: number) {
    if (slot < unit.weapons.length && unit.weapons[slot] !== null) {
      unit.inventory.weaponIndex = slot;
      unit.meleeMode = false;
    }
  }

  private resolveObstacles(unit: SimUnit) {
    const pos = unit.player.position;
    for (const o of this.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const dist = Math.hypot(dx, dz);
      const minDist = o.r + UNIT_RADIUS;
      if (dist < minDist && dist > 0.001) {
        pos.x = o.x + (dx / dist) * minDist;
        pos.z = o.z + (dz / dist) * minDist;
      }
    }
  }

  private aimOrigin(unit: SimUnit): THREE.Vector3 {
    return new THREE.Vector3(
      unit.player.position.x,
      unit.player.getEyeHeight(),
      unit.player.position.z
    );
  }

  private tryFire(unit: SimUnit) {
    const weapon = this.currentWeapon(unit);
    if (!weapon) return;
    const now = this.time;
    if (weapon.reloading || weapon.ammo <= 0) return;

    const origin = this.aimOrigin(unit);
    const dir = this.aimDirection(unit);
    const unitTargets = this.aliveUnits
      .filter((t) => t.id !== unit.id)
      .map((t) => ({
        id: t.id,
        position: t.player.position,
        capsuleHeight: CAPSULE_HEIGHT,
        // Forgiving hitscan radius so paced shots still connect in TPS.
        capsuleRadius: Math.max(CAPSULE_RADIUS, 1.15),
      }));
    const shootTargets = targetsForHitscan(this.targets);
    const beforeFire = weapon.lastFireTime;
    const results = fireWeapon(weapon, origin, dir, [...unitTargets, ...shootTargets], now);
    // Rate-limited frames must not emit shot SFX / tracers.
    if (weapon.lastFireTime === beforeFire) return;
    this.events.push({
      type: 'shot',
      time: now,
      unitId: unit.id,
      weapon: weapon.def.type,
      yaw: unit.player.yaw,
    });
    for (const r of results) {
      if (r.hit && r.entityId) {
        if (r.entityId.startsWith('target_')) this.hitTarget(unit.id, r.entityId, r.damage);
        else this.applyDamage(unit.id, r.entityId, r.damage, 'shot');
      }
    }
  }

  hitTarget(attackerId: string, targetId: string, rawDamage: number) {
    const target = this.targets.find((t) => t.id === targetId);
    if (!target) return;
    const result = applyTargetDamage(target, rawDamage, this.time);
    if (result.damage <= 0) return;
    this.targetHits.set(attackerId, (this.targetHits.get(attackerId) ?? 0) + 1);
    this.events.push({
      type: 'target-hit',
      time: this.time,
      attackerId,
      targetId,
      damage: result.damage,
      destroyed: result.destroyed,
    });
  }

  getTargetHits(unitId: string): number {
    return this.targetHits.get(unitId) ?? 0;
  }

  private tryMelee(unit: SimUnit) {
    const now = this.time;
    if (!startMeleeSwing(unit.melee, now)) return;
    this.events.push({ type: 'shot', time: now, unitId: unit.id, melee: unit.melee.def.type });
  }

  throwGrenadeFor(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive) return false;
    if (this.time - unit.lastThrowTime < GRENADE_THROW_COOLDOWN_MS) return false;
    if (unit.grenadeCount <= 0) return false;
    unit.lastThrowTime = this.time;
    unit.grenadeCount--;
    const origin = this.aimOrigin(unit);
    throwGrenade(this.grenades, unit.id, origin, this.aimDirection(unit), 18, 2, GROUND_Y);
    this.events.push({ type: 'shot', time: this.time, unitId, grenade: true });
    return true;
  }

  private aimDirection(unit: SimUnit): THREE.Vector3 {
    const dir = new THREE.Vector3(
      -Math.sin(unit.player.yaw) * Math.cos(unit.player.pitch),
      -Math.sin(unit.player.pitch),
      -Math.cos(unit.player.yaw) * Math.cos(unit.player.pitch)
    );
    return dir.normalize();
  }

  triggerSkill(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive) return false;
    const def = SKILL_DEFS[unit.skill];
    if (!def) return false;
    if (this.time - unit.lastSkillTime < def.cooldownMs) return false;

    unit.lastSkillTime = this.time;
    if (unit.skill === 'speed') {
      unit.speedBoostUntil = this.time + 4000;
    } else if (unit.skill === 'shield') {
      unit.armor = Math.min(100, unit.armor + 30);
    } else if (unit.skill === 'overcharge') {
      unit.overcharged = true;
    }
    this.events.push({ type: 'skill', time: this.time, unitId: unit.id, skill: unit.skill });
    return true;
  }

  applyDamage(attackerId: string, victimId: string, raw: number, cause: DamageCause): boolean {
    const victim = this.units.get(victimId);
    if (!victim || !victim.alive) return false;

    const attacker = this.units.get(attackerId);
    let finalRaw = raw;
    if (attacker && attacker.overcharged && cause === 'shot') {
      finalRaw *= 1.5;
      attacker.overcharged = false;
    }
    const scaled =
      attacker?.isBot && (cause === 'shot' || cause === 'melee' || cause === 'grenade')
        ? finalRaw * BOT_DAMAGE_SCALE
        : finalRaw;

    const absorbed = Math.min(victim.armor, scaled);
    victim.armor = Math.max(0, victim.armor - absorbed * ARMOR_DRAIN);
    victim.health = Math.max(0, victim.health - (scaled - absorbed));
    victim.lastDamageTime = this.time;
    if (victim.healing) victim.healing = null;

    if (attackerId !== victimId) {
      registerDamage(this.match, attackerId, Math.round(scaled));
    }

    const isKill = victim.health <= 0;
    this.events.push({
      type: 'hit',
      time: this.time,
      attackerId,
      victimId,
      damage: Math.round(scaled),
      kill: isKill,
    });

    if (isKill) {
      victim.alive = false;
      victim.health = 0;
      victim.player.health = 0;
      killPlayer(this.match, victimId, attackerId !== victimId ? attackerId : null, cause);
      this.events.push({
        type: 'kill',
        time: this.time,
        victimId,
        victimName: victim.name,
        killerId: attackerId,
        killerName: this.units.get(attackerId)?.name ?? 'THE ZONE',
        cause,
      });
    }
    return isKill;
  }

  private updateCombat() {
    for (const unit of this.units.values()) {
      if (!unit.alive) continue;
      const res = updateMeleeSwing(unit.melee, this.time);
      if (res === 'hit') {
        const unitTargets = this.aliveUnits
          .filter((t) => t.id !== unit.id)
          .map((t) => ({
            id: t.id,
            position: t.player.position,
            capsuleRadius: CAPSULE_RADIUS,
            capsuleHeight: CAPSULE_HEIGHT,
          }));
        const practiceTargets = targetsForHitscan(this.targets);
        const hit = checkMeleeHit(unit.melee, unit.player.position, unit.player.yaw, [
          ...unitTargets,
          ...practiceTargets,
        ]);
        if (hit.hit && hit.targetId) {
          if (hit.targetId.startsWith('target_')) this.hitTarget(unit.id, hit.targetId, hit.damage);
          else this.applyDamage(unit.id, hit.targetId, hit.damage, 'melee');
        }
      }
    }
  }

  private updateHealing() {
    for (const unit of this.units.values()) {
      if (!unit.alive || !unit.healing) continue;
      if (this.time >= unit.healing.until) {
        unit.health = Math.min(100, unit.health + unit.healing.healTotal);
        unit.healing = null;
        this.events.push({ type: 'heal', time: this.time, unitId: unit.id });
      }
    }
  }

  useHealing(unitId: string, kind: 'medkit' | 'bandage') {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive || unit.healing) return;
    if (unit.health >= 100) return;
    if (unit.heals[kind] <= 0) return;
    unit.heals[kind]--;
    unit.healing = {
      kind,
      until: this.time + HEAL_DURATION[kind],
      healTotal: HEAL_AMOUNT[kind],
    };
  }

  private updateZone(dt: number) {
    this.zone.update(dt);
    if (this.zone.consumeZoneIncoming()) {
      this.events.push({ type: 'zone-incoming', time: this.time, phase: this.zone.currentPhase });
    }
    for (const s of this.loot) {
      if (!s.collected && this.zone.isOutsideZone(s.position)) {
        s.collected = true;
        this.zoneDespawned.add(s.id);
      }
    }
    const dmg = this.zone.damagePerSec * dt;
    if (dmg <= 0) return;
    for (const unit of this.units.values()) {
      if (!unit.alive) continue;
      if (this.zone.isOutsideZone(unit.player.position)) {
        this.applyDamage('zone', unit.id, dmg, 'zone');
      }
    }
  }

  private updateGrenadeSim(dt: number) {
    const explosions = updateGrenades(this.grenades, dt, GROUND_Y, this.time);
    for (const pos of this.grenades.bounced) {
      this.events.push({ type: 'bounce', time: this.time, position: pos });
    }
    for (const ex of explosions) {
      this.events.push({ type: 'explosion', time: this.time, position: ex.position });
      for (const unit of this.units.values()) {
        if (!unit.alive) continue;
        const d = unit.player.position.distanceTo(ex.position);
        const dmg = aoeDamageAt(ex, d);
        if (dmg > 0) {
          this.applyDamage(ex.ownerId, unit.id, dmg, 'grenade');
        }
        const falloff = 1 - Math.min(d / ex.radius, 1);
        if (falloff > 0) {
          const dir = unit.player.position.clone().sub(ex.position);
          dir.y = 0;
          if (dir.lengthSq() > 0.0001) {
            unit.player.position.addScaledVector(dir.normalize(), GRENADE_KNOCKBACK * falloff);
          }
        }
      }
    }
  }

  private updateVehicles(_dt: number) {
    // Vehicle motion and facing sync happen in updateUnit for occupants.
    for (const v of this.vehicles) {
      if (v.state.health > 0) continue;
      const occupant = Array.from(this.units.values()).find(
        (u) => u.alive && u.inVehicleId === v.id
      );
      if (occupant) this.eject(occupant);
    }
  }

  private updateAirdrops() {
    const spawned = updateAirdrops(
      this.airdrops,
      this.time,
      this.zone.center,
      this.zone.innerRadius
    );
    for (const a of spawned) {
      this.events.push({ type: 'airdrop', time: this.time, airdropId: a.id });
    }
    const removed = despawnAirdropsByZone(this.airdrops, this.zone.center, this.zone.innerRadius);
    if (removed > 0) {
      this.events.push({ type: 'airdropDespawned', time: this.time, count: removed });
    }
  }

  private updateLootRespawns() {
    for (let i = this.lootRespawns.length - 1; i >= 0; i--) {
      const r = this.lootRespawns[i];
      if (this.time >= r.until) {
        const s = this.loot.find((l) => l.id === r.id);
        if (s && !this.zoneDespawned.has(r.id)) s.collected = false;
        this.lootRespawns.splice(i, 1);
      }
    }
  }

  contextAction(unitId: string): boolean {
    return this.tryPickup(unitId) || this.enterVehicle(unitId);
  }

  tryPickup(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive) return false;

    const spawn = collectLootData(this.loot, unit.player.position, 2.5);
    if (spawn) {
      this.applyLoot(unit, spawn.loot);
      this.lootRespawns.push({ id: spawn.id, until: this.time + LOOT_RESPAWN_MS });
      this.events.push({ type: 'pickup', time: this.time, unitId, lootType: spawn.loot.type });
      return true;
    }

    const crate = this.airdrops.airdrops.find(
      (a) => !a.claimed && this.horizontalDist(a, unit.player.position) <= 4
    );
    if (crate) {
      const loot = claimAirdrop(this.airdrops, crate.id);
      if (loot) {
        for (const item of loot) this.applyLoot(unit, item);
        this.events.push({ type: 'pickup', time: this.time, unitId, lootType: 'crate' });
        return true;
      }
    }
    return false;
  }

  private horizontalDist(a: Airdrop, pos: THREE.Vector3): number {
    return Math.hypot(a.position.x - pos.x, a.position.z - pos.z);
  }

  private applyLoot(unit: SimUnit, loot: { type: string; subtype: string; amount: number }) {
    switch (loot.type) {
      case 'weapon': {
        if (loot.subtype === 'grenade') {
          unit.grenadeCount = Math.min(unit.grenadeCount + loot.amount, 5);
        } else {
          const type = loot.subtype as WeaponType;
          if (unit.weapons[0] && unit.weapons[1]) {
            const slot = Math.max(0, Math.min(unit.inventory.weaponIndex, 1));
            const dropped = unit.weapons[slot]!.def.type;
            unit.weapons[slot] = createWeapon(type);
            unit.inventory.weapons[slot] = type;
            this.dropLootPad(unit.player.position, dropped);
          } else {
            const slot = unit.weapons[0] ? 1 : 0;
            unit.weapons[slot] = createWeapon(type);
            unit.inventory.weapons[slot] = type;
            unit.inventory.weaponIndex = slot;
            unit.meleeMode = false;
          }
        }
        break;
      }
      case 'ammo':
        pickupAmmo(unit.inventory, loot.subtype, loot.amount);
        break;
      case 'armor': {
        const capped = Math.min(unit.armor + loot.amount, 100);
        unit.armor = capped;
        unit.inventory.armor = capped;
        break;
      }
      case 'heal':
        if (loot.subtype === 'medkit')
          unit.heals.medkit = Math.min(unit.heals.medkit + 1, MAX_MEDKITS);
        else unit.heals.bandage = Math.min(unit.heals.bandage + 1, 5);
        break;
    }
  }

  private dropLootPad(pos: THREE.Vector3, subtype: string) {
    const id = this.loot.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    this.loot.push({
      id,
      position: pos.clone(),
      loot: { type: 'weapon', subtype, amount: 1 },
      collected: false,
    });
  }

  enterVehicle(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive || unit.inVehicleId !== null) return false;
    const v = this.vehicles.find(
      (vv) => !vv.state.occupied && vv.state.position.distanceTo(unit.player.position) <= 4
    );
    if (!v) return false;
    v.state.occupied = true;
    unit.inVehicleId = v.id;
    return true;
  }

  exitVehicle(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || unit.inVehicleId === null) return false;
    const v = this.vehicles.find((vv) => vv.id === unit.inVehicleId);
    if (v) v.state.occupied = false;
    unit.inVehicleId = null;
    if (v) {
      unit.player.position.set(v.state.position.x + 2, 0.9, v.state.position.z + 2);
    }
    return true;
  }

  useVehicleType(unitId: string, type: Extract<VehicleType, 'sedan' | 'motorbike'>): VehicleActionResult {
    const unit = this.units.get(unitId);
    if (!unit || !unit.alive) return { ok: false, reason: 'not-alive' };

    const MAX_USE_DISTANCE = 18;
    if (unit.inVehicleId !== null) {
      const current = this.vehicles.find((v) => v.id === unit.inVehicleId);
      if (current?.type === type) {
        this.exitVehicle(unitId);
        return { ok: true, reason: 'exited', vehicleId: current.id };
      }
      this.exitVehicle(unitId);
    }

    let nearest: SimVehicle | null = null;
    let nearestDist = Infinity;
    for (const v of this.vehicles) {
      if (v.type !== type || v.state.occupied || v.state.health <= 0) continue;
      const dist = v.state.position.distanceTo(unit.player.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = v;
      }
    }
    if (!nearest) return { ok: false, reason: 'none-available' };
    if (nearestDist > MAX_USE_DISTANCE) {
      return { ok: false, reason: 'too-far', distance: nearestDist, vehicleId: nearest.id };
    }
    nearest.state.occupied = true;
    unit.inVehicleId = nearest.id;
    return { ok: true, reason: 'entered', distance: nearestDist, vehicleId: nearest.id };
  }

  /** Local sandbox respawn — revive a dead unit at their spawn point. */
  respawnUnit(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit || unit.alive || this.match.phase !== 'playing') return false;

    unit.alive = true;
    unit.health = 100;
    unit.armor = 0;
    unit.healing = null;
    unit.inVehicleId = null;
    unit.meleeMode = false;
    unit.player.health = 100;
    unit.player.velocity.set(0, 0, 0);
    unit.player.position.copy(unit.spawnPos);
    unit.player.setFacing(0, 0);

    const mp = this.match.players[unitId];
    if (mp && !mp.alive) {
      mp.alive = true;
      mp.placement = 0;
      this.match.aliveCount++;
    }
    return true;
  }

  private eject(unit: SimUnit) {
    const v = this.vehicles.find((vv) => vv.id === unit.inVehicleId);
    if (v) v.state.occupied = false;
    unit.inVehicleId = null;
    if (v) unit.player.position.set(v.state.position.x + 2, 0.9, v.state.position.z + 2);
    this.applyDamage('zone', unit.id, 20, 'vehicle');
  }
}
