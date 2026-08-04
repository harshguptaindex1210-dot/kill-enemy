import * as THREE from 'three';
import { createScene, type QualityPreset } from './scene';
import { MatchSim, type SimEvent, type SimUnit } from './gameplay';
import { ZoneSystem } from './zone';
import { createInputManager, type InputManager } from './input';
import { updateCamera } from './camera';
import { createRobotModel, transitionAnim, updateRobotAnim, type RobotAnimState } from './robot';
import { createHUD, createMinimap, addKillFeedEntry, type HUDData, type MinimapData } from './hud';
import { createVehicle } from './vehicle';
import type { AudioManager } from './audio';
import type { Settings } from './settings';
import { formatPlacement, formatTimer } from './feedback';
import { calculateXP } from './match';

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

export interface MatchGameOptions {
  canvas: HTMLCanvasElement;
  settings: Settings;
  audio: AudioManager;
  botCount?: number;
  seed?: number;
  callbacks: MatchGameCallbacks;
}

interface UnitRig {
  group: THREE.Group;
  anim: RobotAnimState;
  dead: boolean;
}

const ROBOT_GROUP_Y_OFFSET = -0.65;
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
  private projMeshes = new Map<number, THREE.Mesh>();
  private explosionFx: { light: THREE.PointLight; mesh: THREE.Mesh; until: number }[] = [];

  private bannerEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private hitmarkerEl: HTMLElement;

  private keys = new Set<string>();
  private usePressed = false;
  private healMedPressed = false;
  private healBandPressed = false;
  private spectatePressed = false;

  private humanId: string;
  private dead = false;
  private finished = false;
  private spectateId: string | null = null;
  private minimapFullscreen = false;
  private raf = 0;
  private lastTime = 0;

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'KeyE') this.usePressed = true;
    if (e.code === 'KeyH') this.healMedPressed = true;
    if (e.code === 'KeyB') this.healBandPressed = true;
    if (e.code === 'KeyF') this.spectatePressed = true;
    if (e.code === 'KeyM') this.minimapFullscreen = !this.minimapFullscreen;
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onResize = () => {
    const c = this.opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private opts: MatchGameOptions;

  constructor(opts: MatchGameOptions) {
    this.opts = opts;
    this.settings = opts.settings;
    this.audio = opts.audio;
    this.callbacks = opts.callbacks;
    const c = opts.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;';

    const quality: QualityPreset = this.settings.quality;
    const { scene, camera, renderer, controls, pois } = createScene(c, quality);
    controls.enabled = false;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.sim = new MatchSim({
      seed: opts.seed,
      botCount: opts.botCount ?? 9,
      time: 0,
    });
    this.humanId = this.sim.humanId;

    this.zoneSys = new ZoneSystem(scene);
    this.input = createInputManager(c);
    this.hud = createHUD();
    this.minimap = createMinimap();

    this.buildRigs();
    this.buildLoot();
    this.buildVehicles();

    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'phase-banner';
    this.bannerEl.style.cssText =
      'position:fixed;top:22%;left:50%;transform:translateX(-50%);color:#fff;font-family:sans-serif;font-size:34px;letter-spacing:4px;text-shadow:0 2px 10px rgba(0,0,0,0.8);z-index:9998;pointer-events:none;display:none;';
    document.body.appendChild(this.bannerEl);

    this.crosshairEl = document.createElement('div');
    this.crosshairEl.style.cssText =
      'position:fixed;top:50%;left:50%;width:6px;height:6px;transform:translate(-50%,-50%);background:#fff;border-radius:50%;z-index:9998;pointer-events:none;mix-blend-mode:difference;';
    document.body.appendChild(this.crosshairEl);

    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.id = 'hitmarker';
    this.hitmarkerEl.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;z-index:9998;pointer-events:none;display:none;';
    this.hitmarkerEl.innerHTML =
      '<svg viewBox="0 0 20 20"><g stroke="#fff" stroke-width="2"><line x1="10" y1="0" x2="10" y2="5"/><line x1="10" y1="15" x2="10" y2="20"/><line x1="0" y1="10" x2="5" y2="10"/><line x1="15" y1="10" x2="20" y2="10"/></g></svg>';
    document.body.appendChild(this.hitmarkerEl);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);

    void pois;
  }

  start() {
    this.sim.startMatch();
    this.banner('GET READY');
    this.opts.canvas.requestPointerLock();
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
    this.hud.remove();
    this.minimap.remove();
    for (const rig of this.rigs.values()) this.scene.remove(rig.group);
    for (const m of this.lootMeshes.values()) this.scene.remove(m);
    for (const m of this.vehicleMeshes.values()) this.scene.remove(m);
    for (const m of this.airdropMeshes.values()) this.scene.remove(m);
    for (const m of this.projMeshes.values()) this.scene.remove(m);
    for (const fx of this.explosionFx) {
      this.scene.remove(fx.light);
      this.scene.remove(fx.mesh);
    }
    this.renderer.dispose();
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
    for (const unit of this.sim.units.values()) {
      const model = createRobotModel();
      const color = unit.color;
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.18, 0.04),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
      );
      mark.position.set(0, 1.35, 0.26);
      model.group.add(mark);

      const rifle = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.12, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 })
      );
      rifle.position.set(0.55, 0.95, -0.15);
      rifle.rotation.x = Math.PI / 2;
      model.group.add(rifle);

      model.group.position.copy(unit.player.position);
      model.group.position.y = unit.player.position.y + ROBOT_GROUP_Y_OFFSET;
      model.group.rotation.y = unit.player.yaw;
      this.scene.add(model.group);
      this.rigs.set(unit.id, { group: model.group, anim: model.anim, dead: false });
    }
  }

  private buildLoot() {
    for (const spawn of this.sim.loot) {
      const color =
        spawn.loot.type === 'weapon'
          ? 0xff4444
          : spawn.loot.type === 'ammo'
            ? 0xffaa00
            : spawn.loot.type === 'armor'
              ? 0x4444ff
              : 0x44ff44;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 0.4),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
      );
      mesh.position.copy(spawn.position);
      this.scene.add(mesh);
      this.lootMeshes.set(spawn.id, mesh);
    }
  }

  private buildVehicles() {
    for (const v of this.sim.vehicles) {
      const { mesh } = createVehicle(v.type, v.state.position);
      this.scene.add(mesh);
      this.vehicleMeshes.set(v.id, mesh);
    }
  }

  private humanUnit(): SimUnit {
    return this.sim.units.get(this.humanId)!;
  }

  private frame(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.handleActions();

    const human = this.humanUnit();
    let input = undefined;
    if (this.sim.match.phase === 'playing' && human.alive) {
      const raw = this.input.getInput();
      const sens = this.settings.sensitivity;
      input = { ...raw, mouseX: raw.mouseX * sens, mouseY: raw.mouseY * sens };
    } else {
      this.input.getInput();
    }

    this.sim.update(dt, input);
    this.processEvents(this.sim.events.splice(0, this.sim.events.length), dt);
    this.syncVisuals(dt);
    this.updateCamera(dt);
    this.updateHUD();
    this.updateMinimap();
    this.renderer.render(this.scene, this.camera);
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
    if (this.spectatePressed) {
      this.spectatePressed = false;
      if (this.dead) this.pickSpectateTarget();
      else if (human.inVehicleId !== null) this.sim.exitVehicle(this.humanId);
    }
  }

  private processEvents(events: SimEvent[], dt: number) {
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          if (e.melee) this.audio.play('melee');
          else if (e.grenade) this.audio.play('shot');
          else this.audio.play(e.weapon === 'pistol' ? 'pistol' : 'shot');
          this.muzzleFlash(String(e.unitId));
          break;
        }
        case 'explosion':
          this.audio.play('explosion');
          this.spawnExplosion(e.position as THREE.Vector3);
          break;
        case 'hit': {
          const attacker = String(e.attackerId);
          const victim = String(e.victimId);
          if (attacker === this.humanId) {
            this.showHitmarker(Boolean(e.kill));
            this.audio.play(e.kill ? 'clink' : 'hit');
          } else if (victim === this.humanId) {
            this.audio.play('hit');
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
      this.banner('ELIMINATED — SPECTATING', 2500);
      this.pickSpectateTarget();
    } else if ((phase === 'ended' || phase === 'results') && !this.finished) {
      this.finished = true;
      this.finishMatch();
    }
  }

  private pickSpectateTarget() {
    const alive = this.sim.aliveUnits.filter((u) => u.id !== this.humanId);
    if (alive.length === 0) return;
    const current = this.spectateId;
    const idx = alive.findIndex((u) => u.id === current);
    const next = alive[(idx + 1) % alive.length];
    this.spectateId = next.id;
  }

  private finishMatch() {
    document.exitPointerLock();
    const summary = summarizeMatch(this.sim);
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
    const origin = new THREE.Vector3(0, unit.player.getEyeHeight(), 0);
    const dir = new THREE.Vector3(
      -Math.sin(unit.player.yaw),
      -Math.sin(unit.player.pitch),
      -Math.cos(unit.player.yaw)
    );
    const muzzle = origin.addScaledVector(dir, 1.1);

    const light = new THREE.PointLight(0xffff44, 4, 16);
    light.position.copy(muzzle);
    this.scene.add(light);
    const tracer = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    tracer.position.copy(muzzle);
    this.scene.add(tracer);
    setTimeout(() => {
      this.scene.remove(light);
      this.scene.remove(tracer);
    }, 80);
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
      const mesh = this.lootMeshes.get(spawn.id);
      if (mesh) {
        mesh.visible = !spawn.collected;
        mesh.position.y = 0.5 + Math.sin(now * 0.002 + spawn.id) * 0.08;
      }
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
      rig.group.visible = unit.inVehicleId === null;
      if (unit.inVehicleId === null) {
        rig.group.position.copy(unit.player.position);
        rig.group.position.y = unit.player.position.y + ROBOT_GROUP_Y_OFFSET;
        rig.group.rotation.y = unit.player.yaw;
        const state = unit.player.state;
        const anim =
          state === 'sprint'
            ? 'run'
            : state === 'crouch'
              ? 'crouch'
              : state === 'jump'
                ? 'jump'
                : 'idle';
        transitionAnim(rig.anim, anim);
      }
      updateRobotAnim(rig.anim, dt);
    } else if (!rig.dead) {
      rig.dead = true;
      rig.group.rotation.x = -Math.PI / 2;
      const mark = rig.group.children[0] as THREE.Mesh;
      const mat = mark.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0;
    }
  }

  private syncAirdrops() {
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
      mesh.visible = !a.claimed;
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
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0x223322, metalness: 0.6, roughness: 0.4 })
        );
        this.scene.add(mesh);
        this.projMeshes.set(p.id, mesh);
      }
      mesh.position.copy(p.position);
    }
    for (const [id, mesh] of this.projMeshes) {
      if (!active.has(id)) {
        this.scene.remove(mesh);
        this.projMeshes.delete(id);
      }
    }
  }

  private updateCamera(dt: number) {
    const human = this.humanUnit();
    if (human.alive) {
      updateCamera(
        this.camera,
        human.player.yaw,
        human.player.pitch,
        human.player.getEyeHeight(),
        human.player.cameraMode,
        human.player.position,
        dt
      );
      return;
    }
    const target = this.spectateId ? this.sim.units.get(this.spectateId) : null;
    const t = target && target.alive ? target.player.position : new THREE.Vector3(0, 10, 0);
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
    const zoneTimeMs = this.zoneSys.phaseTotalDuration - this.zoneSys.phaseTime;

    let healProgress = 0;
    if (human.healing) {
      const dur = human.healing.kind === 'medkit' ? 4000 : 2000;
      const elapsed = dur - (human.healing.until - this.sim.time);
      healProgress = Math.max(0, Math.min(1, elapsed / dur));
    }

    const data: HUDData = {
      kills: this.sim.match.players[this.humanId].kills,
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
      phaseLabel: this.phaseLabel(),
      zoneTimer: formatTimer(zoneTimeMs * 1000),
      healProgress,
      inStorm: human.alive && this.zoneSys.isOutsideZone(human.player.position),
      justHit: human.lastDamageTime > 0 && this.sim.time - human.lastDamageTime < 150,
      prompt: human.alive ? computeInteractionPrompt(this.sim, this.humanId) : '',
    };
    this.hud.update(data);
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
    const data: MinimapData = {
      px: human.player.position.x,
      pz: human.player.position.z,
      pyaw: human.player.yaw,
      sx: this.zoneSys.center.x,
      sz: this.zoneSys.center.z,
      sr: this.zoneSys.innerRadius,
      buildings: [
        { x: 300, z: 0 },
        { x: 0, z: 300 },
        { x: -300, z: 0 },
        { x: 0, z: -300 },
      ],
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
      fullscreen: this.minimapFullscreen,
    };
    this.minimap.update(data);
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
}
