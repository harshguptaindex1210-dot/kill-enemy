import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMinimap, type MinimapData } from '../src/hud';

interface ArcCall {
  kind: 'arc';
  x: number;
  y: number;
  radius: number;
  fillStyle: string;
}

function makeMinimapData(overrides: Partial<MinimapData> = {}): MinimapData {
  return {
    px: 24,
    pz: -12,
    pyaw: 0,
    aimYaw: 0.6,
    sx: 0,
    sz: 0,
    sr: 110,
    buildings: [{ x: 12, z: 8 }],
    loot: [{ x: -16, z: 22, collected: false }],
    enemies: [{ x: 40, z: -28, alive: true }],
    airdrops: [{ x: 30, z: 12, claimed: false }],
    size: 160,
    mapExtent: 600,
    fullscreen: false,
    ...overrides,
  };
}

describe('createMinimap', () => {
  const arcCalls: ArcCall[] = [];
  let fillStyle = '#000';

  beforeEach(() => {
    arcCalls.length = 0;
    fillStyle = '#000';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const ctx = {
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string) {
          fillStyle = value;
        },
        strokeStyle: '#000',
        lineWidth: 1,
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: (x: number, y: number, radius: number) => {
          arcCalls.push({ kind: 'arc', x, y, radius, fillStyle });
        },
      };
      return ctx as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById('minimap')?.remove();
  });

  it('draws a high-contrast local player marker at map center', () => {
    const minimap = createMinimap();
    minimap.update(makeMinimapData());

    const centerArcs = arcCalls.filter((c) => c.x === 80 && c.y === 80);
    const localMarker = centerArcs.slice(-3);

    expect(localMarker).toHaveLength(3);
    expect(localMarker.map((c) => c.radius)).toEqual([5, 3.6, 2.4]);
    expect(localMarker.map((c) => c.fillStyle)).toEqual(['#ffffff', '#0f172a', '#7ec8b8']);

    minimap.remove();
  });

  it('anchors minimap to top-right with safe spacing after fullscreen toggle', () => {
    const minimap = createMinimap();
    minimap.update(makeMinimapData({ fullscreen: true }));
    const canvas = document.getElementById('minimap') as HTMLCanvasElement;
    expect(canvas.style.top).toBe('50%');
    expect(canvas.style.right).toBe('50%');

    minimap.update(makeMinimapData({ fullscreen: false }));
    expect(canvas.style.top).toContain('safe-area-inset-top');
    expect(canvas.style.right).toContain('safe-area-inset-right');
    expect(canvas.style.transform).toBe('none');

    minimap.remove();
  });
});
