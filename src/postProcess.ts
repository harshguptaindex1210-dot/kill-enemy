import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import type { QualityPreset } from './scene';

import type { MapId } from './mapPresets';

const GRADE: Record<MapId, { warmMix: number; vignette: number; sat: number }> = {
  meadow: { warmMix: 0.1, vignette: 0.16, sat: 1.06 },
  city: { warmMix: 0.04, vignette: 0.12, sat: 1.02 },
  desert: { warmMix: 0.12, vignette: 0.18, sat: 1.08 },
};

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    warmMix: { value: 0.14 },
    vignette: { value: 0.38 },
    saturation: { value: 1.08 },
  },
  vertexShader: CopyShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float warmMix;
    uniform float vignette;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, saturation);
      col = mix(col, col * vec3(1.04, 1.0, 0.96) + vec3(0.02, 0.01, 0.0), warmMix);
      col = col * (col * 1.04 + 0.05);
      col = col * 1.08 + vec3(0.035);
      float grain = fract(sin(dot(vUv * 1400.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.022;
      float d = distance(vUv, vec2(0.5));
      col *= smoothstep(0.95, 0.42, d * (1.0 + vignette));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface PostPipeline {
  render(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export function createPostPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  quality: QualityPreset,
  mapId: MapId = 'meadow'
): PostPipeline {
  const size = new THREE.Vector2(renderer.domElement.width, renderer.domElement.height);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let bloom: UnrealBloomPass | null = null;
  if (quality === 'high') {
    bloom = new UnrealBloomPass(size, 0.24, 0.42, 0.9);
    composer.addPass(bloom);
  } else if (quality === 'medium') {
    bloom = new UnrealBloomPass(size, 0.15, 0.48, 0.94);
    composer.addPass(bloom);
  }

  const grade = new ShaderPass(ColorGradeShader);
  const profile = GRADE[mapId];
  grade.uniforms.warmMix.value = profile.warmMix;
  grade.uniforms.vignette.value = profile.vignette;
  grade.uniforms.saturation.value = profile.sat;
  grade.renderToScreen = true;
  composer.addPass(grade);

  return {
    render: () => composer.render(),
    setSize(width: number, height: number) {
      composer.setSize(width, height);
      bloom?.setSize(width, height);
    },
    dispose: () => {
      composer.dispose();
    },
  };
}
