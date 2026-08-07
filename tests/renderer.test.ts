import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMockRenderer() {
  return {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    getContext: () => ({}),
    shadowMap: { enabled: true, type: 0 },
  };
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(createMockRenderer),
  };
});

describe('createRenderer', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    vi.stubGlobal('window', {
      ...window,
      devicePixelRatio: 2,
      innerWidth: 1280,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0',
      maxTouchPoints: 0,
    });
  });

  it('creates renderer sized to canvas with medium preset', async () => {
    const { createRenderer } = await import('../src/renderer');
    const renderer = createRenderer(canvas, 'medium');

    const { WebGLRenderer } = await import('three');
    expect(WebGLRenderer).toHaveBeenCalled();
    expect(renderer.setSize).toHaveBeenCalledWith(1024, 576);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.domElement).toBeDefined();
  });

  it('creates renderer with low preset (pixelRatio=1, shadows disabled)', async () => {
    const { createRenderer } = await import('../src/renderer');
    const renderer = createRenderer(canvas, 'low');

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.shadowMap.enabled).toBe(false);
  });

  it('caps pixel ratio and disables shadows on mobile', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5,
    });
    const { createRenderer } = await import('../src/renderer');
    const renderer = createRenderer(canvas, 'medium');

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.shadowMap.enabled).toBe(false);
  });
});
