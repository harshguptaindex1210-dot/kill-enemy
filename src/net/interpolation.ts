import type { WireSnapshot } from './protocol';
import { entityWorld } from './protocol';

export interface InterpolatedEntity {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  health: number;
  armor: number;
  alive: boolean;
  yaw: number;
}

/**
 * Buffers authoritative snapshots and samples them at an arbitrary render time
 * (INV-2). Remote entities are interpolated between the two snapshots that
 * bracket the sample time; anything outside the window snaps to the nearest.
 */
export class InterpolationBuffer {
  private snaps: WireSnapshot[] = [];
  private maxMs = 600;

  push(snap: WireSnapshot) {
    this.snaps.push(snap);
    const cutoff = snap.time_ms - this.maxMs;
    while (this.snaps.length > 2 && this.snaps[1].time_ms < cutoff) {
      this.snaps.shift();
    }
  }

  clear() {
    this.snaps = [];
  }

  get latest(): WireSnapshot | null {
    return this.snaps.length ? this.snaps[this.snaps.length - 1] : null;
  }

  /**
   * Sample entity states at server time `timeMs`. Returns null until at least
   * one snapshot exists.
   */
  sample(timeMs: number): InterpolatedEntity[] | null {
    const latest = this.latest;
    if (!latest) return null;
    if (this.snaps.length < 2) return this.flatten(latest);
    if (timeMs >= latest.time_ms) return this.flatten(latest);

    const aIdx = this.snaps.findIndex((s) => s.time_ms >= timeMs);
    const a = aIdx <= 0 ? this.snaps[0] : this.snaps[aIdx - 1];
    const b = this.snaps[aIdx] ?? a;
    const t = a.time_ms === b.time_ms ? 0 : (timeMs - a.time_ms) / (b.time_ms - a.time_ms);
    return this.blend(a, b, Math.max(0, Math.min(1, t)));
  }

  private flatten(snap: WireSnapshot): InterpolatedEntity[] {
    return Object.entries(snap.entities).map(([id, e]) => {
      const w = entityWorld(e);
      return { id, ...w, armor: w.armor, yaw: w.yaw };
    });
  }

  private blend(a: WireSnapshot, b: WireSnapshot, t: number): InterpolatedEntity[] {
    const ids = new Set([...Object.keys(a.entities), ...Object.keys(b.entities)]);
    const out: InterpolatedEntity[] = [];
    for (const id of ids) {
      const ea = a.entities[id];
      const eb = b.entities[id];
      const wa = ea ? entityWorld(ea) : null;
      const wb = eb ? entityWorld(eb) : null;
      if (!wa) {
        out.push({ id, ...wb! });
        continue;
      }
      if (!wb) {
        out.push({ id, ...wa });
        continue;
      }
      const lerp = (x: number, y: number) => x + (y - x) * t;
      out.push({
        id,
        x: lerp(wa.x, wb.x),
        y: lerp(wa.y, wb.y),
        z: lerp(wa.z, wb.z),
        vx: lerp(wa.vx, wb.vx),
        vy: lerp(wa.vy, wb.vy),
        vz: lerp(wa.vz, wb.vz),
        health: Math.round(lerp(wa.health, wb.health)),
        armor: Math.round(lerp(wa.armor, wb.armor)),
        alive: wb.alive,
        yaw: lerp(wa.yaw, wb.yaw),
      });
    }
    return out;
  }
}

/** Accumulates inputs and flushes them as one batch per server tick. */
export class InputBatcher<T> {
  private queue: T[] = [];

  push(input: T) {
    this.queue.push(input);
  }

  flush(): T[] {
    if (this.queue.length === 0) return [];
    const batch = this.queue;
    this.queue = [];
    return batch;
  }

  get pending(): number {
    return this.queue.length;
  }
}
