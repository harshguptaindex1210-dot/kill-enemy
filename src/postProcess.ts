import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import type { QualityPreset } from './scene';

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    warmMix: { value: 0.14 },
    vignette: { value: 0.38 },
  },
  vertexShader: CopyShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float warmMix;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(1.04, 1.0, 0.92) + vec3(0.02, 0.01, 0.0), warmMix);
      col = col * (col * 1.06 + 0.03);
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
  quality: QualityPreset
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
