import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { createRobotModel, transitionAnim, updateRobotAnim } from '../src/robot';

describe('robot model', () => {
  it('creates robot group with children', () => {
    const { group } = createRobotModel();
    expect(group.children.length).toBeGreaterThan(5);
  });

  it('has animation state with all actions', () => {
    const { anim } = createRobotModel();
    expect(anim.actions.idle).toBeDefined();
    expect(anim.actions.walk).toBeDefined();
    expect(anim.actions.run).toBeDefined();
    expect(anim.actions.jump).toBeDefined();
    expect(anim.actions.crouch).toBeDefined();
    expect(anim.actions.melee).toBeDefined();
  });

  it('starts in idle animation', () => {
    const { anim } = createRobotModel();
    expect(anim.current).toBe('idle');
  });

  it('transitions between animations', () => {
    const { anim } = createRobotModel();
    transitionAnim(anim, 'walk');
    expect(anim.current).toBe('walk');
    transitionAnim(anim, 'run');
    expect(anim.current).toBe('run');
  });

  it('transitions to melee swing animation', () => {
    const { anim } = createRobotModel();
    transitionAnim(anim, 'melee');
    expect(anim.current).toBe('melee');
  });

  it('ignores transition to same animation', () => {
    const { anim } = createRobotModel();
    transitionAnim(anim, 'idle');
    expect(anim.current).toBe('idle');
  });

  it('updates mixer on tick', () => {
    const { anim } = createRobotModel();
    expect(() => updateRobotAnim(anim, 0.016)).not.toThrow();
  });

  it('restores scale after jump and crouch', () => {
    const { group, anim } = createRobotModel();
    transitionAnim(anim, 'jump');
    updateRobotAnim(anim, 0.3);
    transitionAnim(anim, 'idle');
    expect(group.scale.y).toBeCloseTo(1);
    transitionAnim(anim, 'crouch');
    updateRobotAnim(anim, 0.2);
    transitionAnim(anim, 'walk');
    expect(group.scale.y).toBeCloseTo(1);
  });

  it('tints chassis from team color', () => {
    const { group } = createRobotModel(0xff0000);
    const torso = group.children[0];
    expect(torso).toBeInstanceOf(Mesh);
    const mat = (torso as Mesh).material as MeshStandardMaterial;
    expect(mat.color.r).toBeGreaterThan(mat.color.g);
    expect(mat.color.r).toBeGreaterThan(mat.color.b);
  });
});
