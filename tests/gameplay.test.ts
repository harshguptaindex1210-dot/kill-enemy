import { describe, it, expect } from 'vitest';
import { MatchSim } from '../src/gameplay';

function makeSim(botCount = 3, seed = 12345): MatchSim {
  return new MatchSim({ seed, botCount, time: 0 });
}

function runFor(sim: MatchSim, seconds: number, input?: Parameters<MatchSim['update']>[1]) {
  const steps = Math.ceil(seconds / (1 / 20));
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 20, input);
  }
}

describe('MatchSim', () => {
  it('spawns units and starts in lobby', () => {
    const sim = makeSim(3);
    expect(sim.units.size).toBe(4);
    expect(sim.match.phase).toBe('lobby');
    expect(sim.match.aliveCount).toBe(4);
    expect(sim.loot.length).toBeGreaterThan(0);
  });

  it('progresses through countdown and drop to playing', () => {
    const sim = makeSim(2);
    sim.startMatch();
    expect(sim.match.phase).toBe('countdown');
    runFor(sim, 6);
    expect(sim.match.phase).toBe('dropping');
    runFor(sim, 4);
    expect(sim.match.phase).toBe('playing');
  });

  it('does not advance phases before startMatch', () => {
    const sim = makeSim(2);
    runFor(sim, 20);
    expect(sim.match.phase).toBe('lobby');
  });

  it('applies direct damage and kills bots', () => {
    const sim = makeSim(3);
    const killed = sim.applyDamage('player', 'bot_1', 100, 'shot');
    expect(killed).toBe(true);
    expect(sim.units.get('bot_1')!.alive).toBe(false);
    expect(sim.match.aliveCount).toBe(3);
    expect(sim.match.players.player.kills).toBe(1);
  });

  it('armor absorbs before health', () => {
    const sim = makeSim(1);
    const bot = sim.units.get('bot_1')!;
    bot.armor = 50;
    sim.applyDamage('player', 'bot_1', 30, 'shot');
    expect(bot.armor).toBe(20);
    expect(bot.health).toBe(100);
  });

  it('permadeath: killed bots stay dead', () => {
    const sim = makeSim(1);
    sim.applyDamage('player', 'bot_1', 100, 'shot');
    runFor(sim, 30);
    expect(sim.units.get('bot_1')!.alive).toBe(false);
  });

  it('zone damage reduces health outside the ring', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const unit = sim.units.get('player')!;
    unit.player.position.set(500, 0.9, 500);
    runFor(sim, 2);
    expect(unit.health).toBeLessThan(100);
  });

  it('zone damage skips players inside the ring', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const unit = sim.units.get('player')!;
    unit.player.position.set(0, 0.9, 0);
    runFor(sim, 2);
    expect(unit.health).toBe(100);
  });

  it('pickup collects loot and respawns it later', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const spawn = sim.loot[0];
    spawn.collected = false;
    spawn.position.copy(player.player.position);
    const ok = sim.contextAction('player');
    expect(ok).toBe(true);
    expect(spawn.collected).toBe(true);
    runFor(sim, 31);
    expect(spawn.collected).toBe(false);
  });

  it('healing restores health after duration', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.health = 50;
    sim.useHealing('player', 'bandage');
    expect(player.health).toBe(50);
    runFor(sim, 3);
    expect(player.health).toBe(65);
  });

  it('damage interrupts healing', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.health = 50;
    sim.useHealing('player', 'medkit');
    sim.applyDamage('bot_1', 'player', 5, 'shot');
    expect(player.healing).toBeNull();
    runFor(sim, 5);
    expect(player.health).toBe(45);
  });

  it('grenade throw spawns projectile and explodes', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.player.position.set(0, 0.9, 0);
    const thrown = sim.throwGrenadeFor('player');
    expect(thrown).toBe(true);
    expect(sim.grenades.projectiles.length).toBe(1);
    const explosionSeen = () => sim.grenades.explosions.length > 0;
    runFor(sim, 4);
    expect(explosionSeen()).toBe(true);
  });

  it('grenade cooldown prevents instant double-throw', () => {
    const sim = makeSim(1);
    sim.throwGrenadeFor('player');
    expect(sim.throwGrenadeFor('player')).toBe(false);
  });

  it('enter and exit vehicle', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    const v = sim.vehicles[0];
    v.state.position.copy(player.player.position);
    v.state.occupied = false;
    expect(sim.enterVehicle('player')).toBe(true);
    expect(player.inVehicleId).toBe(v.id);
    expect(v.state.occupied).toBe(true);
    runFor(sim, 2);
    expect(v.state.position.distanceTo(player.player.position)).toBeLessThan(0.01);
    expect(sim.exitVehicle('player')).toBe(true);
    expect(player.inVehicleId).toBeNull();
  });

  it('emits kill and hit events', () => {
    const sim = makeSim(1);
    sim.applyDamage('player', 'bot_1', 40, 'shot');
    sim.applyDamage('player', 'bot_1', 60, 'shot');
    const hits = sim.events.filter((e) => e.type === 'hit');
    const kills = sim.events.filter((e) => e.type === 'kill');
    expect(hits.length).toBe(2);
    expect(kills.length).toBe(1);
    expect(kills[0].cause).toBe('shot');
  });

  it('bots fight each other and a winner eventually emerges', () => {
    const sim = makeSim(9, 777);
    sim.startMatch();
    sim.match.maxDuration = 60 * 1000;
    for (let i = 0; i < 1200; i++) {
      sim.update(1 / 20);
      if (sim.match.phase === 'ended') break;
    }
    expect(sim.match.phase).toBe('ended');
    expect(sim.match.winnerId).toBeDefined();
  });

  it('force-ends by max duration even with multiple alive', () => {
    const sim = makeSim(2, 1);
    sim.startMatch();
    sim.match.maxDuration = 1000;
    runFor(sim, 10);
    expect(sim.match.phase).toBe('ended');
  });

  it('units stay within the map boundary', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.player.position.set(5000, 0.9, 5000);
    runFor(sim, 0.5);
    expect(Math.abs(player.player.position.x)).toBeLessThanOrEqual(480);
    expect(Math.abs(player.player.position.z)).toBeLessThanOrEqual(480);
  });
});
