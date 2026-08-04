import { MatchSim, type SimEvent } from '../gameplay';
import { quantize, TICK_MS, type WireInput, type WireSnapshot } from './protocol';

const TICK_HZ = 20;

export interface LocalServerCallbacks {
  onSnapshot: (snap: WireSnapshot) => void;
  onEvents?: (events: SimEvent[]) => void;
}

/**
 * In-process authoritative server wrapping MatchSim (the same sim used by local
 * bot mode). Emits the same WireSnapshot protocol as the Nakama server, so the
 * client path is identical for online and offline play (#39).
 */
export class LocalServer {
  sim: MatchSim;
  private input: WireInput | null = null;
  private lastInputSeq = 0;
  private tick = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private listeners: LocalServerCallbacks;
  private humanId = 'player';

  constructor(callbacks: LocalServerCallbacks, options: { seed?: number; botCount?: number } = {}) {
    this.listeners = callbacks;
    this.sim = new MatchSim({
      seed: options.seed,
      botCount: options.botCount ?? 9,
      humanId: this.humanId,
      time: 0,
    });
  }

  get aliveCount(): number {
    return this.sim.match.aliveCount;
  }

  get phase(): string {
    return this.sim.match.phase;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.sim.startMatch();
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  /** Push an input frame for the human unit; last-write-wins per tick. */
  sendInput(input: WireInput) {
    this.input = input;
  }

  /** Advance one tick manually (used by tests and the browser driver). */
  step() {
    this.tick++;
    if (this.input) this.lastInputSeq = Math.max(this.lastInputSeq, this.input.seq);
    this.sim.update(1 / TICK_HZ, this.toPlayerInput(this.input));
    this.input = null;
    if (this.listeners.onEvents) {
      const events = this.sim.events.splice(0, this.sim.events.length);
      if (events.length) this.listeners.onEvents(events);
    }
    this.listeners.onSnapshot(this.buildSnapshot());
  }

  private toPlayerInput(w: WireInput | null) {
    return {
      forward: w?.forward ?? false,
      backward: w?.backward ?? false,
      left: w?.left ?? false,
      right: w?.right ?? false,
      sprint: w?.sprint ?? false,
      crouch: false,
      jump: w?.jump ?? false,
      aim: w?.aim ?? false,
      fire: w?.fire ?? false,
      reload: w?.reload ?? false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
      mouseX: w?.mouseX ?? 0,
      mouseY: w?.mouseY ?? 0,
    };
  }

  private buildSnapshot(): WireSnapshot {
    const s = this.sim;
    const entities: WireSnapshot['entities'] = {};
    for (const unit of s.units.values()) {
      const p = unit.player;
      entities[unit.id] = {
        px: quantize(p.position.x),
        py: quantize(p.position.y),
        pz: quantize(p.position.z),
        vx: quantize(p.velocity.x),
        vy: quantize(p.velocity.y),
        vz: quantize(p.velocity.z),
        hp: Math.round(unit.health),
        ar: Math.round(unit.armor),
        al: unit.alive ? 1 : 0,
        yaw: quantize(p.yaw),
      };
    }
    const loot = s.loot
      .filter((l) => !l.collected)
      .map((l) => ({
        id: l.id,
        px: quantize(l.position.x),
        pz: quantize(l.position.z),
        t: l.loot.type,
      }));
    return {
      tick: this.tick,
      time_ms: Math.round(s.time),
      phase: s.match.phase,
      alive: s.match.aliveCount,
      acks: { [this.humanId]: this.lastInputSeq },
      zone: {
        cx: quantize(s.zone.center.x),
        cz: quantize(s.zone.center.z),
        r: quantize(s.zone.innerRadius),
        dps: s.zone.damagePerSec,
        phase: s.zone.currentPhase,
      },
      entities,
      loot,
      winner: s.match.winnerId,
    };
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
