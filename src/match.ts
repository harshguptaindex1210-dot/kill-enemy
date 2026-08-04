export type MatchPhase =
  'lobby' | 'countdown' | 'dropping' | 'playing' | 'dead' | 'spectate' | 'ended' | 'results';

export type KillCause = 'shot' | 'melee' | 'grenade' | 'zone' | 'vehicle' | 'fall';

export interface MatchPlayer {
  alive: boolean;
  kills: number;
  damage: number;
  placement: number;
}

export interface KillEvent {
  killerId: string | null;
  victimId: string;
  cause: KillCause;
  time: number;
}

export interface MatchState {
  phase: MatchPhase;
  players: Record<string, MatchPlayer>;
  aliveCount: number;
  startTime: number;
  phaseStart: number;
  countdownDuration: number;
  dropDuration: number;
  maxDuration: number;
  winnerId: string | null;
  lastKill: KillEvent | null;
}

const DEFAULT_COUNTDOWN_MS = 5000;
const DEFAULT_DROP_MS = 3000;
const DEFAULT_MAX_DURATION_MS = 25 * 60 * 1000;

export function createMatch(playerIds: string[]): MatchState {
  const players: Record<string, MatchPlayer> = {};
  for (const id of playerIds) {
    players[id] = { alive: true, kills: 0, damage: 0, placement: 0 };
  }
  return {
    phase: 'lobby',
    players,
    aliveCount: playerIds.length,
    startTime: 0,
    phaseStart: 0,
    countdownDuration: DEFAULT_COUNTDOWN_MS,
    dropDuration: DEFAULT_DROP_MS,
    maxDuration: DEFAULT_MAX_DURATION_MS,
    winnerId: null,
    lastKill: null,
  };
}

export function setPhase(match: MatchState, phase: MatchPhase, now: number) {
  match.phase = phase;
  match.phaseStart = now;
}

export function startCountdown(match: MatchState, now: number = Date.now()) {
  match.startTime = now;
  setPhase(match, 'countdown', now);
}

export function startDrop(match: MatchState) {
  match.phase = 'dropping';
}

export function startPlay(match: MatchState) {
  match.phase = 'playing';
}

export function toResults(match: MatchState) {
  match.phase = 'results';
}

/**
 * Advances timer-driven transitions. Call every frame with elapsed real ms.
 * countdown -> dropping -> playing; enforces maxDuration (INV-5).
 */
export function tickMatch(match: MatchState, dtMs: number, now: number = Date.now()) {
  void dtMs;
  if (match.phase === 'countdown' && now - match.phaseStart >= match.countdownDuration) {
    setPhase(match, 'dropping', now);
  }
  if (match.phase === 'dropping' && now - match.phaseStart >= match.dropDuration) {
    setPhase(match, 'playing', now);
  }
  if (match.phase === 'playing' && now - match.startTime >= match.maxDuration) {
    forceEnd(match);
  }
}

export function registerDamage(match: MatchState, playerId: string, amount: number) {
  const p = match.players[playerId];
  if (p && p.alive) p.damage += amount;
}

export function killPlayer(
  match: MatchState,
  victimId: string,
  killerId: string | null,
  cause: KillCause = 'shot'
) {
  if (!match.players[victimId]?.alive) return;
  match.players[victimId].alive = false;
  match.players[victimId].placement = match.aliveCount;
  match.aliveCount--;
  if (killerId && match.players[killerId]) {
    match.players[killerId].kills++;
  }
  match.lastKill = { killerId, victimId, cause, time: Date.now() };
  if (match.aliveCount <= 1) {
    endMatch(match);
  }
}

export function endMatch(match: MatchState) {
  match.phase = 'ended';
  const alive = Object.entries(match.players)
    .filter(([, p]) => p.alive)
    .map(([id]) => id);
  if (alive.length === 1) {
    match.players[alive[0]].placement = 1;
    match.winnerId = alive[0];
  } else if (alive.length > 1) {
    alive.sort(
      (a, b) =>
        match.players[b].kills - match.players[a].kills ||
        match.players[b].damage - match.players[a].damage
    );
    for (const id of alive) match.players[id].placement = 1;
    match.winnerId = alive[0];
  } else {
    const killer = match.lastKill?.killerId;
    if (killer && match.players[killer]) {
      match.players[killer].placement = 1;
      match.winnerId = killer;
    }
  }
}

function forceEnd(match: MatchState) {
  endMatch(match);
}

export function calculateXP(match: MatchState, playerId: string): number {
  const p = match.players[playerId];
  if (!p) return 0;
  const placementXP = Math.max(10, (match.aliveCount - p.placement + 1) * 10);
  const killXP = p.kills * 25;
  const damageXP = Math.round(p.damage / 10);
  return placementXP + killXP + damageXP;
}
