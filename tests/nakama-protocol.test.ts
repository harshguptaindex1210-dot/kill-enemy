import { describe, it, expect } from 'vitest';
import {
  quantize,
  dequantize,
  decodeSnapshot,
  encodeInput,
  snapshotsConverged,
  TICK_HZ,
  TICK_MS,
  REWIND_MS,
  Q_SCALE,
} from '../src/net/protocol';

describe('protocol (#38)', () => {
  it('quantize/dequantize round-trip', () => {
    expect(dequantize(quantize(12.345))).toBeCloseTo(12.35, 2);
  });

  it('decodes server snapshot JSON', () => {
    const raw = JSON.stringify({
      tick: 10,
      time_ms: 500,
      phase: 'playing',
      alive: 2,
      zone: { cx: 0, cz: 0, r: 40000, dps: 1, phase: 1 },
      entities: {
        u1: { px: 10000, py: 90, pz: 0, vx: 0, vy: 0, vz: -600, hp: 100, ar: 0, al: 1, yaw: 0 },
      },
      loot: [],
    });
    const snap = decodeSnapshot(raw);
    expect(snap.tick).toBe(10);
    expect(snap.entities.u1.hp).toBe(100);
  });

  it('encodeInput produces JSON string', () => {
    const s = encodeInput({ seq: 1, forward: true, fire: false });
    const parsed = JSON.parse(s);
    expect(parsed.forward).toBe(true);
    expect(parsed.seq).toBe(1);
  });

  it('snapshotsConverged within tolerance', () => {
    const base = {
      tick: 5,
      time_ms: 250,
      phase: 'playing',
      alive: 2,
      zone: { cx: 0, cz: 0, r: 40000, dps: 1, phase: 1 },
      entities: {
        p1: { px: 10000, py: 90, pz: 0, vx: 0, vy: 0, vz: 0, hp: 100, ar: 0, al: 1, yaw: 0 },
      },
      loot: [],
    };
    const a = { ...base, entities: { p1: { ...base.entities.p1 } } };
    const b = {
      ...base,
      entities: { p1: { ...base.entities.p1, px: base.entities.p1.px + 100 } },
    };
    expect(snapshotsConverged(a, b, 'p1', 4)).toBe(true);
    expect(snapshotsConverged(a, b, 'p1', 0.5)).toBe(false);
  });

  it('constants match server config', () => {
    expect(TICK_HZ).toBe(20);
    expect(TICK_MS).toBe(50);
    expect(REWIND_MS).toBe(100);
    expect(Q_SCALE).toBe(100);
  });
});
