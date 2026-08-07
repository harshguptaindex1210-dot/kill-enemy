import * as THREE from 'three';
import type { QualityPreset } from './scene';
import { applyRendererLook } from './graphics';
import { isMobileDevice } from './platform';

export interface RendererOptions {
  quality?: QualityPreset;
  mobile?: boolean;
}

function rendererPixelRatio(quality: QualityPreset, mobile: boolean): number {
  if (quality === 'low') return 1;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  if (mobile) return Math.min(dpr, quality === 'high' ? 1.6 : 1.35);
  return Math.min(dpr, quality === 'high' ? 2.25 : 2);
}

function createWebGLRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const attempts: THREE.WebGLRendererParameters[] = [
    {
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    },
    {
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    },
    {
      canvas,
      antialias: false,
      alpha: true,
      failIfMajorPerformanceCaveat: false,
    },
  ];

  let lastError: unknown;
  for (const params of attempts) {
    try {
      const renderer = new THREE.WebGLRenderer(params);
      const ctx =
        typeof renderer.getContext === 'function' ? renderer.getContext() : renderer.domElement;
      if (ctx) return renderer;
      renderer.dispose();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('WebGL unavailable');
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  quality: QualityPreset = 'medium',
  options: RendererOptions = {}
): THREE.WebGLRenderer {
  const mobile = options.mobile ?? isMobileDevice();
  const effectiveQuality: QualityPreset = mobile && quality === 'high' ? 'medium' : quality;
  const pixelRatio = rendererPixelRatio(effectiveQuality, mobile);

  const renderer = createWebGLRenderer(canvas);
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = effectiveQuality !== 'low' && !mobile;

  if (effectiveQuality !== 'low' && !mobile) {
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  applyRendererLook(renderer, effectiveQuality);

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
    },
    false
  );

  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(pixelRatio);
    },
    false
  );

  return renderer;
}
