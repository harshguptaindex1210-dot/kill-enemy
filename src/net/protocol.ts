/** Wire protocol helpers for Nakama authoritative snapshots (#38). */

export const OP_INPUT = 1;
export const OP_SNAPSHOT = 2;
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const REWIND_MS = 100;
export const MAX_MATCH_MS = 25 * 60 * 1000;
export const Q_SCALE = 100;

export interface WireInput {
  seq: number;
  forward?: boolean;
  backward?: boolean;
  left?: boolean;
  right?: boolean;
  sprint?: boolean;
  crouch?: boolean;
  jump?: boolean;
  aim?: boolean;
  mouseX?: number;
  mouseY?: number;
  fire?: boolean;
  reload?: boolean;
  heal?: boolean;
  glooWall?: boolean;
}

export interface WireEntity {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  ar: number;
  al: number;
  yaw: number;
}

export interface WireSnapshot {
  tick: number;
  time_ms: number;
  phase: string;
  alive: number;
  /** Last processed input sequence per entity; used for rollback replay. */
  acks?: Record<string, number>;
  zone: { cx: number; cz: number; r: number; dps: number; phase: number };
  entities: Record<string, WireEntity>;
  loot: { id: number; px: number; pz: number; t: string }[];
  winner?: string | null;
}

export function quantize(v: number): number {
  return Math.round(v * Q_SCALE);
}

export function dequantize(v: number): number {
  return v / Q_SCALE;
}

export function decodeSnapshot(raw: string): WireSnapshot {
  return JSON.parse(raw) as WireSnapshot;
}

export function entityWorld(e: WireEntity) {
  return {
    x: dequantize(e.px),
    y: dequantize(e.py),
    z: dequantize(e.pz),
    vx: dequantize(e.vx),
    vy: dequantize(e.vy),
    vz: dequantize(e.vz),
    health: e.hp,
    armor: e.ar,
    alive: e.al === 1,
    yaw: dequantize(e.yaw),
  };
}

export function encodeInput(input: WireInput): string {
  return JSON.stringify(input);
}

/** Returns max position error between two snapshots for one entity (metres). */
export function snapshotPosError(a: WireSnapshot, b: WireSnapshot, entityId: string): number {
  const ea = a.entities[entityId];
  const eb = b.entities[entityId];
  if (!ea || !eb) return Infinity;
  const ax = dequantize(ea.px);
  const az = dequantize(ea.pz);
  const bx = dequantize(eb.px);
  const bz = dequantize(eb.pz);
  return Math.hypot(ax - bx, az - bz);
}

/** True when two clients' snapshots agree within tolerance (default 200 ms worth of movement). */
export function snapshotsConverged(
  a: WireSnapshot,
  b: WireSnapshot,
  entityId: string,
  toleranceM = 4
): boolean {
  if (a.tick !== b.tick) return false;
  return snapshotPosError(a, b, entityId) <= toleranceM;
}
