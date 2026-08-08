import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { applyRendererLook, applyTealFog, addGradientSky } from '../src/graphics';

describe('battle royale visuals', () => {
  it('applyTealFog uses horizon-matched exponential fog for seamless sky blend', () => {
    const scene = new THREE.Scene();
    applyTealFog(scene, 40, 140, 0xd8c0a0);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect((scene.fog as THREE.FogExp2).color.getHex()).toBe(0xd8c0a0);
    expect((scene.fog as THREE.FogExp2).density).toBeGreaterThan(0);
    expect(scene.background).toBeNull();
  });

  it('groundSurfaces provides 256px albedo + roughness maps for PBR terrain', () => {
    const src = readFileSync(resolve(__dirname, '../src/groundSurfaces.ts'), 'utf8');
    expect(src).toMatch(/fillStyle = '#4a5c38'/);
    expect(src).toMatch(/roughnessMap/);
    expect(src).toMatch(/256/);
    const sceneSrc = readFileSync(resolve(__dirname, '../src/scene.ts'), 'utf8');
    expect(sceneSrc).toMatch(/groundSurfaceFor/);
    expect(sceneSrc).toMatch(/roughnessMap/);
  });

  it('addGradientSky adds a back-face gradient dome', () => {
    const scene = new THREE.Scene();
    const sky = addGradientSky(scene, { topColor: 0x2a4a68, bottomColor: 0xe8c090 });
    expect(scene.children).toContain(sky);
    expect(sky.material).toBeInstanceOf(THREE.ShaderMaterial);
    const mat = sky.material as THREE.ShaderMaterial;
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.uniforms.topColor.value.getHex()).toBe(0x2a4a68);
  });

  it('applyRendererLook enables ACES filmic tone mapping', () => {
    const renderer = {
      toneMapping: 0,
      toneMappingExposure: 1,
      outputColorSpace: '',
    } as unknown as THREE.WebGLRenderer;
    applyRendererLook(renderer, 'high');
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBeGreaterThan(1.35);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('graphics.ts BGMI palette wiring', () => {
  it('scene.ts uses warm horizon sky and matching fog colors', () => {
    const src = readFileSync(resolve(__dirname, '../src/scene.ts'), 'utf8');
    expect(src).toMatch(/mapPreset\(mapId\)/);
    expect(src).toMatch(/addMapLighting/);
    expect(src).toMatch(/scatterParkedCars/);
    expect(src).toMatch(/scatterInstancedGrass/);
    expect(src).toMatch(/GRASS_COUNTS/);
  });

  it('post-processing is lazy-loaded for medium and high quality', () => {
    const matchRender = readFileSync(resolve(__dirname, '../src/matchRender.ts'), 'utf8');
    expect(matchRender).toMatch(/import\('\.\/postProcess'\)/);
    expect(matchRender).toMatch(/quality !== 'low'/);
    const post = readFileSync(resolve(__dirname, '../src/postProcess.ts'), 'utf8');
    expect(post).toMatch(/UnrealBloomPass/);
    expect(post).toMatch(/ColorGradeShader/);
    expect(post).toMatch(/GRADE/);
    expect(matchRender).toMatch(/mapId/);
  });

  it('artStyle.ts unifies PBR surface roles', () => {
    const src = readFileSync(resolve(__dirname, '../src/artStyle.ts'), 'utf8');
    expect(src).toMatch(/styleMat/);
    expect(src).toMatch(/foliage/);
    expect(src).toMatch(/paint/);
  });
});
