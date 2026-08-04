import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager } from '../src/audio';

let created = 0;

function fakeAC(): typeof AudioContext {
  const destination: Record<string, unknown> = { connect: () => destination };
  const Fake = class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = destination;
    constructor() {
      created++;
    }
    createBuffer(ch: number, len: number) {
      return { numberOfChannels: ch, length: len, getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect: (t: unknown) => t,
        start: () => undefined,
        stop: () => undefined,
      };
    }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: (t: unknown) => t,
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: (t: unknown) => t,
        start: () => undefined,
        stop: () => undefined,
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: (t: unknown) => t,
      };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  };
  return Fake as unknown as typeof AudioContext;
}

describe('AudioManager (#32)', () => {
  const original = (globalThis as Record<string, unknown>).AudioContext;

  beforeEach(() => {
    created = 0;
    vi.stubGlobal('AudioContext', fakeAC());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (original) (globalThis as Record<string, unknown>).AudioContext = original;
  });

  it('creates no AudioContext at construction time', () => {
    const audio = new AudioManager();
    expect(created).toBe(0);
    expect(audio.isMuted()).toBe(false);
  });

  it('does not create an AudioContext while muted', () => {
    const audio = new AudioManager();
    audio.setMuted(true);
    audio.resume();
    audio.play('shot');
    expect(created).toBe(0);
  });

  it('does not create an AudioContext at zero volume', () => {
    const audio = new AudioManager();
    audio.setVolume(0);
    audio.resume();
    audio.play('shot');
    expect(created).toBe(0);
  });

  it('creates an AudioContext on the first playback gesture', () => {
    const audio = new AudioManager();
    audio.resume();
    audio.play('pistol');
    expect(created).toBe(1);
  });

  it('reuses the single AudioContext across plays', () => {
    const audio = new AudioManager();
    audio.resume();
    audio.play('shot');
    audio.play('hit');
    audio.play('pickup');
    expect(created).toBe(1);
  });

  it('toggles mute state', () => {
    const audio = new AudioManager();
    expect(audio.isMuted()).toBe(false);
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
  });
});
