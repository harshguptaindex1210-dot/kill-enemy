import { describe, it, expect } from 'vitest';
import { MatchClient } from '../src/net/client';

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
});
