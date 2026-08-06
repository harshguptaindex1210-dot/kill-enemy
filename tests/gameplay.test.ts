import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MatchSim } from '../src/gameplay';
import { createWeapon } from '../src/weapons';
import { throwGrenade } from '../src/grenades';
import { MAP_BOUND } from '../src/constants';

function makeSim(botCount = 3, seed = 12345): MatchSim {
  return new MatchSim({ seed, botCount, time: 0 });
}

function runFor(sim: MatchSim, seconds: number, input?: Parameters<MatchSim['update']>[1]) {
  const steps = Math.ceil(seconds / (1 / 20));
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 20, input);
  }
}

function fullInput(over: Partial<Parameters<MatchSim['update']>[1]> = {}) {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
    aim: false,
    fire: false,
    reload: false,
    weapon1: false,
    weapon2: false,
    weapon3: false,
    mouseX: 0,
    mouseY: 0,
    ...over,
  };
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
    // Armor drains at 50% of blocked damage → 50 - 15 = 35
    expect(bot.armor).toBe(35);
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
    const bot = sim.units.get('bot_1')!;
    bot.alive = false;
    unit.player.position.set(0, 0.9, 0);
    unit.health = 100;
    runFor(sim, 2);
    expect(unit.health).toBe(100);
  });

  it('pickup collects loot and respawns it later', () => {
    const sim = makeSim(0);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.player.position.set(0, 0.9, 0);
    const spawn = sim.loot[0];
    spawn.collected = false;
    spawn.position.set(0, 0.5, 0);
    const ok = sim.contextAction('player');
    expect(ok).toBe(true);
    expect(spawn.collected).toBe(true);
    runFor(sim, 31);
    expect(spawn.collected).toBe(false);
  });

  it('despawns loot inside the closing zone and never respawns it', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const spawn = sim.loot[0];
    spawn.collected = false;
    spawn.position.set(MAP_BOUND + 10, 0.5, MAP_BOUND + 10);
    runFor(sim, 1);
    expect(spawn.collected).toBe(true);
    sim.lootRespawns.push({ id: spawn.id, until: sim.time + 1000 });
    runFor(sim, 2);
    expect(spawn.collected).toBe(true);
  });

  it('pickup fills weapon slots in order, then full-slot replacement drops the old weapon', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    player.inventory.weapons = ['rifle', null];
    player.inventory.weaponIndex = 0;
    player.weapons = [createWeapon('rifle'), null];
    sim.loot.push({
      id: 1001,
      position: player.player.position.clone(),
      loot: { type: 'weapon', subtype: 'pistol', amount: 1 },
      collected: false,
    });
    expect(sim.contextAction('player')).toBe(true);
    expect(player.weapons[1]!.def.type).toBe('pistol');

    player.inventory.weaponIndex = 0;
    sim.loot.push({
      id: 1002,
      position: player.player.position.clone(),
      loot: { type: 'weapon', subtype: 'rifle', amount: 1 },
      collected: false,
    });
    const before = sim.loot.length;
    expect(sim.contextAction('player')).toBe(true);
    expect(player.weapons[0]!.def.type).toBe('rifle');
    expect(player.weapons[1]!.def.type).toBe('pistol');
    expect(sim.loot.length).toBe(before + 1);
    const dropped = sim.loot[sim.loot.length - 1];
    expect(dropped.loot.subtype).toBe('rifle');
    expect(dropped.position.distanceTo(player.player.position)).toBeLessThan(0.1);
  });

  it('ammo loot pools into inventory reserves', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    const before = player.inventory.ammo.rifle;
    sim.loot.push({
      id: 3001,
      position: player.player.position.clone(),
      loot: { type: 'ammo', subtype: 'rifle', amount: 30 },
      collected: false,
    });
    expect(sim.contextAction('player')).toBe(true);
    expect(player.inventory.ammo.rifle).toBe(before + 30);
  });

  it('armor loot caps at 100', () => {
    const sim = makeSim(1);
    const player = sim.units.get('player')!;
    player.armor = 90;
    sim.loot.push({
      id: 4001,
      position: player.player.position.clone(),
      loot: { type: 'armor', subtype: 'vest', amount: 50 },
      collected: false,
    });
    expect(sim.contextAction('player')).toBe(true);
    expect(player.armor).toBe(100);
  });

  it('healing is blocked at full health', () => {
    const sim = makeSim(1);
    sim.useHealing('player', 'medkit');
    expect(sim.units.get('player')!.healing).toBeNull();
  });

  it('healing restores health after duration', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const bot = sim.units.get('bot_1')!;
    player.player.position.set(0, 0.9, 0);
    bot.player.position.set(150, 0.9, 150);
    player.health = 50;
    sim.useHealing('player', 'bandage');
    expect(player.health).toBe(50);
    runFor(sim, 3, fullInput());
    expect(player.health).toBe(65);
  });

  it('damage interrupts healing', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const bot = sim.units.get('bot_1')!;
    player.health = 50;
    sim.useHealing('player', 'medkit');
    bot.isBot = false; // full damage, not BOT_DAMAGE_SCALE
    sim.applyDamage('bot_1', 'player', 5, 'shot');
    bot.alive = false; // stop further bot fire during wait
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
    expect(Math.abs(player.player.position.x)).toBeLessThanOrEqual(MAP_BOUND);
    expect(Math.abs(player.player.position.z)).toBeLessThanOrEqual(MAP_BOUND);
  });
});

describe('bot AI v2 (#29)', () => {
  it('bots pick up loot pads they run over', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const bot = sim.units.get('bot_1')!;
    const pad = sim.loot[0];
    pad.collected = false;
    pad.position.set(bot.player.position.x, 0.5, bot.player.position.z);
    runFor(sim, 0.05);
    expect(pad.collected).toBe(true);
  });

  it('bots have permadeath and get a placement', () => {
    const sim = makeSim(2);
    sim.applyDamage('player', 'bot_1', 1000, 'shot');
    expect(sim.units.get('bot_1')!.alive).toBe(false);
    expect(sim.match.players.bot_1.placement).toBe(3);
    expect(sim.match.aliveCount).toBe(2);
  });
});

describe('grenade gameplay (#26)', () => {
  it('grenade explosion damages the thrower (self-damage)', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.player.position.set(0, 0.9, 0);
    throwGrenade(
      sim.grenades,
      'player',
      new THREE.Vector3(0, 0.15, 0),
      new THREE.Vector3(0, 0, -1),
      0,
      0.1,
      0
    );
    runFor(sim, 1);
    expect(player.health).toBeLessThan(100);
  });

  it('grenade explosion knocks back units in radius', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const bot = sim.units.get('bot_1')!;
    bot.health = 1000;
    bot.isBot = false;
    bot.botBrain = null;
    bot.player.position.set(3, 0.9, 0);
    player.player.position.set(0, 0.9, 0);
    const origin = new THREE.Vector3(0, 0.15, 0);
    const botDistBefore = bot.player.position.distanceTo(origin);
    throwGrenade(sim.grenades, 'player', origin.clone(), new THREE.Vector3(0, 0, -1), 0, 0.1, 0);
    runFor(sim, 1);
    const botDistAfter = bot.player.position.distanceTo(origin);
    expect(botDistAfter).toBeGreaterThan(botDistBefore);
  });
});

describe('hitscan combat', () => {
  it('player rifle fire damages a bot ahead even far from world origin', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const bot = sim.units.get('bot_1')!;
    bot.isBot = false;
    bot.botBrain = null;
    bot.health = 100;
    bot.armor = 0;
    // yaw=0 aims -Z; place both far from (0,0) so a broken origin misses
    player.player.position.set(120, 0.9, 120);
    bot.player.position.set(120, 0.9, 108);
    const before = bot.health;
    runFor(sim, 1.0, fullInput({ fire: true }));
    expect(bot.health).toBeLessThan(before);
  });

  it('bot shot damage applies (scaled) to the human player', () => {
    const sim = makeSim(1, 99);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    player.health = 100;
    player.armor = 0;
    const before = player.health;
    sim.applyDamage('bot_1', 'player', 20, 'shot');
    expect(player.health).toBeLessThan(before);
    expect(player.health).toBeGreaterThan(before - 20); // BOT_DAMAGE_SCALE < 1
  });
});

describe('melee gameplay (#27)', () => {
  it('melee swing hits a nearby bot and deals melee damage', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const bot = sim.units.get('bot_1')!;
    bot.isBot = false;
    bot.health = 100;
    bot.player.position.set(0, 0.9, -1.2);
    player.player.position.set(0, 0.9, 0);
    player.meleeMode = true;
    runFor(sim, 0.6, fullInput({ fire: true }));
    expect(bot.health).toBeLessThan(100);
  });
});

describe('zone gameplay (#28)', () => {
  it('zone kills attribute death to the zone', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    sim.applyDamage('zone', 'bot_1', 1000, 'zone');
    expect(sim.units.get('bot_1')!.alive).toBe(false);
    expect(sim.match.lastKill?.cause).toBe('zone');
    expect(sim.match.lastKill?.killerId).toBe('zone');
  });

  it('zone alone can end a match', () => {
    const sim = makeSim(3);
    sim.startMatch();
    runFor(sim, 9);
    for (const [id] of sim.units) {
      if (id !== 'player') sim.applyDamage('zone', id, 1000, 'zone');
    }
    expect(sim.match.phase).toBe('ended');
    expect(sim.match.winnerId).toBe('player');
  });

  it('emits zone-incoming before a shrink', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    sim.zone.phaseTime = sim.zone.phases[0].duration - 4;
    sim.update(1 / 20);
    expect(sim.events.some((e) => e.type === 'zone-incoming')).toBe(true);
  });
});

describe('local respawn', () => {
  it('revives a dead player at spawn with full health', () => {
    const sim = makeSim(2);
    sim.startMatch();
    runFor(sim, 9);
    const player = sim.units.get('player')!;
    const spawn = player.spawnPos.clone();
    sim.applyDamage('zone', 'player', 200, 'zone');
    expect(player.alive).toBe(false);
    expect(sim.match.players.player.alive).toBe(false);

    expect(sim.respawnUnit('player')).toBe(true);
    expect(player.alive).toBe(true);
    expect(player.health).toBe(100);
    expect(sim.match.players.player.alive).toBe(true);
    expect(player.player.position.distanceTo(spawn)).toBeLessThan(0.01);
  });

  it('does not respawn while still alive', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    expect(sim.respawnUnit('player')).toBe(false);
  });
});

describe('bot engage integration', () => {
  it('bot closes distance when player is nearby instead of fleeing', () => {
    const sim = makeSim(1);
    sim.startMatch();
    runFor(sim, 9);
    const bot = sim.units.get('bot_1')!;
    const player = sim.units.get('player')!;
    bot.player.position.set(0, 0.9, 0);
    player.player.position.set(0, 0.9, -12);
    const startDist = bot.player.position.distanceTo(player.player.position);
    runFor(sim, 2);
    const endDist = bot.player.position.distanceTo(player.player.position);
    expect(endDist).toBeLessThan(startDist);
  });
});
