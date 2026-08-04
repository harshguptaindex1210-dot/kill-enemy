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
import { REWIND_MS, type WireSnapshot } from './protocol';

const ROBOT_GROUP_Y_OFFSET = -0.65;
const LATENCY_ID = 'net-latency';

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
  private lastSnap: WireSnapshot | null = null;
  private renderTimeMs = 0;
  private latencyEl: HTMLElement;
  private input: InputManager;
  private finished = false;

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
    this.renderTimeMs = this.lastSnap ? this.lastSnap.time_ms - REWIND_MS : 0;

    const snap = this.client.interp.latest;
    if (snap) this.syncWorld(snap);
    this.updateCamera(dt);
    this.updateHUD(snap);
    this.renderer.render(this.scene, this.camera);
  }

  private syncWorld(snap: WireSnapshot) {
    if (this.lastSnap && snap.tick <= this.lastSnap.tick) return;
    this.lastSnap = snap;

    this.zoneSys.updateFromZone(snap.zone.r / 100);

    // remote entities via interpolation at the render time (REWIND_MS behind)
    const remotes = this.client.sampleRemotes(this.renderTimeMs);
    if (remotes) {
      for (const e of remotes) {
        if (e.id === this.client.selfId) continue;
        this.syncRemoteRig(e.id, e.x, e.y, e.z, e.yaw, e.alive);
      }
    }

    // loot pads from snapshot
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

  private syncRemoteRig(id: string, x: number, y: number, z: number, yaw: number, alive: boolean) {
    let rig = this.rigs.get(id);
    if (!rig) {
      const model = createRobotModel();
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
    updateRobotAnim(rig.anim, 0.05);
  }

  private updateCamera(dt: number) {
    const self = this.client.rollback.localState.pos;
    const yaw = this.selfYaw();
    updateCamera(this.camera, yaw, 0, 1.6, this.opts.settings.cameraMode, self, dt);
  }

  private selfYaw(): number {
    const snap = this.client.interp.latest;
    const self = snap?.entities[this.client.selfId];
    return self ? self.yaw / 100 : 0;
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
      bearing: this.compassBearing(this.selfYaw()),
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
