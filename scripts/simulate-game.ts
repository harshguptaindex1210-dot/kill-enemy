/**
 * Headless game simulation that exercises the full BR loop through MatchSim.
 * Run: node scripts/simulate-game.js
 */
import { MatchSim } from '../src/gameplay';
import { summarizeMatch } from '../src/game';
import { defaultStats, recordMatch } from '../src/persistence';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

console.log('=== FULL BR SIMULATION ===\n');

const sim = new MatchSim({ seed: 777, botCount: 9, humanId: 'player', time: 0 });
assert(sim.units.size === 10, 'spawns 10 units (1 human + 9 bots)');
assert(sim.match.phase === 'lobby', 'starts in lobby');
assert(sim.loot.length > 0, 'loot spawns at POIs');
assert(sim.vehicles.length > 0, 'vehicles spawn');

sim.startMatch();
assert(sim.match.phase === 'countdown', 'startMatch begins countdown');

const dt = 1 / 20;
const maxSteps = (25 * 60 + 10) / dt;
let steps = 0;
let sawPlaying = false;
let sawKill = false;
while (sim.match.phase !== 'ended' && sim.match.phase !== 'results' && steps < maxSteps) {
  sim.update(dt);
  if (sim.match.phase === 'playing') sawPlaying = true;
  if (sim.match.lastKill) sawKill = true;
  steps++;
}
assert(sawPlaying, 'match reaches playing phase');
assert(sim.match.phase === 'ended' || sim.match.phase === 'results', 'match ends');
assert(sim.match.winnerId !== null, 'a winner emerges');
assert(sawKill, 'kills occurred during the match');
// Matches may end by 25-min timeout (INV-5 maxDuration) with multiple survivors;
// endMatch then resolves a winner by kills/damage tiebreak.
assert(sim.match.aliveCount >= 1, `alive count >= 1 (got ${sim.match.aliveCount})`);

const summary = summarizeMatch(sim);
assert(summary.placement >= 1, 'placement recorded');
const stats = recordMatch(
  defaultStats(),
  summary.won,
  summary.kills,
  summary.damage,
  summary.xpGained
);
assert(stats.matches === 1, 'match recorded in stats');
assert(summary.xpGained > 0, 'XP awarded');

console.log(`\n=== SIMULATION COMPLETE ===`);
console.log(`Steps: ${steps}, duration: ${(steps * dt).toFixed(0)}s simulated`);
console.log(`Winner: ${sim.match.winnerId}, alive: ${sim.match.aliveCount}`);
console.log(
  `Player: ${summary.placement}${summary.placement === 1 ? 'st' : summary.placement === 2 ? 'nd' : summary.placement === 3 ? 'rd' : 'th'} place, ${summary.kills} kills, ${summary.damage} dmg, +${summary.xpGained} XP`
);
console.log(`Zone phase: ${sim.zone.currentPhase + 1}/${sim.zone.phases.length}`);
console.log(
  `Loot: ${sim.loot.length} pads, ${sim.loot.filter((l) => l.collected).length} collected`
);
console.log(`Airdrops: ${sim.airdrops.airdrops.length}`);
console.log(`Stats: ${stats.wins} win, ${stats.kills} kills, level ${stats.level}, ${stats.xp} XP`);
