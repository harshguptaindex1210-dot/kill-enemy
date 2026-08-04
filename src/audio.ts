export type SfxName =
  | 'shot'
  | 'pistol'
  | 'melee'
  | 'hit'
  | 'explosion'
  | 'bounce'
  | 'zone'
  | 'step'
  | 'pickup'
  | 'levelup'
  | 'ui'
  | 'heal'
  | 'clink';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.7;
  private muted = false;
  private zoneWarningUntil = 0;

  constructor() {}

  setVolume(v: number) {
    this.volume = Math.min(Math.max(v, 0), 1);
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  isMuted(): boolean {
    return this.muted;
  }

  resume() {
    this.ensure();
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    gain: number = 0.3,
    freqEnd?: number
  ) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(gain * this.volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(ctx: AudioContext, dur: number, filterFreq: number, gain: number = 0.4) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(filterFreq * 0.2, 40),
      ctx.currentTime + dur
    );
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * this.volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  play(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'shot':
        this.noise(ctx, 0.15, 3000, 0.5);
        this.tone(ctx, 130, 0.15, 'sine', 0.5, 60);
        break;
      case 'pistol':
        this.noise(ctx, 0.08, 2400, 0.35);
        this.tone(ctx, 200, 0.08, 'square', 0.2, 120);
        break;
      case 'melee':
        this.noise(ctx, 0.2, 900, 0.2);
        break;
      case 'hit':
        this.tone(ctx, 900, 0.06, 'square', 0.18);
        break;
      case 'clink':
        this.tone(ctx, 1400, 0.05, 'triangle', 0.25);
        break;
      case 'explosion':
        this.noise(ctx, 0.7, 800, 0.7);
        this.tone(ctx, 80, 0.6, 'sine', 0.6, 30);
        break;
      case 'bounce':
        this.tone(ctx, 420, 0.06, 'triangle', 0.15, 300);
        break;
      case 'zone':
        if (now < this.zoneWarningUntil) return;
        this.zoneWarningUntil = now + 1.2;
        this.tone(ctx, 880, 0.25, 'square', 0.15);
        this.tone(ctx, 660, 0.25, 'square', 0.15);
        break;
      case 'step':
        this.noise(ctx, 0.05, 600, 0.08);
        break;
      case 'pickup':
        this.tone(ctx, 500, 0.08, 'sine', 0.2, 700);
        this.tone(ctx, 800, 0.12, 'sine', 0.2, 1000);
        break;
      case 'levelup':
        [660, 880, 1100, 1320].forEach((f, i) =>
          setTimeout(() => this.tone(ctx, f, 0.18, 'triangle', 0.25), i * 120)
        );
        break;
      case 'ui':
        this.tone(ctx, 600, 0.05, 'sine', 0.12);
        break;
      case 'heal':
        this.tone(ctx, 400, 0.5, 'sine', 0.15, 800);
        break;
    }
  }
}
