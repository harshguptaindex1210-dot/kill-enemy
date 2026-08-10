import { describe, it, expect } from 'vitest';
import { MatchClient } from '../src/net/client';
import { touchDragToLookDelta } from '../src/touchLook';
import { START_MEDKITS } from '../src/constants';

describe('demo online client fire path', () => {
  it('delivers fire input to LocalServer and damages bots', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();

    const flush = (client as unknown as { flushInputs: () => void }).flushInputs;

    for (let i = 0; i < 200 && client.localServer!.sim.match.phase !== 'playing'; i++) {
      client.localServer!.step();
    }
    expect(client.localServer!.sim.match.phase).toBe('playing');

    const player = client.localServer!.sim.units.get('player')!;
    const bot = client.localServer!.sim.units.get('bot_1')!;
    const px = player.player.position.x;
    const pz = player.player.position.z;
    bot.player.position.set(px, 0.9, pz - 12);
    const yaw = Math.atan2(-(bot.player.position.x - px), -(bot.player.position.z - pz));
    player.player.setFacing(yaw, 0);
    const before = bot.health;

    for (let i = 0; i < 40; i++) {
      client.sendInput({ seq: 0, fire: true, mouseX: 0, mouseY: 0 });
      flush.call(client);
      client.localServer!.step();
    }
    expect(bot.health).toBeLessThan(before);

    client.dispose();
  });

  it('preserves tap-fire across merged input batches', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();
    const flush = (client as unknown as { flushInputs: () => void }).flushInputs;

    for (let i = 0; i < 200 && client.localServer!.sim.match.phase !== 'playing'; i++) {
      client.localServer!.step();
    }

    const player = client.localServer!.sim.units.get('player')!;
    const bot = client.localServer!.sim.units.get('bot_1')!;
    const px = player.player.position.x;
    const pz = player.player.position.z;
    bot.player.position.set(px, 0.9, pz - 12);
    const yaw = Math.atan2(-(bot.player.position.x - px), -(bot.player.position.z - pz));
    player.player.setFacing(yaw, 0);
    const before = bot.health;

    client.sendInput({ seq: 0, fire: true });
    client.sendInput({ seq: 0, fire: false });
    flush.call(client);
    for (let i = 0; i < 20; i++) client.localServer!.step();

    expect(bot.health).toBeLessThan(before);
    client.dispose();
  });

  it('adopts spawn position from first snapshot', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();
    const spawnX = client.interp.latest!.entities.player.px / 100;
    const spawnZ = client.interp.latest!.entities.player.pz / 100;
    expect(client.rollback.localState.pos.x).toBeCloseTo(spawnX, 1);
    expect(client.rollback.localState.pos.z).toBeCloseTo(spawnZ, 1);
    expect(Math.hypot(spawnX, spawnZ)).toBeGreaterThan(20);
    client.dispose();
  });

  it('swipe-right look turns player toward +X on demo-online LocalServer path', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();
    const flush = (client as unknown as { flushInputs: () => void }).flushInputs;

    for (let i = 0; i < 200 && client.localServer!.sim.match.phase !== 'playing'; i++) {
      client.localServer!.step();
    }
    expect(client.localServer!.sim.match.phase).toBe('playing');

    const player = client.localServer!.sim.units.get('player')!;
    player.player.setFacing(0, 0);
    const look = touchDragToLookDelta(50, 0);
    expect(look.mouseX).toBeGreaterThan(0);

    client.sendInput({ seq: 0, mouseX: look.mouseX, mouseY: 0 });
    flush.call(client);
    client.localServer!.step();

    expect(player.player.yaw).toBeLessThan(0);
    expect(-Math.sin(player.player.yaw)).toBeGreaterThan(0);
    expect(client.rollback.yaw).toBeLessThan(0);
    client.dispose();
  });

  it('starts with 5 med-kits and heal input consumes one on demo-online', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();
    const flush = (client as unknown as { flushInputs: () => void }).flushInputs;

    for (let i = 0; i < 200 && client.localServer!.sim.match.phase !== 'playing'; i++) {
      client.localServer!.step();
    }

    const player = client.localServer!.sim.units.get('player')!;
    expect(player.heals.medkit).toBe(START_MEDKITS);
    player.health = 40;

    client.sendInput({ seq: 0, heal: true });
    flush.call(client);
    client.localServer!.step();

    expect(player.heals.medkit).toBe(START_MEDKITS - 1);
    expect(player.healing?.kind).toBe('medkit');
    client.dispose();
  });

  it('demo-local advances sim on tickLocal with jump input', async () => {
    const client = new MatchClient('local', { onSnapshot: () => {}, onDisconnect: () => {} });
    await client.connect();
    await client.startMatch();

    for (let i = 0; i < 700 && client.localServer!.sim.match.phase !== 'playing'; i++) {
      client.tickLocal(1 / 60);
    }
    expect(client.localServer!.sim.match.phase).toBe('playing');

    const player = client.localServer!.sim.units.get('player')!;
    const y0 = player.player.position.y;
    client.sendInput({ seq: 0, jump: true });
    client.tickLocal(1 / 60);
    expect(player.player.velocity.y).toBeGreaterThan(0);
    expect(player.player.position.y).toBeGreaterThan(y0);
    client.dispose();
  });
});
