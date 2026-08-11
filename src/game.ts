import * as THREE from 'three';
import { mapPreset } from './mapPresets';
import { createScene, disposeScene, type QualityPreset } from './scene';
import { createMatchRenderer, type MatchRenderHandle } from './matchRender';
import { POI_RADIUS, MAP_SIZE } from './constants';
import { MatchSim, type SimEvent, type SimUnit } from './gameplay';
import { ZoneSystem } from './zone';
import { createInputManager, type InputManager } from './input';
import { updateCamera } from './camera';
import { createRobotModel, transitionAnim, updateRobotAnim, type RobotAnimState } from './robot';
import {
  createHUD,
  applyHudChrome,
  createMinimap,
  addKillFeedEntry,
  addCompassPing,
  addDamageNumber,
  type HUDData,
} from './hud';
import { createVehicle, riderWorldPose, shouldShowUnitRig } from './vehicle';
import { SKILL_DEFS, type ChassisId } from './cosmetics';
import type { AudioManager } from './audio';
import { saveSettings, type Settings } from './settings';
import { formatPlacement, formatTimer, formatCompassBearing } from './feedback';
import { safeRequestPointerLock, isMobileDevice, isTouchDevice } from './platform';
import { calculateXP } from './match';
import { recordMatchResult } from './net/leaderboard';
import {
  attachHeldWeaponKit,
  createHeldWeaponKit,
  resolveHeldKind,
  syncHeldWeaponKit,
  type HeldWeaponKit,
} from './heldWeapons';
import type { TargetMeshParts } from './targetVisuals';

export interface MatchSummary {
  won: boolean;
  kills: number;
  damage: number;
  placement: number;
  xpGained: number;
}

export interface MatchGameCallbacks {
  onFinished: (summary: MatchSummary) => void;
  onLobby: () => void;
  onPlayAgain: () => void;
}

export interface MatchCosmetics {
  chassisColor: number;
  chassisId?: ChassisId;
  rifleColor: number;
  pistolColor: number;
  sedanColor?: number;
  buggyColor?: number;
  displayName?: string;
}

export interface MatchGameOptions {
  canvas: HTMLCanvasElement;
  settings: Settings;
  audio: AudioManager;
  botCount?: number;
  seed?: number;
  cosmetics?: MatchCosmetics;
  callbacks: MatchGameCallbacks;
}

interface UnitRig {
  group: THREE.Group;
  anim: RobotAnimState;
  dead: boolean;
  held?: HeldWeaponKit;
}

const HUD_INTERVAL_MS = isMobileDevice() ? 110 : 50;
export const LOCAL_MATCH_BOTS = 9;
const SHOT_TRACER_AXIS = new THREE.Vector3(0, 0, 1);
const SHOT_TRACER_LEN = 18;

const ROBOT_GROUP_Y_OFFSET = -0.9;
const INTERACT_RANGE_LOOT = 2.5;
const INTERACT_RANGE_VEHICLE = 4;
const INTERACT_RANGE_AIRDROP = 4;

export function summarizeMatch(sim: MatchSim): MatchSummary {
  const humanId = sim.humanId;
  const p = sim.match.players[humanId];
  return {
    won: sim.match.winnerId === humanId,
    kills: p.kills,
    damage: p.damage,
    placement: p.placement || Math.max(1, sim.match.aliveCount),
    xpGained: calculateXP(sim.match, humanId),
  };
}

/** Advance spectate target; when current is dead/missing, picks first alive id. */
export function resolveSpectateTarget(currentId: string | null, aliveIds: string[]): string | null {
  if (aliveIds.length === 0) return null;
  const idx = aliveIds.findIndex((id) => id === currentId);
  return aliveIds[(idx + 1) % aliveIds.length];
}

export function computeInteractionPrompt(sim: MatchSim, unitId: string): string {
  const unit = sim.units.get(unitId);
  if (!unit || !unit.alive) return '';
  const pos = unit.player.position;

  for (const s of sim.loot) {
    if (!s.collected && s.position.distanceTo(pos) <= INTERACT_RANGE_LOOT) {
      return 'Press E to pick up';
    }
  }
  for (const v of sim.vehicles) {
    if (!v.state.occupied && v.state.position.distanceTo(pos) <= INTERACT_RANGE_VEHICLE) {
      return 'Press E to enter vehicle';
    }
  }
  for (const a of sim.airdrops.airdrops) {
    if (
      !a.claimed &&
      !a.despawned &&
      Math.hypot(a.position.x - pos.x, a.position.z - pos.z) <= INTERACT_RANGE_AIRDROP
    ) {
      return 'Press E to open airdrop';
    }
  }
  if (unit.health < 100 && unit.heals.medkit > 0) return 'Press H to heal (medkit)';
  return '';
}

const CAUSE_LABEL: Record<string, string> = {
  shot: '🔫',
  melee: '🔪',
  grenade: '💣',
  zone: '☢️',
  vehicle: '🚗',
  fall: '💥',
};

export class MatchGame {
  private sim: MatchSim;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private matchRenderer: MatchRenderHandle;
  private sceneControls: import('three/addons/controls/OrbitControls.js').OrbitControls;
  private sceneDisposeEnvironment: () => void = () => {};
  private zoneSys: ZoneSystem;
  private input: InputManager;
  private hud: ReturnType<typeof createHUD>;
  private minimap: ReturnType<typeof createMinimap>;
  private audio: AudioManager;
  private settings: Settings;
  private callbacks: MatchGameCallbacks;

  private rigs = new Map<string, UnitRig>();
  private lootMeshes = new Map<number, THREE.Mesh>();
  private vehicleMeshes = new Map<number, THREE.Group>();
  private airdropMeshes = new Map<number, THREE.Group>();
  private targetMeshes = new Map<string, TargetMeshParts>();
  private targetVisuals: typeof import('./targetVisuals') | null = null;
  private beaconMesh: THREE.Group | null = null;
  private projMeshes = new Map<number, THREE.Mesh>();
  private explosionFx: { light: THREE.PointLight; mesh: THREE.Mesh; until: number }[] = [];
  private muzzleFlashPool: { light: THREE.PointLight; tracer: THREE.Mesh }[] = [];
  private tracerGeo = new THREE.BoxGeometry(0.08, 0.08, SHOT_TRACER_LEN);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
  private glooWallPaint: ((scene: THREE.Scene, walls: import('./glooWall').GlooWall[]) => void) | null =
    null;

  private bannerEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private hitmarkerEl: HTMLElement;

  private keys = new Set<string>();
  private usePressed = false;
  private healMedPressed = false;
  private wallPressed = false;
  private healBandPressed = false;
  private vehicleTypePressed: 'sedan' | 'motorbike' | null = null;
  private spectatePressed = false;
  private vehicleActionCooldownUntil = 0;

  private humanId: string;
  private dead = false;
  private finished = false;
  private spectateId: string | null = null;
  private minimapFullscreen = false;
  private raf = 0;
  private lastTime = 0;
  private hudNext = 0;
  private minimapNext = 0;
  private readonly minimapBuildings = [
    { x: POI_RADIUS, z: 0 },
    { x: 0, z: POI_RADIUS },
    { x: -POI_RADIUS, z: 0 },
    { x: 0, z: -POI_RADIUS },
  ];

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'KeyE') this.usePressed = true;
    if (e.code === 'KeyH') this.healMedPressed = true;
    if (e.code === 'KeyB') this.healBandPressed = true;
    if (e.code === 'KeyF') this.spectatePressed = true;
    if (e.code === 'KeyR' && this.dead) this.respawnHuman();
    if (e.code === 'KeyM') {
      this.audio.setMuted(!this.audio.isMuted());
      this.banner(this.audio.isMuted() ? '🔇 SOUND MUTED' : '🔊 SOUND ON', 1200);
    }
    if (e.code === 'KeyN') this.minimapFullscreen = !this.minimapFullscreen;
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onResize = () => {
    const c = this.opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.matchRenderer.setSize(window.innerWidth, window.innerHeight);
  };

  private opts: MatchGameOptions;
  private touchActionRoot: HTMLDivElement | null = null;
  private mBtn: HTMLButtonElement | null = null;
  private healBtn: HTMLButtonElement | null = null;
  private carBtn: HTMLButtonElement | null = null;
  private bikeBtn: HTMLButtonElement | null = null;

  constructor(opts: MatchGameOptions) {
    this.opts = opts;
    this.settings = opts.settings;
    this.audio = opts.audio;
    this.callbacks = opts.callbacks;
    const c = opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;';

    const quality: QualityPreset =
      isMobileDevice() && this.settings.quality !== 'low' ? 'low' : this.settings.quality;
    const { scene, camera, renderer, controls, pois, disposeEnvironment } = createScene(
      c,
      quality,
      this.settings.mapId
    );
    controls.enabled = false;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sceneControls = controls;
    this.sceneDisposeEnvironment = disposeEnvironment;
    this.matchRenderer = createMatchRenderer(renderer, scene, camera, quality, this.settings.mapId);

    this.sim = new MatchSim({
      seed: opts.seed,
      botCount: opts.botCount ?? LOCAL_MATCH_BOTS,
      humanChassisId: opts.cosmetics?.chassisId,
      humanName: opts.cosmetics?.displayName,
      time: 0,
    });
    this.humanId = this.sim.humanId;

    this.zoneSys = new ZoneSystem(scene);
    this.input = createInputManager(c, {
      getTouchSettings: () => ({
        invertLookHorizontal: this.settings.invertLookHorizontal,
        invertLookVertical: this.settings.invertLookVertical,
        leftFireButton: this.settings.leftFireButton,
        touchSprintMode: this.settings.touchSprintMode,
        touchButtonPreset: this.settings.touchButtonPreset,
        touchLayoutPreset: this.settings.touchLayoutPreset,
        hudOpacity: this.settings.hudOpacity,
        hudScale: this.settings.hudScale,
      }),
      getSettings: () => this.settings,
      onSettingsChange: (changes) => {
        this.settings = { ...this.settings, ...changes };
        saveSettings(this.settings);
        if (changes.volume !== undefined) this.audio.setVolume(this.settings.volume);
        if (changes.hudOpacity !== undefined || changes.hudScale !== undefined) {
          applyHudChrome(this.settings);
        }
      },
      onTouchSettingsChange: (changes) => {
        this.settings = { ...this.settings, ...changes };
        saveSettings(this.settings);
        if (changes.hudOpacity !== undefined || changes.hudScale !== undefined) {
          applyHudChrome(this.settings);
        }
      },
      showRespawn: () => this.dead && this.sim.match.phase === 'playing',
      onRespawn: this.respawnHuman,
    });
    this.hud = createHUD();
    applyHudChrome(this.settings);
    this.hud.onRespawn?.(this.respawnHuman);
    this.hud.onHealAction?.(() => {
      this.healMedPressed = true;
    });
    this.hud.onWallAction?.(() => {
      this.wallPressed = true;
    });
    this.minimap = createMinimap(() => {
      this.minimapFullscreen = !this.minimapFullscreen;
    });

    this.buildRigs();
    this.buildLoot();
    this.buildVehicles();
    void this.loadTargets();

    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'phase-banner';
    this.bannerEl.style.cssText =
      'position:fixed;top:22%;left:50%;transform:translateX(-50%);color:#fff;font-family:sans-serif;font-size:34px;letter-spacing:4px;text-shadow:0 2px 10px rgba(0,0,0,0.8);z-index:9998;pointer-events:none;display:none;';
    document.body.appendChild(this.bannerEl);

    this.crosshairEl = document.createElement('div');
    this.crosshairEl.style.cssText =
      'position:fixed;top:50%;left:50%;width:8px;height:8px;transform:translate(-50%,-50%);border:1px solid #e8c878;border-radius:50%;background:rgba(232,200,120,.4);box-shadow:0 0 6px rgba(0,0,0,.5);z-index:9998;pointer-events:none;';
    document.body.appendChild(this.crosshairEl);

    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.id = 'hitmarker';
    this.hitmarkerEl.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;z-index:9998;pointer-events:none;display:none;';
    this.hitmarkerEl.innerHTML =
      '<svg viewBox="0 0 20 20"><g stroke="#fff" stroke-width="2"><line x1="10" y1="0" x2="10" y2="5"/><line x1="10" y1="15" x2="10" y2="20"/><line x1="0" y1="10" x2="5" y2="10"/><line x1="15" y1="10" x2="20" y2="10"/></g></svg>';
    document.body.appendChild(this.hitmarkerEl);

    if (isTouchDevice()) {
      this.mountTouchActionButtons();
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);

    void pois;
    void import('./glooWallVisual').then((m) => {
      this.glooWallPaint = m.paintGlooWalls;
    });
  }

  start() {
    this.sim.startMatch();
    this.banner('GET READY');
    safeRequestPointerLock(this.opts.canvas);
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.bannerEl.remove();
    this.crosshairEl.remove();
    this.hitmarkerEl.remove();
    this.mBtn?.remove();
    this.mBtn = null;
    this.healBtn = null;
    this.carBtn = null;
    this.bikeBtn = null;
    this.touchActionRoot?.remove();
    this.touchActionRoot = null;
    this.hud.remove();
    this.minimap.remove();
    for (const rig of this.rigs.values()) this.scene.remove(rig.group);
    for (const m of this.lootMeshes.values()) this.scene.remove(m);
    for (const m of this.vehicleMeshes.values()) this.scene.remove(m);
    for (const m of this.airdropMeshes.values()) this.scene.remove(m);
    for (const parts of this.targetMeshes.values()) this.scene.remove(parts.group);
    for (const m of this.projMeshes.values()) this.scene.remove(m);
    for (const m of this.pool) this.scene.remove(m);
    for (const fx of this.explosionFx) {
      this.scene.remove(fx.light);
      this.scene.remove(fx.mesh);
    }
    for (const fx of this.muzzleFlashPool) {
      this.scene.remove(fx.light);
      this.scene.remove(fx.tracer);
    }
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.matchRenderer.dispose();
    disposeScene({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      controls: this.sceneControls,
      pois: [],
      mapId: this.settings.mapId,
      disposeEnvironment: this.sceneDisposeEnvironment,
    });
    this.input.dispose();
  }

  private banner(text: string, ms = 1800) {
    this.bannerEl.textContent = text;
    this.bannerEl.style.display = 'block';
    clearTimeout((this.bannerEl as HTMLElement & { _t?: number })._t);
    (this.bannerEl as HTMLElement & { _t?: number })._t = window.setTimeout(
      () => (this.bannerEl.style.display = 'none'),
      ms
    );
  }

  private buildRigs() {
    const cos = this.opts.cosmetics;
    for (const unit of this.sim.units.values()) {
      const tint = !unit.isBot && cos ? cos.chassisColor : unit.color;
      const model = createRobotModel(tint);
      const color = tint;
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, 0.06),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.85 })
      );
      mark.position.set(0, 1.85, 0);
      mark.name = 'teamMark';
      model.group.add(mark);

      let held: HeldWeaponKit | undefined;
      if (!unit.isBot && unit.id === this.humanId) {
        held = createHeldWeaponKit({
          rifle: cos?.rifleColor ?? 0xffcc33,
          pistol: cos?.pistolColor ?? 0xff8844,
        });
        attachHeldWeaponKit(model.group, held);
        syncHeldWeaponKit(
          held,
          resolveHeldKind({
            alive: unit.alive,
            inVehicle: unit.inVehicleId !== null,
            meleeMode: unit.meleeMode,
            weaponType: unit.weapons[unit.inventory.weaponIndex]?.def.type ?? null,
          })
        );
      }

      model.group.position.copy(unit.player.position);
      model.group.position.y = unit.player.position.y + ROBOT_GROUP_Y_OFFSET;
      model.group.rotation.y = unit.player.yaw;
      model.group.scale.setScalar(1.12);
      this.scene.add(model.group);
      this.rigs.set(unit.id, { group: model.group, anim: model.anim, dead: false, held });
    }
  }

  private lootColor(type: string): number {
    return type === 'weapon'
      ? 0xff4444
      : type === 'ammo'
        ? 0xffaa00
        : type === 'armor'
          ? 0x4444ff
          : 0x44ff44;
  }

  private createLootMesh(spawn: { position: THREE.Vector3; loot: { type: string } }): THREE.Mesh {
    const color = this.lootColor(spawn.loot.type);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.45, 0.7),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
    );
    mesh.position.copy(spawn.position);
    this.scene.add(mesh);
    return mesh;
  }

  private buildLoot() {
    for (const spawn of this.sim.loot) {
      this.lootMeshes.set(spawn.id, this.createLootMesh(spawn));
    }
  }

  private buildVehicles() {
    const cos = this.opts.cosmetics;
    for (const v of this.sim.vehicles) {
      const bodyColor =
        v.type === 'sedan' ? cos?.sedanColor : v.type === 'buggy' ? cos?.buggyColor : undefined;
      const { mesh } = createVehicle(
        v.type,
        v.state.position,
        bodyColor !== undefined ? { bodyColor } : undefined
      );
      this.scene.add(mesh);
      this.vehicleMeshes.set(v.id, mesh);
    }
  }

  private async loadTargets() {
    this.targetVisuals = await import('./targetVisuals');
    this.targetVisuals
      .mountTargetMeshes(this.scene, this.sim.targets)
      .forEach((parts, id) => this.targetMeshes.set(id, parts));
  }

  private humanUnit(): SimUnit {
    return this.sim.units.get(this.humanId)!;
  }

  private frame(now: number) {
    try {
      this.frameInner(now);
    } catch (err) {
      console.error('Match frame error:', err);
    }
  }

  private frameInner(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.handleActions();

    const human = this.humanUnit();
    const inMatch =
      (this.sim.match.phase === 'playing' || this.sim.match.phase === 'dropping') && human.alive;
    let input = undefined;
    if (inMatch) {
      const raw = this.input.getInput();
      const mobileLook = isMobileDevice();
      const sensX = mobileLook ? this.settings.touchSensitivityX : this.settings.sensitivity;
      const sensY = mobileLook ? this.settings.touchSensitivityY : this.settings.sensitivity;
      input = {
        ...raw,
        mouseX: raw.mouseX * sensX,
        mouseY: raw.mouseY * sensY,
        aim: raw.aim || this.settings.cameraMode === 'fps',
        glooWall: raw.glooWall || this.wallPressed,
      };
      this.wallPressed = false;
    } else {
      this.input.getInput();
    }

    this.sim.update(dt, input);
    this.zoneSys.updateFromZone(this.sim.zone.innerRadius);
    this.processEvents(this.sim.events.splice(0, this.sim.events.length), dt);
    this.syncVisuals(dt);
    this.updateCamera(dt);
    if (now >= this.hudNext) {
      this.hudNext = now + HUD_INTERVAL_MS;
      this.updateHUD();
    }
    if (now >= this.minimapNext) {
      this.minimapNext = now + HUD_INTERVAL_MS;
      this.updateMinimap();
    }
    this.matchRenderer.render();
  }

  private handleActions() {
    const human = this.humanUnit();
    if (this.sim.match.phase !== 'playing') {
      this.usePressed = false;
      this.healMedPressed = false;
      this.healBandPressed = false;
      return;
    }
    if (this.usePressed) {
      this.usePressed = false;
      if (human.inVehicleId !== null) this.sim.exitVehicle(this.humanId);
      else this.sim.contextAction(this.humanId);
    }
    if (this.healMedPressed) {
      this.healMedPressed = false;
      this.sim.useHealing(this.humanId, 'medkit');
    }
    if (this.healBandPressed) {
      this.healBandPressed = false;
      this.sim.useHealing(this.humanId, 'bandage');
    }
    if (this.vehicleTypePressed) {
      const type = this.vehicleTypePressed;
      this.vehicleTypePressed = null;
      this.handleVehicleTypeAction(type);
    }
    if (this.spectatePressed) {
      this.spectatePressed = false;
      if (this.dead) this.pickSpectateTarget();
      else if (human.inVehicleId !== null) this.sim.exitVehicle(this.humanId);
    }
  }

  private mountTouchActionButtons() {
    const root = document.createElement('div');
    root.id = 't';
    root.style.cssText =
      'display:none;position:fixed;left:12px;bottom:210px;z-index:10003;pointer-events:auto;flex-direction:column;gap:6px;';

    const makeBtn = (label: string, bg: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText =
        `min-width:76px;padding:7px 8px;border-radius:7px;border:1px solid #fff7;` +
        `background:${bg};color:#fff;font:bold 11px sans-serif;`;
      return btn;
    };

    this.mBtn = makeBtn('E', '#0369a1');
    this.healBtn = makeBtn('HEAL', '#047857');
    this.carBtn = makeBtn('CAR', '#a16207');
    this.bikeBtn = makeBtn('BIKE', '#6b21a8');

    const bindTouch = (btn: HTMLButtonElement, fn: () => void) => {
      const run = (e: Event) => {
        e.preventDefault();
        if (btn.disabled) return;
        fn();
      };
      btn.addEventListener('touchstart', run, { passive: false });
    };
    bindTouch(this.mBtn, () => {
      this.usePressed = true;
    });
    bindTouch(this.healBtn, () => {
      this.healMedPressed = true;
    });
    bindTouch(this.carBtn, () => {
      this.vehicleTypePressed = 'sedan';
    });
    bindTouch(this.bikeBtn, () => {
      this.vehicleTypePressed = 'motorbike';
    });

    root.append(this.mBtn, this.healBtn, this.carBtn, this.bikeBtn);
    document.body.appendChild(root);
    this.touchActionRoot = root;
  }

  private handleVehicleTypeAction(type: 'sedan' | 'motorbike') {
    if (this.sim.match.phase !== 'playing') return;
    const now = this.sim.time;
    if (now < this.vehicleActionCooldownUntil) {
      this.banner('V CD', 800);
      return;
    }
    this.vehicleActionCooldownUntil = now + 1200;
    const result = this.sim.useVehicleType(this.humanId, type);
    if (result.reason === 'entered')
      return this.banner(type === 'sedan' ? 'CAR OK' : 'BIKE OK', 900);
    if (result.reason === 'exited') return this.banner('EXIT', 900);
    if (result.reason === 'too-far') return this.banner('FAR', 900);
    if (result.reason === 'none-available') return this.banner('NONE', 900);
    if (result.reason === 'not-alive') this.banner('RESP', 900);
  }

  private processEvents(events: SimEvent[], dt: number) {
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          if (e.melee) this.audio.play('melee');
          else if (e.grenade) this.audio.play('shot');
          else this.audio.play(e.weapon === 'pistol' ? 'pistol' : 'shot');
          this.muzzleFlash(String(e.unitId));
          if (String(e.unitId) !== this.humanId && !e.melee && !e.grenade) {
            const firing = this.sim.units.get(String(e.unitId));
            if (firing) {
              const fireYaw = typeof e.yaw === 'number' ? e.yaw : firing.player.yaw;
              addCompassPing(formatCompassBearing(fireYaw));
            }
          }
          break;
        }
        case 'explosion':
          this.audio.play('explosion');
          this.spawnExplosion(e.position as THREE.Vector3);
          break;
        case 'bounce':
          this.audio.play('bounce');
          break;
        case 'hit': {
          const attacker = String(e.attackerId);
          const victim = String(e.victimId);
          if (attacker === this.humanId) {
            this.showHitmarker(Boolean(e.kill));
            this.audio.play(e.kill ? 'clink' : 'hit');
            this.spawnDamageNumber(victim, Number(e.damage), Boolean(e.kill));
          } else if (victim === this.humanId) {
            this.audio.play('hit');
          }
          break;
        }
        case 'target-hit': {
          if (String(e.attackerId) === this.humanId) {
            this.showHitmarker(Boolean(e.destroyed));
            this.audio.play(e.destroyed ? 'clink' : 'hit');
            this.spawnTargetHitFeedback(String(e.targetId), Number(e.damage), Boolean(e.destroyed));
          }
          break;
        }
        case 'kill':
          this.pushKillFeed(String(e.killerId), String(e.victimId), String(e.cause));
          break;
        case 'pickup':
          if (e.unitId === this.humanId) this.audio.play('pickup');
          break;
        case 'heal':
          if (e.unitId === this.humanId) this.audio.play('heal');
          break;
        case 'step':
          if (e.unitId === this.humanId) this.audio.play('step');
          break;
        case 'zone-incoming':
          this.audio.play('ui');
          this.banner('⚠️ ZONE INCOMING', 2500);
          break;
        default:
          break;
      }
    }
    this.updatePhaseFlow(dt);
  }

  private updatePhaseFlow(_dt: number) {
    const phase = this.sim.match.phase;
    const human = this.humanUnit();
    if (phase === 'countdown') {
      const remain = this.sim.match.countdownDuration - (this.sim.time - this.sim.match.phaseStart);
      this.banner(`MATCH STARTS IN ${Math.max(1, Math.ceil(remain / 1000))}`, 1200);
    } else if (phase === 'dropping') {
      this.banner('JUMP!', 2000);
    } else if (phase === 'playing' && !human.alive && !this.dead) {
      this.dead = true;
      document.exitPointerLock();
      this.showSpectateOverlay();
      this.pickSpectateTarget();
    } else if ((phase === 'ended' || phase === 'results') && !this.finished) {
      this.finished = true;
      this.finishMatch();
    }
  }

  private aliveSpectateIds(): string[] {
    return this.sim.aliveUnits.filter((u) => u.id !== this.humanId).map((u) => u.id);
  }

  private pickSpectateTarget() {
    const aliveIds = this.aliveSpectateIds();
    if (aliveIds.length === 0) {
      this.spectateId = null;
      this.updateSpectateOverlay();
      return;
    }
    this.spectateId = resolveSpectateTarget(this.spectateId, aliveIds);
    this.updateSpectateOverlay();
  }

  private ensureSpectateTarget() {
    if (!this.dead) return;
    const target = this.spectateId ? this.sim.units.get(this.spectateId) : null;
    if (target?.alive) return;
    this.pickSpectateTarget();
  }

  private showSpectateOverlay() {
    const existing = document.getElementById('spectate-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'spectate-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.78);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;z-index:9999;font-family:sans-serif;color:#fff;pointer-events:none;padding-top:48px;';
    overlay.innerHTML = `
      <div id="spectate-info" style="background:rgba(0,0,0,0.75);padding:12px 24px;border-radius:8px;font-size:16px;text-align:center;border:1px solid rgba(255,255,255,0.12);">
        <div style="color:#f66;font-size:22px;font-weight:bold;margin-bottom:8px;">ELIMINATED</div>
        <div id="spectate-placement" style="color:#fa0;font-size:18px;font-weight:bold;"></div>
        <div id="spectate-target" style="color:#8af;margin-top:8px;font-size:14px;"></div>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#aab;pointer-events:none;">Press <kbd style="padding:2px 6px;background:rgba(255,255,255,0.12);border-radius:4px;">R</kbd> or click <b>RESPAWN</b> below · <kbd style="padding:2px 6px;background:rgba(255,255,255,0.12);border-radius:4px;">F</kbd> spectate</p>
    `;
    document.body.appendChild(overlay);
  }

  private respawnHuman = () => {
    if (!this.dead) return;
    if (!this.sim.respawnUnit(this.humanId)) return;
    this.dead = false;
    this.spectateId = null;
    document.getElementById('spectate-overlay')?.remove();
    const rig = this.rigs.get(this.humanId);
    if (rig) rig.dead = false;
    safeRequestPointerLock(this.opts.canvas);
  };

  private updateSpectateOverlay() {
    const overlay = document.getElementById('spectate-overlay');
    if (!overlay) return;
    const target = this.spectateId ? this.sim.units.get(this.spectateId) : null;
    const placement =
      this.sim.match.players[this.humanId]?.placement || this.sim.match.aliveCount + 1;
    const placementEl = document.getElementById('spectate-placement');
    const targetEl = document.getElementById('spectate-target');
    if (placementEl) placementEl.textContent = `PLACED ${this.formatPlacement(placement)}`;
    if (targetEl && target) {
      targetEl.textContent = `SPECTATING ${target.name} (${target.id})`;
    } else if (targetEl) {
      targetEl.textContent = 'NO TARGETS ALIVE';
    }
  }

  private formatPlacement(n: number): string {
    if (n === 1) return '1ST';
    if (n === 2) return '2ND';
    if (n === 3) return '3RD';
    return `${n}TH`;
  }

  private finishMatch() {
    document.exitPointerLock();
    const spectateOverlay = document.getElementById('spectate-overlay');
    if (spectateOverlay) spectateOverlay.remove();
    const summary = summarizeMatch(this.sim);
    void recordMatchResult({
      matchId: `local-${this.sim.seed}`,
      placement: summary.placement,
      kills: summary.kills,
      damage: summary.damage,
      won: summary.won,
      mode: 'local',
    });
    this.callbacks.onFinished(summary);
    this.showResults(summary);
  }

  private showResults(summary: MatchSummary) {
    const el = document.createElement('div');
    el.id = 'results-overlay';
    el.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff;';
    el.innerHTML = `
      <h1 style="font-size:44px;margin-bottom:4px;color:${summary.won ? '#4f4' : '#f44'};">${summary.won ? 'VICTORY' : 'MATCH OVER'}</h1>
      <p style="color:#8af;font-size:18px;margin-bottom:24px;">${formatPlacement(summary.placement)} place</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 40px;font-size:14px;background:rgba(255,255,255,0.05);padding:16px 28px;border-radius:8px;margin-bottom:24px;">
        <span style="color:#889;">Kills</span><span>${summary.kills}</span>
        <span style="color:#889;">Damage</span><span>${summary.damage}</span>
        <span style="color:#889;">XP Gained</span><span style="color:#fa0;">+${summary.xpGained}</span>
      </div>
      <button id="btn-again" style="padding:12px 36px;font-size:16px;background:#4af;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;margin-bottom:8px;">Play Again</button>
      <button id="btn-lobby" style="padding:8px 24px;font-size:13px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Return to Lobby</button>
    `;
    document.body.appendChild(el);
    document.getElementById('btn-again')!.onclick = () => {
      el.remove();
      this.callbacks.onPlayAgain();
    };
    document.getElementById('btn-lobby')!.onclick = () => {
      el.remove();
      this.callbacks.onLobby();
    };
  }

  private pushKillFeed(killerId: string, victimId: string, cause: string) {
    const killer = killerId === 'zone' ? 'THE ZONE' : (this.sim.units.get(killerId)?.name ?? '?');
    const victim = this.sim.units.get(victimId)?.name ?? '?';
    const icon = CAUSE_LABEL[cause] ?? '💥';
    addKillFeedEntry(`${killer} ${icon} ${victim}`);
    if (victimId === this.humanId || killerId === this.humanId) this.audio.play('ui');
  }

  private muzzleFlash(unitId: string) {
    const unit = this.sim.units.get(unitId);
    if (!unit || !unit.alive) return;
    const origin = new THREE.Vector3(
      unit.player.position.x,
      unit.player.getEyeHeight(),
      unit.player.position.z
    );
    const dir = new THREE.Vector3(
      -Math.sin(unit.player.yaw) * Math.cos(unit.player.pitch),
      -Math.sin(unit.player.pitch),
      -Math.cos(unit.player.yaw) * Math.cos(unit.player.pitch)
    ).normalize();
    const muzzle = origin.addScaledVector(dir, 1.1);

    const fx = this.muzzleFlashPool.pop() ?? {
      light: new THREE.PointLight(0xffff44, 8, 24),
      tracer: new THREE.Mesh(this.tracerGeo, this.tracerMat),
    };
    fx.light.position.copy(muzzle);
    fx.tracer.position.copy(muzzle).addScaledVector(dir, SHOT_TRACER_LEN / 2);
    fx.tracer.quaternion.setFromUnitVectors(SHOT_TRACER_AXIS, dir);
    this.scene.add(fx.light);
    this.scene.add(fx.tracer);
    setTimeout(() => {
      this.scene.remove(fx.light);
      this.scene.remove(fx.tracer);
      this.muzzleFlashPool.push(fx);
    }, 110);
  }

  private spawnExplosion(position: THREE.Vector3) {
    const light = new THREE.PointLight(0xff8800, 30, 40);
    light.position.copy(position);
    this.scene.add(light);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.explosionFx.push({ light, mesh, until: performance.now() + 500 });
  }

  private updateExplosionFx(now: number) {
    for (let i = this.explosionFx.length - 1; i >= 0; i--) {
      const fx = this.explosionFx[i];
      const t = (fx.until - now) / 500;
      if (t <= 0) {
        this.scene.remove(fx.light);
        this.scene.remove(fx.mesh);
        this.explosionFx.splice(i, 1);
        continue;
      }
      const scale = 1 + (1 - t) * 6;
      fx.mesh.scale.setScalar(scale);
      const mat = fx.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.9 * t;
      fx.light.intensity = 30 * t;
    }
  }

  private syncVisuals(dt: number) {
    const now = performance.now();
    for (const unit of this.sim.units.values()) this.syncUnitRig(unit, dt);

    for (const spawn of this.sim.loot) {
      let mesh = this.lootMeshes.get(spawn.id);
      if (!mesh) {
        mesh = this.createLootMesh(spawn);
        this.lootMeshes.set(spawn.id, mesh);
      }
      mesh.visible = !spawn.collected;
      mesh.position.x = spawn.position.x;
      mesh.position.z = spawn.position.z;
      mesh.position.y = 0.5 + Math.sin(now * 0.002 + spawn.id) * 0.08;
    }

    for (const v of this.sim.vehicles) {
      const mesh = this.vehicleMeshes.get(v.id);
      if (!mesh) continue;
      mesh.position.copy(v.state.position);
      mesh.rotation.y = v.state.rotation;
      const damaged = v.state.health / 200 < 0.3;
      mesh.children.forEach((child) => {
        if (child instanceof THREE.Mesh) child.visible = !damaged;
      });
    }

    this.syncAirdrops();
    this.syncGrenades();
    if (this.glooWallPaint && this.sim.glooWalls.walls.length) {
      this.glooWallPaint(this.scene, this.sim.glooWalls.walls);
    }
    this.syncTargets(now);
    this.updateExplosionFx(now);

    const human = this.humanUnit();
    if (human.alive && human.inVehicleId === null) {
      this.crosshairEl.style.display = 'block';
    } else {
      this.crosshairEl.style.display = 'none';
    }
  }

  private syncUnitRig(unit: SimUnit, dt: number) {
    const rig = this.rigs.get(unit.id);
    if (!rig) return;
    if (unit.alive) {
      const isLocalFps =
        unit.id === this.humanId &&
        unit.inVehicleId === null &&
        (unit.player.cameraMode === 'fps' || this.settings.cameraMode === 'fps');
      rig.group.visible = shouldShowUnitRig(true) && !isLocalFps;
      if (unit.inVehicleId !== null) {
        const v = this.sim.vehicles.find((vv) => vv.id === unit.inVehicleId);
        if (v) {
          const pose = riderWorldPose(v.type, v.state.position, v.state.rotation);
          rig.group.position.copy(pose.position);
          rig.group.position.y += ROBOT_GROUP_Y_OFFSET;
          rig.group.rotation.y = pose.yaw;
          transitionAnim(rig.anim, 'crouch');
        }
      } else {
        rig.group.position.copy(unit.player.position);
        rig.group.position.y = unit.player.position.y + ROBOT_GROUP_Y_OFFSET;
        rig.group.rotation.y = unit.player.yaw;
        const state = unit.player.state;
        const moving = Math.hypot(unit.player.velocity.x, unit.player.velocity.z) > 0.4;
        const anim = unit.melee.swinging
          ? 'melee'
          : state === 'sprint'
            ? 'run'
            : state === 'crouch'
              ? 'crouch'
              : state === 'jump'
                ? 'jump'
                : moving
                  ? 'walk'
                  : 'idle';
        transitionAnim(rig.anim, anim);
      }
      if (rig.held) {
        syncHeldWeaponKit(
          rig.held,
          resolveHeldKind({
            alive: true,
            inVehicle: unit.inVehicleId !== null,
            meleeMode: unit.meleeMode,
            weaponType: unit.weapons[unit.inventory.weaponIndex]?.def.type ?? null,
          })
        );
      }
      updateRobotAnim(rig.anim, dt);
    } else if (!rig.dead) {
      rig.dead = true;
      rig.group.visible = shouldShowUnitRig(false);
      rig.group.rotation.x = -Math.PI / 2;
      if (rig.held) {
        syncHeldWeaponKit(rig.held, 'none');
      }
      const mark = rig.group.getObjectByName('teamMark') as THREE.Mesh | undefined;
      if (mark) {
        const mat = mark.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0;
      }
    }
  }

  private syncTargets(_now: number) {
    this.targetVisuals?.syncTargetMeshes(this.targetMeshes, this.sim.targets, this.sim.time);
  }

  private spawnTargetHitFeedback(targetId: string, amount: number, destroyed: boolean) {
    const target = this.sim.targets.find((t) => t.id === targetId);
    if (!target) return;
    const pos = target.position.clone();
    pos.y += 1.2;
    pos.project(this.camera);
    if (pos.z > 1) return;
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    addDamageNumber(amount, x, y, destroyed);
  }

  private syncAirdrops() {
    const falling = this.sim.airdrops.airdrops.find(
      (a) => !a.claimed && !a.despawned && this.sim.time < a.landingTime
    );
    if (falling) {
      if (!this.beaconMesh) {
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x8899aa })
        );
        const wing = new THREE.Mesh(
          new THREE.BoxGeometry(5, 0.1, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x556677 })
        );
        const beacon = new THREE.Group();
        beacon.add(body, wing);
        beacon.visible = true;
        this.scene.add(beacon);
        this.beaconMesh = beacon;
      }
      const landing = Math.max(this.sim.time / Math.max(falling.landingTime, 1), 0.02);
      const start = new THREE.Vector3(falling.position.x + 500, 120, falling.position.z + 500);
      const target = new THREE.Vector3(falling.position.x, 20, falling.position.z);
      this.beaconMesh.position.lerpVectors(start, target, landing);
      this.beaconMesh.lookAt(new THREE.Vector3(falling.position.x, 0, falling.position.z));
      this.beaconMesh.visible = true;
    } else if (this.beaconMesh) {
      this.beaconMesh.visible = false;
    }
    for (const a of this.sim.airdrops.airdrops) {
      let mesh = this.airdropMeshes.get(a.id);
      if (!mesh) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.7 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), mat);
        box.position.y = 0.8;
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(1.62, 0.2, 1.62),
          new THREE.MeshStandardMaterial({
            color: 0x44ff44,
            emissive: 0x44ff44,
            emissiveIntensity: 0.6,
          })
        );
        light.position.y = 1.65;
        const group = new THREE.Group();
        group.add(box, light);
        this.scene.add(group);
        mesh = group;
        this.airdropMeshes.set(a.id, group);
      }
      mesh.visible = !a.claimed && !a.despawned;
      mesh.position.set(a.position.x, 0, a.position.z);
      const t = this.sim.time >= a.landingTime ? 1 : this.sim.time / Math.max(a.landingTime, 1);
      mesh.position.y = 1.7 * (1 - t) + 0.1;
    }
  }

  private syncGrenades() {
    const active = new Set<number>();
    for (const p of this.sim.grenades.projectiles) {
      active.add(p.id);
      let mesh = this.projMeshes.get(p.id);
      if (!mesh) {
        mesh = this.retireProjMesh();
        this.projMeshes.set(p.id, mesh);
      }
      mesh.visible = true;
      mesh.position.copy(p.position);
    }
    for (const [id, mesh] of this.projMeshes) {
      if (!active.has(id)) {
        mesh.visible = false;
        this.pool.push(mesh);
        this.projMeshes.delete(id);
      }
    }
  }

  private pool: THREE.Mesh[] = [];

  private makeProjMesh(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x223322, metalness: 0.6, roughness: 0.4 })
    );
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  private retireProjMesh(): THREE.Mesh {
    return this.pool.pop() ?? this.makeProjMesh();
  }

  private updateCamera(dt: number) {
    const human = this.humanUnit();
    if (human.alive) {
      let yaw = human.player.yaw;
      if (human.inVehicleId !== null) {
        const v = this.sim.vehicles.find((vv) => vv.id === human.inVehicleId);
        if (v) yaw = v.state.rotation;
      }
      updateCamera(
        this.camera,
        yaw,
        human.player.pitch,
        human.player.getEyeHeight(),
        human.player.cameraMode === 'fps' || this.settings.cameraMode === 'fps' ? 'fps' : 'tps',
        human.player.position,
        dt
      );
      return;
    }
    this.ensureSpectateTarget();
    const target = this.spectateId ? this.sim.units.get(this.spectateId) : null;
    const t = target?.alive ? target.player.position : new THREE.Vector3(0, 10, 0);
    const angle = this.sim.time * 0.001;
    const camPos = t.clone().add(new THREE.Vector3(Math.sin(angle) * 7, 5, Math.cos(angle) * 7));
    const lerp = 1 - Math.pow(0.01, dt);
    this.camera.position.lerp(camPos, lerp);
    this.camera.lookAt(t.x, t.y + 1, t.z);
  }

  private updateHUD() {
    const human = this.humanUnit();
    const weapon = human.weapons[human.inventory.weaponIndex];
    const weaponName = weapon
      ? weapon.def.type.toUpperCase()
      : human.meleeMode
        ? human.melee.def.type.toUpperCase()
        : 'FISTS';
    const ammo = weapon ? weapon.ammo : 0;
    const reserve = weapon ? (human.inventory.ammo[weapon.def.type] ?? 0) : 0;
    const zoneTimeMs = this.sim.zone.phaseTotalDuration - this.sim.zone.phaseTime;

    let healProgress = 0;
    if (human.healing) {
      const dur = human.healing.kind === 'medkit' ? 4000 : 2000;
      const elapsed = dur - (human.healing.until - this.sim.time);
      healProgress = Math.max(0, Math.min(1, elapsed / dur));
    }

    const skillDef = SKILL_DEFS[human.skill];
    const skillCd = skillDef ? skillDef.cooldownMs : 10000;
    const skillElapsed = this.sim.time - human.lastSkillTime;
    const skillReady = skillElapsed >= skillCd;
    const skillCdSec = Math.ceil((skillCd - skillElapsed) / 1000);

    const data: HUDData = {
      kills: this.sim.match.players[this.humanId].kills,
      targetsHit: this.sim.getTargetHits(this.humanId),
      alive: this.sim.match.aliveCount,
      health: human.health,
      armor: human.armor,
      weapon: weaponName,
      ammo,
      reserve,
      reloading: weapon ? weapon.reloading : false,
      grenades: human.grenadeCount,
      heals: human.heals.medkit + human.heals.bandage,
      matchTimer: formatTimer(this.sim.time),
      phaseLabel: `${this.phaseLabel()} · ${mapPreset(this.settings.mapId).label.toUpperCase()}`,
      zoneTimer: formatTimer(zoneTimeMs * 1000),
      healProgress,
      inStorm: human.alive && this.sim.zone.isOutsideZone(human.player.position),
      justHit: human.lastDamageTime > 0 && this.sim.time - human.lastDamageTime < 150,
      prompt: human.alive ? computeInteractionPrompt(this.sim, this.humanId) : '',
      bearing: formatCompassBearing(human.player.yaw),
      skillName: skillDef ? skillDef.name : 'Skill [F]',
      skillCooldownText: skillReady ? 'READY' : `${skillCdSec}s`,
      skillReady,
      showRespawn: this.dead && this.sim.match.phase === 'playing',
      healActionLabel: this.healActionLabel(human),
      healActionEnabled: this.canUseHealAction(human),
      wallActionLabel: this.wallActionLabel(human),
      wallActionEnabled: this.canUseWallAction(human),
    };
    this.hud.update(data);
    if (this.touchActionRoot && this.mBtn && this.healBtn && this.carBtn && this.bikeBtn) {
      const show = human.alive && this.sim.match.phase === 'playing';
      this.touchActionRoot.style.display = show ? 'flex' : 'none';
      this.healBtn.disabled = !this.canUseHealAction(human);
      this.healBtn.textContent = this.healActionLabel(human);
      const now = this.sim.time;
      const inCooldown = now < this.vehicleActionCooldownUntil;
      this.carBtn.disabled = inCooldown;
      this.bikeBtn.disabled = inCooldown;
    }
  }

  private canUseHealAction(human: SimUnit): boolean {
    if (!human.alive || this.sim.match.phase !== 'playing') return false;
    if (human.healing) return false;
    if (human.health >= 100) return false;
    return human.heals.medkit > 0;
  }

  private canUseWallAction(human: SimUnit): boolean {
    if (!human.alive || this.sim.match.phase !== 'playing') return false;
    return human.glooWallCount > 0;
  }

  private wallActionLabel(human: SimUnit): string {
    if (!human.alive || this.sim.match.phase !== 'playing') return 'WALL';
    if (human.glooWallCount <= 0) return 'NO WALL';
    return `WALL x${human.glooWallCount}`;
  }

  private healActionLabel(human: SimUnit): string {
    if (!human.alive || this.sim.match.phase !== 'playing') return 'HEAL';
    if (human.healing) {
      const left = Math.max(0, Math.ceil((human.healing.until - this.sim.time) / 1000));
      return `HEAL ${left}s`;
    }
    if (human.health >= 100) return 'FULL';
    if (human.heals.medkit <= 0) return 'NO';
    return `HEAL x${human.heals.medkit}`;
  }

  private phaseLabel(): string {
    const labels: Record<string, string> = {
      lobby: 'LOBBY',
      countdown: 'STARTING',
      dropping: 'JUMP!',
      playing: 'IN MATCH',
      dead: 'ELIMINATED',
      spectate: 'SPECTATING',
      ended: 'FINISHED',
      results: 'RESULTS',
    };
    return labels[this.sim.match.phase] ?? this.sim.match.phase.toUpperCase();
  }

  private updateMinimap() {
    const human = this.humanUnit();
    const aimYaw = Math.atan2(
      -Math.sin(human.player.yaw) * Math.cos(human.player.pitch),
      -Math.cos(human.player.yaw) * Math.cos(human.player.pitch)
    );
    this.minimap.update({
      px: human.player.position.x,
      pz: human.player.position.z,
      pyaw: human.player.yaw,
      aimYaw,
      sx: this.sim.zone.center.x,
      sz: this.sim.zone.center.z,
      sr: this.sim.zone.innerRadius,
      buildings: this.minimapBuildings,
      loot: this.sim.loot.map((l) => ({
        x: l.position.x,
        z: l.position.z,
        collected: l.collected,
      })),
      enemies: Array.from(this.sim.units.values()).map((u) => ({
        x: u.player.position.x,
        z: u.player.position.z,
        alive: u.alive && u.id !== this.humanId,
      })),
      airdrops: this.sim.airdrops.airdrops.map((a) => ({
        x: a.position.x,
        z: a.position.z,
        claimed: a.claimed || a.despawned,
      })),
      size: this.settings.minimapSize === 'large' ? 240 : 160,
      mapExtent: MAP_SIZE,
      fullscreen: this.minimapFullscreen,
    });
  }

  private showHitmarker(kill: boolean) {
    this.hitmarkerEl.style.display = 'block';
    const svg = this.hitmarkerEl.querySelector('g');
    if (svg) {
      svg.setAttribute('stroke', kill ? '#f44' : '#fff');
    }
    clearTimeout((this.hitmarkerEl as HTMLElement & { _t?: number })._t);
    (this.hitmarkerEl as HTMLElement & { _t?: number })._t = window.setTimeout(
      () => (this.hitmarkerEl.style.display = 'none'),
      200
    );
  }

  /** Projects an enemy's world position to screen and floats a damage number there. */
  private spawnDamageNumber(victimId: string, amount: number, isKill: boolean) {
    const unit = this.sim.units.get(victimId);
    if (!unit || !unit.alive) return;
    const pos = new THREE.Vector3(
      unit.player.position.x,
      unit.player.position.y + 1.8,
      unit.player.position.z
    );
    pos.project(this.camera);
    const x = (pos.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
    const y = (-pos.y * 0.5 + 0.5) * this.renderer.domElement.clientHeight;
    if (pos.z > 1 || x < 0 || y < 0) return;
    addDamageNumber(amount, x, y, isKill);
  }
}
