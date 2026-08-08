import * as THREE from 'three';

export type GroundKind = 'dirt' | 'asphalt' | 'sand';

export interface GroundSurface {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function canvasTex(c: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

function paintDirtColor(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#4a5c38';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 2; i++) {
    const v = 34 + Math.random() * 58;
    g.fillStyle = `rgba(${v | 0},${(v * 0.94) | 0},${(v * 0.5) | 0},0.14)`;
    const s = 2 + ((Math.random() * 3) | 0);
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, s, s);
  }
  for (let i = 0; i < n / 7; i++) {
    const v = 52 + Math.random() * 36;
    g.fillStyle = `rgba(${v | 0},${(v * 1.02) | 0},${(v * 0.55) | 0},0.12)`;
    g.beginPath();
    g.arc((Math.random() * n) | 0, (Math.random() * n) | 0, 6 + Math.random() * 12, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < n / 5; i++) {
    g.fillStyle = 'rgba(72,98,48,0.18)';
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 10 + ((Math.random() * 14) | 0), 6);
  }
}

function paintDirtRough(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#808080';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 3; i++) {
    const v = 110 + Math.random() * 90;
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.22)`;
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 2, 2);
  }
}

function paintAsphaltColor(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#3a3c42';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n; i++) {
    const v = 48 + Math.random() * 28;
    g.fillStyle = `rgba(${v | 0},${v | 0},${(v + 4) | 0},0.14)`;
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 3, 3);
  }
  g.strokeStyle = 'rgba(220,190,80,0.4)';
  g.lineWidth = Math.max(2, n / 64);
  g.beginPath();
  g.moveTo(0, n / 2);
  g.lineTo(n, n / 2);
  g.stroke();
  for (let i = 0; i < n / 12; i++) {
    g.strokeStyle = 'rgba(28,28,32,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    const x = (Math.random() * n) | 0;
    g.moveTo(x, 0);
    g.lineTo(x + ((Math.random() * 30) | 0) - 15, n);
    g.stroke();
  }
}

function paintAsphaltRough(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#707070';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 2; i++) {
    const v = 90 + Math.random() * 100;
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.25)`;
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 4, 1);
  }
}

function paintSandColor(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#c8a870';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 1.5; i++) {
    const v = 160 + Math.random() * 50;
    g.fillStyle = `rgba(${v | 0},${(v * 0.82) | 0},${(v * 0.48) | 0},0.16)`;
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 2, 2);
  }
  for (let y = 0; y < n; y += 6) {
    g.strokeStyle = 'rgba(140,110,70,0.12)';
    g.beginPath();
    g.moveTo(0, y + Math.sin(y * 0.2) * 3);
    for (let x = 0; x < n; x += 8) g.lineTo(x, y + Math.sin((x + y) * 0.15) * 4);
    g.stroke();
  }
}

function paintSandRough(g: CanvasRenderingContext2D, n: number) {
  g.fillStyle = '#a0a0a0';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 2; i++) {
    const v = 100 + Math.random() * 80;
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.2)`;
    g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, 3, 1);
  }
}

function buildSurface(
  repeat: number,
  size: number,
  colorFn: (g: CanvasRenderingContext2D, n: number) => void,
  roughFn: (g: CanvasRenderingContext2D, n: number) => void
): GroundSurface {
  const colorC = document.createElement('canvas');
  colorC.width = colorC.height = size;
  colorFn(colorC.getContext('2d')!, size);
  const roughC = document.createElement('canvas');
  roughC.width = roughC.height = size;
  roughFn(roughC.getContext('2d')!, size);
  return { map: canvasTex(colorC, repeat), roughnessMap: canvasTex(roughC, repeat) };
}

export function groundSurfaceFor(
  kind: GroundKind,
  repeat: number,
  size: 128 | 256 = 256
): GroundSurface {
  if (kind === 'asphalt') return buildSurface(repeat, size, paintAsphaltColor, paintAsphaltRough);
  if (kind === 'sand') return buildSurface(repeat, size, paintSandColor, paintSandRough);
  return buildSurface(repeat, size, paintDirtColor, paintDirtRough);
}

/** Legacy single-map helper for tests and lobby. */
export function groundTextureFor(kind: GroundKind, repeat: number): THREE.CanvasTexture {
  return groundSurfaceFor(kind, repeat, 128).map;
}
