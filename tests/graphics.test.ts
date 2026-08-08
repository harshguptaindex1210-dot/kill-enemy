import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import {
  applyRendererLook,
  applyTealFog,
  addGradientSky,
} from '../src/graphics';

describe('battle royale visuals', () => {
  it('applyTealFog uses horizon-matched fog for seamless sky blend', () => {
    const scene = new THREE.Scene();
    applyTealFog(scene, 40, 140, 0xd8c0a0);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect((scene.fog as THREE.Fog).color.getHex()).toBe(0xd8c0a0);
    expect((scene.fog as THREE.Fog).near).toBe(40);
    expect(scene.background).toBeNull();
  });

  it('createDirtGroundTexture is exported for ground tiling', () => {
    const src = readFileSync(resolve(__dirname, '../src/graphics.ts'), 'utf8');
    expect(src).toMatch(/fillStyle = '#4a5c38'/);
    expect(src).toMatch(/c\.width = 128/);
    expect(src).not.toMatch(/GridHelper/);
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
    expect(renderer.toneMappingExposure).toBeGreaterThan(1.1);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('graphics.ts BGMI palette wiring', () => {
  it('scene.ts uses warm horizon sky and matching fog colors', () => {
    const src = readFileSync(resolve(__dirname, '../src/scene.ts'), 'utf8');
    expect(src).toMatch(/topColor:\s*0x2a4a68/);
    expect(src).toMatch(/bottomColor:\s*0xe8c090/);
    expect(src).toMatch(/applyTealFog\(scene,\s*MAP_BOUND \* 0\.52,\s*MAP_BOUND \* 1\.45,\s*0xd8c0a0\)/);
    expect(src).toMatch(/scatterInstancedGrass/);
    expect(src).toMatch(/GRASS_COUNTS/);
  });
});
