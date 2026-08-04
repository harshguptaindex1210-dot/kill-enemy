import { describe, it, expect } from 'vitest';
import { MatchSim } from '../src/gameplay';
import { summarizeMatch, computeInteractionPrompt } from '../src/game';

function makeSim(botCount = 2): MatchSim {
  return new MatchSim({ seed: 12345, botCount, time: 0 });
}

describe('summarizeMatch', () => {
  it('reports a win with kills, damage, placement and XP', () => {
    const sim = makeSim(1);
    sim.applyDamage('player', 'bot_1', 40, 'shot');
    sim.applyDamage('player', 'bot_1', 60, 'shot');
    const summary = summarizeMatch(sim);
    expect(summary.won).toBe(true);
    expect(summary.kills).toBe(1);
    expect(summary.damage).toBe(100);
    expect(summary.placement).toBe(1);
    expect(summary.xpGained).toBe(45);
  });

  it('falls back to alive count when the player has no placement', () => {
    const sim = makeSim(2);
    sim.applyDamage('player', 'bot_1', 100, 'shot');
    const summary = summarizeMatch(sim);
    expect(summary.won).toBe(false);
    expect(summary.placement).toBe(sim.match.aliveCount);
  });
});

describe('computeInteractionPrompt', () => {
  it('prompts for loot pickup', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    const spawn = sim.loot[0];
    spawn.collected = false;
    spawn.position.copy(player.player.position);
    expect(computeInteractionPrompt(sim, 'player')).toBe('Press E to pick up');
  });

  it('prompts for vehicle entry', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    const v = sim.vehicles[0];
    v.state.occupied = false;
    v.state.position.copy(player.player.position);
    expect(computeInteractionPrompt(sim, 'player')).toBe('Press E to enter vehicle');
  });

  it('prompts for healing when low with a medkit', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    player.health = 50;
    player.heals.medkit = 1;
    expect(computeInteractionPrompt(sim, 'player')).toBe('Press H to heal (medkit)');
  });

  it('returns empty when nothing is nearby', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    player.health = 100;
    player.heals.medkit = 0;
    expect(computeInteractionPrompt(sim, 'player')).toBe('');
  });
});
