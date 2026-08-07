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

describe('lobby scene (#65)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      innerWidth: 1280,
      innerHeight: 720,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    });
  });

  it('creates a dedicated lobby scene with start/stop/dispose', async () => {
    const { createLobbyScene } = await import('../src/lobbyScene');
    const canvas = document.createElement('canvas');
    const handle = createLobbyScene(canvas, 'low', {
      chassisColor: 0x3366cc,
      rifleColor: 0xffcc33,
      pistolColor: 0xff8844,
    });
    handle.start();
    handle.setCosmetics({ chassisColor: 0xcc3344, rifleColor: 0xff5522, pistolColor: 0xaa66ff });
    handle.stop();
    handle.dispose();
    expect(canvas.style.position).toBe('fixed');
  });
});
