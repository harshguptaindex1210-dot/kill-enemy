import * as THREE from 'three';
import { mapPreset } from '../mapPresets';
import { createScene, type QualityPreset } from '../scene';
import { createMatchRenderer, type MatchRenderHandle } from '../matchRender';
import { MAP_SIZE, POI_RADIUS, ZONE_PHASE_DURATIONS, START_MEDKITS } from '../constants';
import { createRobotModel, updateRobotAnim, type RobotAnimState } from '../robot';
import { ZoneSystem } from '../zone';
import {
  createHUD,
  applyHudChrome,
  createMinimap,
  addKillFeedEntry,
  addCompassPing,
  addDamageNumber,
  type HUDData,
  type MinimapData,
} from '../hud';
import { updateCamera, aimDirection } from '../camera';
import { createInputManager, type InputManager } from '../input';
import { MatchClient } from './client';
import type { AudioManager } from '../audio';
import { saveSettings, type Settings } from '../settings';
import { formatTimer, formatCompassBearing } from '../feedback';
import { safeRequestPointerLock, isMobileDevice } from '../platform';
import { REWIND_MS, type WireSnapshot } from './protocol';
import { shouldShowUnitRig } from '../vehicle';
import {
  attachHeldWeaponKit,
  createHeldWeaponKit,
  syncHeldWeaponKit,
  type HeldWeaponKit,
} from '../heldWeapons';
import type { SimEvent, SimUnit } from '../gameplay';

const SHOT_TRACER_AXIS = new THREE.Vector3(0, 0, 1);
const SHOT_TRACER_LEN = 18;
import { summarizeMatch } from '../game';
import { mountTargetMeshes, syncTargetMeshes, type TargetMeshParts } from '../targetVisuals';

const HUD_INTERVAL_MS = isMobileDevice() ? 110 : 50;
const MINIMAP_INTERVAL_MS = isMobileDevice() ? 150 : 50;

const ROBOT_GROUP_Y_OFFSET = -0.9;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.01;
const LATENCY_ID = 'net-latency';
const REMOTE_TINTS = [0xcc4444, 0x44cc66, 0xcc8844, 0xcc44aa, 0x44cccc, 0xaa66ff, 0xff6644];

function remoteTint(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return REMOTE_TINTS[h % REMOTE_TINTS.length]!;
}

export interface OnlineGameCallbacks {
  onFinished: (summary: { won: boolean; kills: number; damage: number; placement: number }) => void;
  onLobby: () => void;
}

export interface OnlineGameOptions {
  canvas: HTMLCanvasElement;
  settings: Settings;
  audio: AudioManager;
  client: MatchClient;
  callbacks: OnlineGameCallbacks;
}

interface OnlineRig {
  group: THREE.Group;
  anim: RobotAnimState;
}

export interface SelfPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
}

/** Local player pose from client prediction — never interpolate self from the network buffer. */
export function resolveLocalPlayerPose(client: MatchClient): SelfPose {
  if (client.mode === 'local') {
    const unit = client.localServer?.sim.units.get(client.selfId);
    if (unit) {
      const p = unit.player;
      return {
        x: p.position.x,
        y: p.position.y,
        z: p.position.z,
        yaw: p.yaw,
        alive: unit.alive,
      };
    }
  }
  const ent = client.interp.latest?.entities[client.selfId];
  const state = client.rollback.localState;
  return {
    x: state.pos.x,
    y: state.pos.y,
    z: state.pos.z,
    yaw: client.rollback.yaw,
    alive: ent ? ent.al !== 0 : true,
  };
}

/**
 * Snapshot-driven online match renderer (#39). Reads entity state from the
 * MatchClient (interpolation + rollback), not a local MatchSim, so the client
 * never decides game state (INV-4). Renders zone/loot from server snapshots.
 */
export class OnlineMatchGame {
  private opts: OnlineGameOptions;
  private client: MatchClient;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private matchRenderer: MatchRenderHandle;
  private zoneSys: ZoneSystem;
  private hud: ReturnType<typeof createHUD>;
  private minimap: ReturnType<typeof createMinimap>;
  private rigs = new Map<string, OnlineRig>();
  private lootMeshes = new Map<number, THREE.Mesh>();
  private targetMeshes = new Map<string, TargetMeshParts>();
  private raf = 0;
  private lastTime = 0;
  private lastSnapTick = -1;
  private renderTimeMs = 0;
  private latencyEl: HTMLElement;
  private sceneDisposeEnvironment: () => void = () => {};
  private input: InputManager;
  private finished = false;
  private cameraPos = new THREE.Vector3();
  private pitch = 0;
  private lastAim = false;
  private minimapFullscreen = false;
  private localHeld?: HeldWeaponKit;
  private zonePhaseIdx = 0;
  private zonePhaseStartMs = 0;
  private bannerEl: HTMLElement;
  private muzzleFlashPool: { tracer: THREE.Mesh }[] = [];
  private tracerGeo = new THREE.BoxGeometry(0.08, 0.08, SHOT_TRACER_LEN);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
  private glooWallPaint: ((scene: THREE.Scene, walls: import('../glooWall').GlooWall[]) => void) | null =
    null;
  private lastPhaseBanner = '';
  private hudNext = 0;
  private minimapNext = 0;
  private healPressed = false;
  private wallPressed = false;
  private dead = false;
  private hudIntervalMs = HUD_INTERVAL_MS;
  private minimapIntervalMs = MINIMAP_INTERVAL_MS;
  private fpsSamples: number[] = [];
  private fpsSampleAt = -Infinity;
  private qualityDowngraded = false;
  private rigAnimFrame = 0;
  private readonly minimapBuildings = [
    { x: POI_RADIUS, z: 0 },
    { x: 0, z: POI_RADIUS },
    { x: -POI_RADIUS, z: 0 },
    { x: 0, z: -POI_RADIUS },
  ];
  private minimapScratch: MinimapData | null = null;
  private minimapLootBuf: { x: number; z: number; collected: boolean }[] = [];
  private minimapEnemyBuf: { x: number; z: number; alive: boolean }[] = [];
  private onResize = () => {
    const c = this.opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.matchRenderer.setSize(window.innerWidth, window.innerHeight);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyN') this.minimapFullscreen = !this.minimapFullscreen;
    if (e.code === 'KeyR' && this.dead) this.respawnHuman();
  };

  constructor(opts: OnlineGameOptions) {
    this.opts = opts;
    this.client = opts.client;
    const c = opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;';

    const quality: QualityPreset =
      isMobileDevice() && opts.settings.quality !== 'low' ? 'low' : opts.settings.quality;
    const { scene, camera, renderer, disposeEnvironment } = createScene(c, quality, opts.settings.mapId);
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sceneDisposeEnvironment = disposeEnvironment;
    this.matchRenderer = createMatchRenderer(renderer, scene, camera, quality, opts.settings.mapId);

    this.zoneSys = new ZoneSystem(scene);
    this.input = createInputManager(c, {
      getTouchSettings: () => ({
        invertLookHorizontal: this.opts.settings.invertLookHorizontal,
        invertLookVertical: this.opts.settings.invertLookVertical,
        leftFireButton: this.opts.settings.leftFireButton,
        touchSprintMode: this.opts.settings.touchSprintMode,
        touchButtonPreset: this.opts.settings.touchButtonPreset,
        touchLayoutPreset: this.opts.settings.touchLayoutPreset,
        hudOpacity: this.opts.settings.hudOpacity,
        hudScale: this.opts.settings.hudScale,
      }),
      getSettings: () => this.opts.settings,
      onSettingsChange: (changes) => {
        this.opts.settings = { ...this.opts.settings, ...changes };
        saveSettings(this.opts.settings);
        if (changes.volume !== undefined) this.opts.audio.setVolume(this.opts.settings.volume);
        if (changes.hudOpacity !== undefined || changes.hudScale !== undefined) {
          applyHudChrome(this.opts.settings);
        }
      },
      onTouchSettingsChange: (changes) => {
        this.opts.settings = { ...this.opts.settings, ...changes };
        saveSettings(this.opts.settings);
        if (changes.hudOpacity !== undefined || changes.hudScale !== undefined) {
          applyHudChrome(this.opts.settings);
        }
      },
      showRespawn: () => this.dead && this.client.interp.latest?.phase === 'playing',
      onRespawn: () => this.respawnHuman(),
    });
    this.hud = createHUD();
    applyHudChrome(this.opts.settings);
    this.hud.onRespawn?.(() => this.respawnHuman());
    this.hud.onHealAction?.(() => {
      this.healPressed = true;
    });
    this.hud.onWallAction?.(() => {
      this.wallPressed = true;
    });
    this.minimap = createMinimap();
    this.buildTargetsFromSim();

    this.latencyEl = document.createElement('div');
    this.latencyEl.id = LATENCY_ID;
    this.latencyEl.style.cssText =
      'position:fixed;bottom:8px;left:12px;color:#2dd4bf;font-family:sans-serif;font-size:12px;z-index:9999;pointer-events:none;';
    document.body.appendChild(this.latencyEl);

    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'phase-banner';
    this.bannerEl.style.cssText =
      'position:fixed;top:18%;left:50%;transform:translateX(-50%);color:#2dd4bf;font-family:sans-serif;font-size:28px;font-weight:bold;z-index:9998;pointer-events:none;display:none;text-shadow:0 2px 8px rgba(0,0,0,0.8);';
    document.body.appendChild(this.bannerEl);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    void import('../glooWallVisual').then((m) => {
      this.glooWallPaint = m.paintGlooWalls;
    });
  }

  start() {
    this.lastTime = performance.now();
    safeRequestPointerLock(this.opts.canvas);
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.latencyEl.remove();
    this.bannerEl.remove();
    this.input.dispose();
    this.hud.remove();
    this.minimap.remove();
    for (const rig of this.rigs.values()) this.scene.remove(rig.group);
    for (const m of this.lootMeshes.values()) this.scene.remove(m);
    for (const parts of this.targetMeshes.values()) this.scene.remove(parts.group);
    for (const fx of this.muzzleFlashPool) {
      this.scene.remove(fx.tracer);
    }
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m?.dispose();
      }
    });
    this.matchRenderer.dispose();
    this.sceneDisposeEnvironment();
    this.renderer.dispose();
  }

  /** Sim events from LocalServer / Nakama — audio and combat feedback. */
  handleEvents(events: SimEvent[]) {
    for (const e of events) this.processEvent(e);
  }

  private processEvent(e: SimEvent) {
    const selfId = this.client.selfId;
    switch (e.type) {
      case 'shot': {
        if (e.melee) this.opts.audio.play('melee');
        else if (e.grenade) this.opts.audio.play('shot');
        else this.opts.audio.play(e.weapon === 'pistol' ? 'pistol' : 'shot');
        this.muzzleFlash(String(e.unitId), typeof e.yaw === 'number' ? e.yaw : undefined);
        if (String(e.unitId) !== selfId && !e.melee && !e.grenade) {
          const yaw = typeof e.yaw === 'number' ? e.yaw : 0;
          addCompassPing(formatCompassBearing(yaw));
        }
        break;
      }
      case 'explosion':
        this.opts.audio.play('explosion');
        break;
      case 'bounce':
        this.opts.audio.play('bounce');
        break;
      case 'hit': {
        const attacker = String(e.attackerId);
        const victim = String(e.victimId);
        if (attacker === selfId) {
          this.flashHitmarker(Boolean(e.kill));
          this.opts.audio.play(e.kill ? 'clink' : 'hit');
          addDamageNumber(
            Number(e.damage),
            window.innerWidth * 0.52,
            window.innerHeight * 0.42,
            Boolean(e.kill)
          );
        } else if (victim === selfId) {
          this.opts.audio.play('hit');
        }
        break;
      }
      case 'target-hit': {
        if (String(e.attackerId) === selfId) {
          this.flashHitmarker(Boolean(e.destroyed));
          this.opts.audio.play(e.destroyed ? 'clink' : 'hit');
          addDamageNumber(
            Number(e.damage),
            window.innerWidth * 0.52,
            window.innerHeight * 0.38,
            Boolean(e.destroyed)
          );
        }
        break;
      }
      case 'kill': {
        const killer = String(e.killerId ?? 'zone');
        const victim = String(e.victimId);
        const cause = String(e.cause ?? 'shot');
        const icon =
          cause === 'melee' ? '🔪' : cause === 'grenade' ? '💣' : cause === 'zone' ? '☢️' : '🔫';
        const killerLabel = killer === selfId ? 'YOU' : killer;
        const victimLabel = victim === selfId ? 'YOU' : victim;
        addKillFeedEntry(`${killerLabel} ${icon} ${victimLabel}`);
        break;
      }
      case 'pickup':
        if (e.unitId === selfId) this.opts.audio.play('pickup');
        break;
      case 'heal':
        if (e.unitId === selfId) this.opts.audio.play('heal');
        break;
      case 'step':
        if (e.unitId === selfId) this.opts.audio.play('step');
        break;
      case 'zone-incoming':
        this.opts.audio.play('ui');
        this.banner('⚠️ ZONE INCOMING', 2500);
        break;
      default:
        break;
    }
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

  private muzzleFlash(unitId: string, yaw?: number) {
    const rig = this.rigs.get(unitId);
    if (!rig) return;
    const shotYaw = yaw ?? rig.group.rotation.y;
    const shotPitch = unitId === this.client.selfId ? this.pitch : 0;
    const origin = rig.group.position.clone();
    origin.y += 1.2;
    const dir = aimDirection(shotYaw, shotPitch, new THREE.Vector3());
    const muzzle = origin.addScaledVector(dir, 0.6);

    const fx = this.muzzleFlashPool.pop() ?? {
      tracer: new THREE.Mesh(this.tracerGeo, this.tracerMat),
    };
    fx.tracer.position.copy(muzzle).addScaledVector(dir, SHOT_TRACER_LEN / 2);
    fx.tracer.quaternion.setFromUnitVectors(SHOT_TRACER_AXIS, dir);
    this.scene.add(fx.tracer);
    window.setTimeout(() => {
      this.scene.remove(fx.tracer);
      this.muzzleFlashPool.push(fx);
    }, 110);
  }

  private localHumanUnit(): SimUnit | null {
    const sim = this.client.mode === 'local' ? this.client.localServer?.sim : null;
    return sim?.units.get(this.client.selfId) ?? null;
  }

  private flashHitmarker(kill: boolean) {
    const dmg = document.getElementById('hud-damage');
    if (!dmg) return;
    dmg.style.color = kill ? '#f66' : '#fff';
    dmg.style.opacity = '1';
    window.setTimeout(() => (dmg.style.opacity = '0'), 150);
  }

  private frame(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    const frameMs = now - this.lastTime;
    this.lastTime = now;
    this.trackQuality(now, frameMs);
    const mobileLook = isMobileDevice();
    const sensX = mobileLook
      ? this.opts.settings.touchSensitivityX
      : this.opts.settings.sensitivity;
    const sensY = mobileLook
      ? this.opts.settings.touchSensitivityY
      : this.opts.settings.sensitivity;
    const snap = this.client.interp.latest;
    const phase = snap?.phase ?? 'lobby';
    const inMatch = phase === 'playing' || phase === 'dropping';
    const selfEnt = snap?.entities[this.client.selfId];
    const alive = selfEnt ? selfEnt.al !== 0 : true;
    const active = inMatch && alive;

    const playing = phase === 'playing';

    let rawInput = this.input.getInput();
    if (active) {
      this.pitch -= rawInput.mouseY * sensY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    } else {
      rawInput = {
        ...rawInput,
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        fire: false,
        reload: false,
        jump: false,
      };
    }

    this.lastAim = rawInput.aim || this.opts.settings.cameraMode === 'fps';

    const heal = Boolean(rawInput.heal || this.healPressed);
    this.healPressed = false;
    const glooWall = Boolean(rawInput.glooWall || this.wallPressed);
    this.wallPressed = false;

    if (playing && !alive && !this.dead) {
      this.dead = true;
      document.exitPointerLock();
    } else if (playing && alive && this.dead) {
      this.dead = false;
    }

    this.client.sendInput({
      seq: 0,
      forward: rawInput.forward,
      backward: rawInput.backward,
      left: rawInput.left,
      right: rawInput.right,
      sprint: rawInput.sprint,
      crouch: rawInput.crouch,
      jump: rawInput.jump,
      aim: this.lastAim,
      mouseX: rawInput.mouseX * sensX,
      mouseY: rawInput.mouseY * sensY,
      fire: rawInput.fire,
      reload: rawInput.reload,
      heal,
      glooWall: glooWall,
    });

    if (this.client.mode === 'local') {
      this.client.tickLocal(dt);
    }

    if (snap) {
      this.renderTimeMs = snap.time_ms - REWIND_MS;
      if (snap.tick > this.lastSnapTick) this.syncSnapshot(snap);
      this.updatePhaseFlow(snap);
    }

    this.syncPlayers(dt);
    this.syncTargets(dt);
    const sim = this.client.localServer?.sim;
    if (this.glooWallPaint && sim?.glooWalls.walls.length) {
      this.glooWallPaint(this.scene, sim.glooWalls.walls);
    }
    this.updateCamera(dt);
    if (now >= this.hudNext) {
      this.hudNext = now + this.hudIntervalMs;
      this.updateHUD(snap);
    }
    if (now >= this.minimapNext) {
      this.minimapNext = now + this.minimapIntervalMs;
      this.updateMinimap(snap);
    }
    this.matchRenderer.render();
  }

  private trackQuality(now: number, frameMs: number) {
    if (this.qualityDowngraded || this.opts.settings.quality === 'low') return;
    if (now - this.fpsSampleAt >= 250) {
      this.fpsSampleAt = now;
      this.fpsSamples.push(1000 / Math.max(frameMs, 0.001));
      if (this.fpsSamples.length > 8) this.fpsSamples.shift();
    }
    if (this.fpsSamples.length < 6) return;
    const sorted = [...this.fpsSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (median >= (isMobileDevice() ? 24 : 48)) return;
    this.qualityDowngraded = true;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    this.hudIntervalMs = 140;
    this.minimapIntervalMs = 220;
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  }

  private updatePhaseFlow(snap: WireSnapshot) {
    const phase = snap.phase;
    if (phase === 'countdown') {
      const sim = this.client.localServer?.sim;
      const remain = sim ? sim.match.countdownDuration - (sim.time - sim.match.phaseStart) : 5000;
      const label = `MATCH STARTS IN ${Math.max(1, Math.ceil(remain / 1000))}`;
      if (label !== this.lastPhaseBanner) {
        this.lastPhaseBanner = label;
        this.banner(label, 1200);
      }
    } else if (phase === 'dropping') {
      if (this.lastPhaseBanner !== 'JUMP!') {
        this.lastPhaseBanner = 'JUMP!';
        this.banner('JUMP!', 2000);
      }
    } else if ((phase === 'ended' || phase === 'results') && !this.finished) {
      this.finishFromSnapshot(snap);
    } else if (phase === 'playing') {
      this.lastPhaseBanner = '';
    }
  }

  private respawnHuman() {
    if (!this.dead) return;
    const sim = this.client.localServer?.sim;
    if (!sim?.respawnUnit(this.client.selfId)) return;
    this.dead = false;
    safeRequestPointerLock(this.opts.canvas);
  }

  private finishFromSnapshot(snap: WireSnapshot) {
    const sim = this.client.localServer?.sim;
    if (sim) {
      const summary = summarizeMatch(sim);
      this.finish({
        won: summary.won,
        kills: summary.kills,
        damage: summary.damage,
        placement: summary.placement,
      });
      return;
    }
    const mp = snap.entities[this.client.selfId];
    this.finish({
      won: snap.winner === this.client.selfId,
      kills: 0,
      damage: 0,
      placement: snap.alive + 1,
    });
    void mp;
  }

  /** Zone, loot, and latency — only when a new authoritative tick arrives. */
  private syncSnapshot(snap: WireSnapshot) {
    this.lastSnapTick = snap.tick;
    this.zoneSys.updateFromZone(snap.zone.r / 100);

    if (snap.zone.phase !== this.zonePhaseIdx) {
      this.zonePhaseIdx = snap.zone.phase;
      this.zonePhaseStartMs = snap.time_ms;
    }

    const active = new Set<number>();
    for (const l of snap.loot) {
      active.add(l.id);
      let mesh = this.lootMeshes.get(l.id);
      if (!mesh) {
        const color = l.t === 'weapon' ? 0xff4444 : l.t === 'ammo' ? 0xffaa00 : 0x44ff44;
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.2, 0.4),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
        );
        this.scene.add(mesh);
        this.lootMeshes.set(l.id, mesh);
      }
      mesh.visible = true;
      mesh.position.set(l.px / 100, 0.6, l.pz / 100);
    }
    for (const [id, mesh] of this.lootMeshes) {
      if (!active.has(id)) mesh.visible = false;
    }

    this.latencyEl.textContent = `LATENCY ${Math.round(this.client.latency)} ms`;
  }

  /** Interpolate remote rigs every frame; local rig uses client-predicted pose. */
  private syncPlayers(dt: number) {
    const remotes = this.client.sampleRemotes(this.renderTimeMs);
    if (remotes) {
      for (const e of remotes) {
        if (e.id === this.client.selfId) continue;
        this.syncRig(e.id, e.x, e.y, e.z, e.yaw, e.alive, false, dt);
      }
    }
    const self = this.getSelfPose();
    this.syncRig(this.client.selfId, self.x, self.y, self.z, self.yaw, self.alive, true, dt);
  }

  private getSelfPose(): SelfPose {
    return resolveLocalPlayerPose(this.client);
  }

  private localEyeHeight(): number {
    const human = this.localHumanUnit();
    if (human) return human.player.getEyeHeight();
    const self = this.getSelfPose();
    return self.y + 1.6;
  }

  private syncRig(
    id: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    alive: boolean,
    isLocal: boolean,
    dt: number
  ) {
    let rig = this.rigs.get(id);
    if (!rig) {
      const tint = isLocal ? 0x3366cc : remoteTint(id);
      const model = createRobotModel(tint);
      if (isLocal) {
        model.group.scale.setScalar(1.12);
        const held = createHeldWeaponKit({ rifle: 0xffcc33, pistol: 0xff8844 });
        attachHeldWeaponKit(model.group, held);
        syncHeldWeaponKit(held, 'rifle');
        this.localHeld = held;
      }
      model.group.position.set(x, y + ROBOT_GROUP_Y_OFFSET, z);
      this.scene.add(model.group);
      rig = { group: model.group, anim: model.anim };
      this.rigs.set(id, rig);
    }
    const fpsMode = isLocal && alive && this.opts.settings.cameraMode === 'fps';
    rig.group.visible = shouldShowUnitRig(alive) && !fpsMode;
    if (alive) {
      rig.group.position.set(x, y + ROBOT_GROUP_Y_OFFSET, z);
      rig.group.rotation.y = yaw;
    }
    if (isLocal && this.localHeld) {
      syncHeldWeaponKit(this.localHeld, alive ? 'rifle' : 'none');
    }
    const animEveryFrame = isLocal || !isMobileDevice() || this.rigAnimFrame++ % 2 === 0;
    if (animEveryFrame) {
      updateRobotAnim(rig.anim, dt);
    }
  }

  private buildTargetsFromSim() {
    const sim = this.client.localServer?.sim;
    if (!sim) return;
    mountTargetMeshes(this.scene, sim.targets).forEach((parts, id) =>
      this.targetMeshes.set(id, parts)
    );
  }

  private syncTargets(_dt: number) {
    const sim = this.client.localServer?.sim;
    if (!sim) return;
    syncTargetMeshes(this.targetMeshes, sim.targets, sim.time);
  }

  private updateCamera(dt: number) {
    const self = this.getSelfPose();
    this.cameraPos.set(self.x, self.y, self.z);

    const cameraMode = this.lastAim || this.opts.settings.cameraMode === 'fps' ? 'fps' : 'tps';

    updateCamera(this.camera, self.yaw, this.pitch, this.localEyeHeight(), cameraMode, this.cameraPos, dt, {
      snapPosition: true,
    });
  }

  private updateHUD(snap: WireSnapshot | null) {
    const selfEnt = snap?.entities[this.client.selfId];
    const self = this.getSelfPose();
    const human = this.localHumanUnit();
    const weapon = human ? human.weapons[human.inventory.weaponIndex] : null;
    const phaseDur = ZONE_PHASE_DURATIONS[snap?.zone.phase ?? 0] ?? 0;
    const elapsedSec = snap ? Math.max(0, (snap.time_ms - this.zonePhaseStartMs) / 1000) : 0;
    const zoneTimeMs = Math.max(0, (phaseDur - elapsedSec) * 1000);
    const sim = this.client.localServer?.sim;
    const mp = human ? this.client.localServer!.sim.match.players[this.client.selfId] : null;
    let healProgress = 0;
    if (human?.healing && sim) {
      const dur = human.healing.kind === 'medkit' ? 4000 : 2000;
      const left = human.healing.until - sim.time;
      healProgress = Math.max(0, Math.min(1, 1 - left / dur));
    }
    const canHeal =
      Boolean(human?.alive) &&
      (snap?.phase ?? '') === 'playing' &&
      !human?.healing &&
      (human?.health ?? 100) < 100 &&
      (human?.heals.medkit ?? 0) > 0;
    let healActionLabel = 'HEAL';
    if (human?.healing && sim) {
      healActionLabel = `HEAL ${Math.max(0, Math.ceil((human.healing.until - sim.time) / 1000))}s`;
    } else if ((human?.health ?? 100) >= 100) {
      healActionLabel = 'FULL';
    } else if ((human?.heals.medkit ?? 0) <= 0) {
      healActionLabel = 'NO';
    } else if (human) {
      healActionLabel = `HEAL x${human.heals.medkit}`;
    }
    const wallCount = human?.glooWallCount ?? 0;
    const canWall =
      Boolean(human?.alive) && (snap?.phase ?? '') === 'playing' && wallCount > 0;
    const wallActionLabel =
      wallCount > 0 ? `WALL x${wallCount}` : (snap?.phase === 'playing' ? 'NO WALL' : 'WALL');
    const data: HUDData = {
      kills: mp?.kills ?? 0,
      targetsHit: sim?.getTargetHits(this.client.selfId) ?? 0,
      alive: snap?.alive ?? 0,
      health: human?.health ?? this.client.rollback.localState.health,
      armor: human?.armor ?? selfEnt?.ar ?? 0,
      weapon: weapon?.def.type.toUpperCase() ?? 'RIFLE',
      ammo: weapon?.ammo ?? 30,
      reserve: human?.inventory.ammo[weapon?.def.type ?? 'rifle'] ?? 90,
      reloading: weapon?.reloading ?? false,
      grenades: human?.grenadeCount ?? 2,
      heals: human ? human.heals.medkit + human.heals.bandage : START_MEDKITS + 2,
      matchTimer: formatTimer(snap?.time_ms ?? 0),
      phaseLabel: `${(snap?.phase ?? 'lobby').toUpperCase()} · ${mapPreset(this.opts.settings.mapId).label.toUpperCase()}`,
      zoneTimer: formatTimer(zoneTimeMs),
      healProgress,
      inStorm: false,
      justHit: false,
      prompt: '',
      bearing: this.compassBearing(self.yaw),
      healActionLabel,
      healActionEnabled: canHeal,
      wallActionLabel,
      wallActionEnabled: canWall,
      showRespawn: this.dead && snap?.phase === 'playing',
    };
    this.hud.update(data);
  }

  private updateMinimap(snap: WireSnapshot | null) {
    if (!snap) return;
    const self = this.getSelfPose();

    const lootSrc = snap.loot;
    while (this.minimapLootBuf.length < lootSrc.length) {
      this.minimapLootBuf.push({ x: 0, z: 0, collected: false });
    }
    this.minimapLootBuf.length = lootSrc.length;
    for (let i = 0; i < lootSrc.length; i++) {
      const dst = this.minimapLootBuf[i]!;
      const src = lootSrc[i]!;
      dst.x = src.px / 100;
      dst.z = src.pz / 100;
      dst.collected = false;
    }

    const enemyEntries = Object.entries(snap.entities).filter(
      ([id, e]) => id !== this.client.selfId && e.al !== 0
    );
    while (this.minimapEnemyBuf.length < enemyEntries.length) {
      this.minimapEnemyBuf.push({ x: 0, z: 0, alive: false });
    }
    this.minimapEnemyBuf.length = enemyEntries.length;
    for (let i = 0; i < enemyEntries.length; i++) {
      const dst = this.minimapEnemyBuf[i]!;
      const e = enemyEntries[i]![1];
      dst.x = e.px / 100;
      dst.z = e.pz / 100;
      dst.alive = true;
    }

    const data = this.minimapScratch ?? (this.minimapScratch = {} as MinimapData);
    data.px = self.x;
    data.pz = self.z;
    data.pyaw = self.yaw;
    data.aimYaw = self.yaw;
    data.sx = snap.zone.cx / 100;
    data.sz = snap.zone.cz / 100;
    data.sr = snap.zone.r / 100;
    data.buildings = this.minimapBuildings;
    data.loot = this.minimapLootBuf;
    data.enemies = this.minimapEnemyBuf;
    data.size = this.opts.settings.minimapSize === 'large' ? 240 : 160;
    data.mapExtent = MAP_SIZE;
    data.fullscreen = this.minimapFullscreen;
    this.minimap.update(data);
  }

  private compassBearing(yaw: number): string {
    const idx = Math.round(((yaw % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
    return ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'][idx];
  }

  finish(summary: { won: boolean; kills: number; damage: number; placement: number }) {
    if (this.finished) return;
    this.finished = true;
    document.exitPointerLock();
    this.opts.callbacks.onFinished(summary);
  }
}
