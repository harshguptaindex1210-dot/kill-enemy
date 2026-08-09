import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('daylight environment', () => {
  it('lazy-loads outdoor IBL for medium and high quality', () => {
    const scene = readFileSync(resolve(__dirname, '../src/scene.ts'), 'utf8');
    expect(scene).toMatch(/import\('\.\/environment'\)/);
    expect(scene).toMatch(/disposeEnvironment/);
    const env = readFileSync(resolve(__dirname, '../src/environment.ts'), 'utf8');
    expect(env).toMatch(/attachDaylightEnvironment/);
    expect(env).toMatch(/scene\.environment/);
  });
});
