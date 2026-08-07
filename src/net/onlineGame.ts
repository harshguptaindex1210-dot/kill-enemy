import * as THREE from 'three';
import { createScene, type QualityPreset } from '../scene';
import { MAP_SIZE, POI_RADIUS, ZONE_PHASE_DURATIONS } from '../constants';
import { createRobotModel, updateRobotAnim, type RobotAnimState } from '../robot';
import { ZoneSystem } from '../zone';
import { createHUD, createMinimap, type HUDData, type MinimapData } from '../hud';
import { updateCamera } from '../camera';
import { createInputManager, type InputManager } from '../input';
import { MatchClient } from './client';
import type { AudioManager } from '../audio';
import type { Settings } from '../settings';
import { formatTimer } from '../feedback';
import { REWIND_MS, type WireSnapshot } from './protocol';
import { shouldShowUnitRig } from '../vehicle';
import {
  attachHeldWeaponKit,
  createHeldWeaponKit,
  syncHeldWeaponKit,
  type HeldWeaponKit,
} from '../heldWeapons';

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
  private zoneSys: ZoneSystem;
  private hud: ReturnType<typeof createHUD>;
  private minimap: ReturnType<typeof createMinimap>;
  private rigs = new Map<string, OnlineRig>();
  private lootMeshes = new Map<number, THREE.Mesh>();
  private raf = 0;
  private lastTime = 0;
  private lastSnapTick = -1;
  private renderTimeMs = 0;
  private latencyEl: HTMLElement;
  private input: InputManager;
  private finished = false;
  private cameraPos = new THREE.Vector3();
  private pitch = 0;
  private lastAim = false;
  private minimapFullscreen = false;
  private localHeld?: HeldWeaponKit;
  private zonePhaseIdx = 0;
  private zonePhaseStartMs = 0;
  private onResize = () => {
    const c = this.opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyN') this.minimapFullscreen = !this.minimapFullscreen;
  };

  constructor(opts: OnlineGameOptions) {
    this.opts = opts;
    this.client = opts.client;
    const c = opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;';

    const quality: QualityPreset = opts.settings.quality;
    const { scene, camera, renderer } = createScene(c, quality);
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.zoneSys = new ZoneSystem(scene);
    this.input = createInputManager(c);
    this.hud = createHUD();
    this.minimap = createMinimap();

    this.latencyEl = document.createElement('div');
    this.latencyEl.id = LATENCY_ID;
    this.latencyEl.style.cssText =
      'position:fixed;bottom:8px;left:12px;color:#2dd4bf;font-family:sans-serif;font-size:12px;z-index:9999;pointer-events:none;';
    document.body.appendChild(this.latencyEl);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
  }

  start() {
    this.lastTime = performance.now();
    this.opts.canvas.requestPointerLock();
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
    this.input.dispose();
    this.hud.remove();
    this.minimap.remove();
    for (const rig of this.rigs.values()) this.scene.remove(rig.group);
    for (const m of this.lootMeshes.values()) this.scene.remove(m);
    this.renderer.dispose();
  }

  private frame(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const rawInput = this.input.getInput();
    const sens = this.opts.settings.sensitivity;
    const snap = this.client.interp.latest;
    const playing = snap?.phase === 'playing';

    if (playing) {
      this.pitch -= rawInput.mouseY * sens * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    }

    this.lastAim = rawInput.aim || this.opts.settings.cameraMode === 'fps';

    this.client.sendInput({
      seq: 0,
      forward: rawInput.forward,
      backward: rawInput.backward,
      left: rawInput.left,
      right: rawInput.right,
      sprint: rawInput.sprint,
      jump: rawInput.jump,
      aim: this.lastAim,
      mouseX: rawInput.mouseX * sens,
      mouseY: rawInput.mouseY * sens,
      fire: rawInput.fire,
      reload: rawInput.reload,
    });

    if (snap) {
      this.renderTimeMs = snap.time_ms - REWIND_MS;
      if (snap.tick > this.lastSnapTick) this.syncSnapshot(snap);
    }

    this.syncPlayers(dt);
    this.updateCamera(dt);
    this.updateHUD(snap);
    this.updateMinimap(snap);
    this.renderer.render(this.scene, this.camera);
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
    rig.group.visible = shouldShowUnitRig(alive);
    if (alive) {
      rig.group.position.set(x, y + ROBOT_GROUP_Y_OFFSET, z);
      rig.group.rotation.y = yaw;
    }
    if (isLocal && this.localHeld) {
      syncHeldWeaponKit(this.localHeld, alive ? 'rifle' : 'none');
    }
    updateRobotAnim(rig.anim, dt);
  }

  private updateCamera(dt: number) {
    const self = this.getSelfPose();
    this.cameraPos.set(self.x, self.y, self.z);

    const cameraMode =
      this.lastAim || this.opts.settings.cameraMode === 'fps' ? 'fps' : 'tps';

    updateCamera(
      this.camera,
      self.yaw,
      this.pitch,
      1.6,
      cameraMode,
      this.cameraPos,
      dt,
      { snapPosition: true }
    );
  }

  private updateHUD(snap: WireSnapshot | null) {
    const selfEnt = snap?.entities[this.client.selfId];
    const self = this.getSelfPose();
    const phaseDur = ZONE_PHASE_DURATIONS[snap?.zone.phase ?? 0] ?? 0;
    const elapsedSec =
      snap ? Math.max(0, (snap.time_ms - this.zonePhaseStartMs) / 1000) : 0;
    const zoneTimeMs = Math.max(0, (phaseDur - elapsedSec) * 1000);

    const data: HUDData = {
      kills: 0,
      alive: snap?.alive ?? 0,
      health: this.client.rollback.localState.health,
      armor: selfEnt?.ar ?? 0,
      weapon: 'RIFLE',
      ammo: 30,
      reserve: 90,
      reloading: false,
      grenades: 2,
      heals: 3,
      matchTimer: formatTimer(snap?.time_ms ?? 0),
      phaseLabel: (snap?.phase ?? 'lobby').toUpperCase(),
      zoneTimer: formatTimer(zoneTimeMs),
      healProgress: 0,
      inStorm: false,
      justHit: false,
      prompt: '',
      bearing: this.compassBearing(self.yaw),
    };
    this.hud.update(data);
  }

  private updateMinimap(snap: WireSnapshot | null) {
    if (!snap) return;
    const self = this.getSelfPose();
    const data: MinimapData = {
      px: self.x,
      pz: self.z,
      pyaw: self.yaw,
      aimYaw: self.yaw,
      sx: snap.zone.cx / 100,
      sz: snap.zone.cz / 100,
      sr: snap.zone.r / 100,
      buildings: [
        { x: POI_RADIUS, z: 0 },
        { x: 0, z: POI_RADIUS },
        { x: -POI_RADIUS, z: 0 },
        { x: 0, z: -POI_RADIUS },
      ],
      loot: snap.loot.map((l) => ({
        x: l.px / 100,
        z: l.pz / 100,
        collected: false,
      })),
      enemies: Object.entries(snap.entities)
        .filter(([id, e]) => id !== this.client.selfId && e.al !== 0)
        .map(([, e]) => ({
          x: e.px / 100,
          z: e.pz / 100,
          alive: true,
        })),
      size: this.opts.settings.minimapSize === 'large' ? 240 : 160,
      mapExtent: MAP_SIZE,
      fullscreen: this.minimapFullscreen,
    };
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
