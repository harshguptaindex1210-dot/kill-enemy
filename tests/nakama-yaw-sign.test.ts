import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('nakama yaw sign parity', () => {
  it('keeps authoritative yaw integration aligned with client sign', () => {
    const lua = readFileSync(
      resolve(__dirname, '..', 'nakama', 'modules', 'match_handler.lua'),
      'utf8'
    );

    expect(lua).toContain('p.yaw = wrap_angle(p.yaw - (input.mouseX or 0) * MOUSE_SENS)');
    expect(lua).toContain('input.mouseX = -(wrap_angle(target_yaw - p.yaw)) / 0.002');
    expect(lua).not.toContain('p.yaw = wrap_angle(p.yaw + (input.mouseX or 0) * MOUSE_SENS)');
  });
});
