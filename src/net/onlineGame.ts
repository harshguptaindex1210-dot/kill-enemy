import * as THREE from 'three';
import { createScene, type QualityPreset } from '../scene';
import { createRobotModel, updateRobotAnim, type RobotAnimState } from '../robot';
import { ZoneSystem } from '../zone';
import { createHUD, createMinimap, type HUDData } from '../hud';
import { updateCamera } from '../camera';
import { createInputManager, type InputManager } from '../input';
import { MatchClient } from './client';
import type { AudioManager } from '../audio';
import type { Settings } from '../settings';
import { formatTimer } from '../feedback';
import { REWIND_MS, entityWorld, type WireSnapshot } from './protocol';

const ROBOT_GROUP_Y_OFFSET = -0.65;
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

interface SelfPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
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
  private smoothedYaw = 0;
  private yawInit = false;

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
      'position:fixed;bottom:8px;left:12px;color:#8af;font-family:sans-serif;font-size:12px;z-index:9999;pointer-events:none;';
    document.body.appendChild(this.latencyEl);
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
    const input = this.input.getInput();
    this.client.sendInput({
      seq: 0,
      forward: input.forward,
      backward: input.backward,
      left: input.left,
      right: input.right,
      sprint: input.sprint,
      jump: input.jump,
      aim: input.aim,
      mouseX: input.mouseX,
      mouseY: input.mouseY,
      fire: input.fire,
      reload: input.reload,
    });

    const snap = this.client.interp.latest;
    if (snap) {
      this.renderTimeMs = snap.time_ms - REWIND_MS;
      if (snap.tick > this.lastSnapTick) this.syncSnapshot(snap);
    }

    this.syncPlayers(dt);
    this.updateCamera(dt);
    this.updateHUD(snap);
    this.renderer.render(this.scene, this.camera);
  }

  /** Zone, loot, and latency — only when a new authoritative tick arrives. */
  private syncSnapshot(snap: WireSnapshot) {
    this.lastSnapTick = snap.tick;
    this.zoneSys.updateFromZone(snap.zone.r / 100);

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

  /** Interpolate remote rigs every frame; local rig uses a single pose source. */
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
    if (this.client.mode === 'local') {
      const sampled = this.client.sampleRemotes(this.renderTimeMs);
      const hit = sampled?.find((e) => e.id === this.client.selfId);
      if (hit) {
        return { x: hit.x, y: hit.y, z: hit.z, yaw: hit.yaw, alive: hit.alive };
      }
      const ent = this.client.interp.latest?.entities[this.client.selfId];
      if (ent) {
        const w = entityWorld(ent);
        return { x: w.x, y: w.y, z: w.z, yaw: w.yaw, alive: w.alive };
      }
    }
    const state = this.client.rollback.localState;
    const ent = this.client.interp.latest?.entities[this.client.selfId];
    return {
      x: state.pos.x,
      y: state.pos.y,
      z: state.pos.z,
      yaw: this.client.rollback.yaw,
      alive: ent ? ent.al !== 0 : true,
    };
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
      model.group.position.set(x, y + ROBOT_GROUP_Y_OFFSET, z);
      this.scene.add(model.group);
      rig = { group: model.group, anim: model.anim };
      this.rigs.set(id, rig);
    }
    rig.group.visible = alive;
    if (alive) {
      rig.group.position.set(x, y + ROBOT_GROUP_Y_OFFSET, z);
      rig.group.rotation.y = yaw;
    }
    updateRobotAnim(rig.anim, dt);
  }

  private updateCamera(dt: number) {
    const self = this.getSelfPose();
    this.cameraPos.set(self.x, self.y, self.z);

    if (!this.yawInit) {
      this.smoothedYaw = self.yaw;
      this.yawInit = true;
    } else {
      const delta = Math.atan2(Math.sin(self.yaw - this.smoothedYaw), Math.cos(self.yaw - this.smoothedYaw));
      const yawLerp = 1 - Math.pow(0.001, dt);
      this.smoothedYaw += delta * yawLerp;
    }

    updateCamera(
      this.camera,
      this.smoothedYaw,
      0,
      1.6,
      this.opts.settings.cameraMode,
      this.cameraPos,
      dt
    );
  }

  private updateHUD(snap: WireSnapshot | null) {
    const self = snap?.entities[this.client.selfId];
    const data: HUDData = {
      kills: 0,
      alive: snap?.alive ?? 0,
      health: this.client.rollback.localState.health,
      armor: self?.ar ?? 0,
      weapon: 'RIFLE',
      ammo: 30,
      reserve: 90,
      reloading: false,
      grenades: 2,
      heals: 3,
      matchTimer: formatTimer(snap?.time_ms ?? 0),
      phaseLabel: (snap?.phase ?? 'lobby').toUpperCase(),
      zoneTimer: formatTimer(0),
      healProgress: 0,
      inStorm: false,
      justHit: false,
      prompt: '',
      bearing: this.compassBearing(this.smoothedYaw),
    };
    this.hud.update(data);
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
