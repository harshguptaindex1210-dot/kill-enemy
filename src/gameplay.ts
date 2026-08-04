import * as THREE from 'three';
import {
  createMatch,
  killPlayer,
  registerDamage,
  startCountdown,
  tickMatch,
  type MatchState,
} from './match';
import { ZoneLogic } from './zone';
import { createPlayer, type PlayerBundle, type PlayerInput } from './player';
import {
  createWeapon,
  fireWeapon,
  reloadWeapon,
  type WeaponState,
  type WeaponType,
} from './weapons';
import { createInventory, pickupAmmo, pickupArmor, type Inventory } from './inventory';
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
  claimAirdrop,
  type Airdrop,
  type AirdropSystem,
} from './airdrop';
import { createVehicle, updateVehicle, type VehicleState, type VehicleType } from './vehicle';

export type DamageCause = 'shot' | 'melee' | 'grenade' | 'zone' | 'vehicle';

export interface SimEvent {
  type: 'kill' | 'explosion' | 'shot' | 'hit' | 'pickup' | 'airdrop' | 'heal' | 'step';
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
}

export interface SimVehicle {
  id: number;
  type: VehicleType;
  state: VehicleState;
  spawnPos: THREE.Vector3;
}

export interface MatchSimConfig {
  seed?: number;
  humanId?: string;
  humanName?: string;
  botCount?: number;
  botDifficulty?: 'mix' | BotDifficulty;
  time?: number;
  obstacles?: { x: number; z: number; r: number }[];
  lootPois?: { name: string; position: THREE.Vector3 }[];
}

const MAP_BOUND = 480;
const UNIT_RADIUS = 0.6;
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;
const GROUND_Y = 0;
const LOOT_RESPAWN_MS = 30000;
const GRENADE_THROW_COOLDOWN_MS = 800;

const DEFAULT_OBSTACLES = [
  { x: 300, z: 0, r: 45 },
  { x: 0, z: 300, r: 45 },
  { x: -300, z: 0, r: 45 },
  { x: 0, z: -300, r: 45 },
];

const DEFAULT_POIS = [
  { name: 'Town', position: new THREE.Vector3(300, 0, 0) },
  { name: 'Factory', position: new THREE.Vector3(0, 0, 300) },
  { name: 'Docks', position: new THREE.Vector3(-300, 0, 0) },
  { name: 'Hilltop', position: new THREE.Vector3(0, 0, -300) },
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
  events: SimEvent[] = [];
  time: number;
  seed: number;
  order: string[];
  private obstacles: { x: number; z: number; r: number }[];
  private rng: () => number;
  private spawnPoints: THREE.Vector3[] = [];

  constructor(config: MatchSimConfig = {}) {
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

    this.loot = generateLootData(config.lootPois ?? DEFAULT_POIS, this.rng);
    this.spawnVehicles();
  }

  private buildSpawnPoints(count: number): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const spread = Math.min(count, 10);
    for (let i = 0; i < count; i++) {
      const a = (i / spread) * Math.PI * 2 + this.rng() * 0.2;
      const radius = 300 + (i % 3) * 50;
      const p = new THREE.Vector3(Math.cos(a) * radius, 0.9, Math.sin(a) * radius);
      if (this.obstacles.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 5)) {
        p.set(420, 0.9, 0);
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
      heals: { medkit: 1, bandage: 2 },
      healing: null,
      lastDamageTime: -100000,
      inVehicleId: null,
      spawnPos: spawn,
      color: isBot ? 0xcc4444 : 0x3366cc,
      lastStepTime: 0,
      lastThrowTime: -10000,
    };
  }

  private spawnVehicles() {
    const spots: [VehicleType, THREE.Vector3][] = [
      ['sedan', new THREE.Vector3(260, 0, 260)],
      ['buggy', new THREE.Vector3(-260, 0, 260)],
      ['sedan', new THREE.Vector3(260, 0, -260)],
      ['buggy', new THREE.Vector3(-260, 0, -260)],
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
    this.updateHealing();
    this.updateZone(dt);
    this.updateGrenadeSim(dt);
    this.updateVehicles(dt);
    this.updateAirdrops();
    this.updateLootRespawns();
  }

  private botInput(unit: SimUnit): PlayerInput {
    const enemy = this.nearestEnemy(unit);
    const loot = this.nearestLoot(unit);
    const weapon = this.currentWeapon(unit);
    const zone = this.zone;
    return decideBotInput({
      brain: unit.botBrain!,
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
    });
  }

  private nearestEnemy(unit: SimUnit): SimUnit | null {
    let best: SimUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units.values()) {
      if (other.id === unit.id || !other.alive) continue;
      const d = other.player.position.distanceTo(unit.player.position);
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
        const steer = input.left ? -1 : input.right ? 1 : 0;
        updateVehicle(v.state, throttle, steer, dt, GROUND_Y);
        bundle.position.copy(v.state.position);
        if (v.state.health <= 0) this.eject(unit);
      }
      return;
    }

    bundle.update(input, dt, GROUND_Y);
    clampPos(bundle.position);
    this.resolveObstacles(unit);
    bundle.health = unit.health;

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

  private tryFire(unit: SimUnit) {
    const weapon = this.currentWeapon(unit);
    if (!weapon) return;
    const now = this.time;
    if (weapon.reloading || weapon.ammo <= 0) return;

    const origin = new THREE.Vector3(0, unit.player.getEyeHeight(), 0);
    const dir = this.aimDirection(unit);
    const targets = this.aliveUnits
      .filter((t) => t.id !== unit.id)
      .map((t) => ({
        id: t.id,
        position: t.player.position,
        capsuleHeight: CAPSULE_HEIGHT,
        capsuleRadius: CAPSULE_RADIUS,
      }));
    const results = fireWeapon(weapon, origin, dir, targets, now);
    this.events.push({ type: 'shot', time: now, unitId: unit.id, weapon: weapon.def.type });
    for (const r of results) {
      if (r.hit && r.entityId) {
        this.applyDamage(unit.id, r.entityId, r.damage, 'shot');
      }
    }
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
    const origin = new THREE.Vector3(0, unit.player.getEyeHeight(), 0);
    throwGrenade(this.grenades, unit.id, origin, this.aimDirection(unit), 18, 2, GROUND_Y);
    this.events.push({ type: 'shot', time: this.time, unitId, grenade: true });
    return true;
  }

  private aimDirection(unit: SimUnit): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(unit.player.yaw),
      -Math.sin(unit.player.pitch),
      -Math.cos(unit.player.yaw)
    );
  }

  applyDamage(attackerId: string, victimId: string, raw: number, cause: DamageCause): boolean {
    const victim = this.units.get(victimId);
    if (!victim || !victim.alive) return false;

    const absorbed = Math.min(victim.armor, raw);
    victim.armor -= absorbed;
    victim.health = Math.max(0, victim.health - (raw - absorbed));
    victim.lastDamageTime = this.time;
    if (victim.healing) victim.healing = null;

    if (attackerId !== victimId) {
      registerDamage(this.match, attackerId, Math.round(raw));
    }

    const isKill = victim.health <= 0;
    this.events.push({
      type: 'hit',
      time: this.time,
      attackerId,
      victimId,
      damage: Math.round(raw),
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
        const targets = this.aliveUnits
          .filter((t) => t.id !== unit.id)
          .map((t) => ({
            id: t.id,
            position: t.player.position,
            capsuleRadius: CAPSULE_RADIUS,
            capsuleHeight: CAPSULE_HEIGHT,
          }));
        const hit = checkMeleeHit(unit.melee, unit.player.position, unit.player.yaw, targets);
        if (hit.hit && hit.targetId) {
          this.applyDamage(unit.id, hit.targetId, hit.damage, 'melee');
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
    for (const ex of explosions) {
      this.events.push({ type: 'explosion', time: this.time, position: ex.position });
      for (const unit of this.units.values()) {
        if (!unit.alive) continue;
        const d = unit.player.position.distanceTo(ex.position);
        const dmg = aoeDamageAt(ex, d);
        if (dmg > 0) {
          this.applyDamage(ex.ownerId, unit.id, dmg, 'grenade');
        }
      }
    }
  }

  private updateVehicles(dt: number) {
    for (const v of this.vehicles) {
      if (v.state.health <= 0) continue;
      const occupant = Array.from(this.units.values()).find(
        (u) => u.alive && u.inVehicleId === v.id
      );
      if (occupant) {
        const dmg = this.zone.damagePerSec * dt;
        if (dmg > 0 && this.zone.isOutsideZone(v.state.position)) {
          this.applyDamage('zone', occupant.id, dmg, 'zone');
        }
      }
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
  }

  private updateLootRespawns() {
    for (let i = this.lootRespawns.length - 1; i >= 0; i--) {
      const r = this.lootRespawns[i];
      if (this.time >= r.until) {
        const s = this.loot.find((l) => l.id === r.id);
        if (s) s.collected = false;
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
          const slot = unit.weapons[0] ? (unit.weapons[1] ? -1 : 1) : 0;
          if (slot >= 0) {
            unit.weapons[slot] = createWeapon(type);
            unit.inventory.weapons[slot] = type;
            unit.inventory.weaponIndex = slot;
            unit.meleeMode = false;
          } else {
            pickupAmmo(unit.inventory, type, loot.amount);
          }
        }
        break;
      }
      case 'ammo':
        pickupAmmo(unit.inventory, loot.subtype, loot.amount);
        break;
      case 'armor':
        pickupArmor(unit.inventory, loot.amount);
        unit.armor = unit.inventory.armor;
        break;
      case 'heal':
        if (loot.subtype === 'medkit') unit.heals.medkit = Math.min(unit.heals.medkit + 1, 3);
        else unit.heals.bandage = Math.min(unit.heals.bandage + 1, 5);
        break;
    }
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

  private eject(unit: SimUnit) {
    const v = this.vehicles.find((vv) => vv.id === unit.inVehicleId);
    if (v) v.state.occupied = false;
    unit.inVehicleId = null;
    if (v) unit.player.position.set(v.state.position.x + 2, 0.9, v.state.position.z + 2);
    this.applyDamage('zone', unit.id, 20, 'vehicle');
  }
}
