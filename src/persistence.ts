export interface PlayerStats {
  wins: number;
  kills: number;
  matches: number;
  xp: number;
  level: number;
  damage: number;
}

export interface StoredData {
  playerStats: PlayerStats;
  inventory: Record<string, number>;
}

const STORAGE_COLLECTION = 'player_data';
export const MAX_PLAYER_LEVEL = 100;

export function defaultStats(): PlayerStats {
  return { wins: 0, kills: 0, matches: 0, xp: 0, level: 1, damage: 0 };
}

export function addXP(stats: PlayerStats, amount: number): PlayerStats {
  stats.xp += amount;
  stats.level = Math.floor(stats.xp / 1000) + 1;
  return stats;
}

export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return (safeLevel - 1) * 1000;
}

export function ensureMaxLevelStats(stats: PlayerStats): PlayerStats {
  const maxXp = xpForLevel(MAX_PLAYER_LEVEL);
  if (stats.level >= MAX_PLAYER_LEVEL && stats.xp >= maxXp) return stats;
  return {
    ...stats,
    level: MAX_PLAYER_LEVEL,
    xp: Math.max(stats.xp, maxXp),
  };
}

export function recordMatch(
  stats: PlayerStats,
  won: boolean,
  kills: number,
  damage: number,
  xpGained: number
): PlayerStats {
  stats.matches++;
  if (won) stats.wins++;
  stats.kills += kills;
  stats.damage += damage;
  return addXP(stats, xpGained);
}

export function createWriteId(): string {
  return `write_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createStorageKey(userId: string): string {
  return `${STORAGE_COLLECTION}_${userId}`;
}

/** Dedupes match accounting by write id so a retried (INV-6) write never double-counts. */
const appliedWriteIds = new Set<string>();

export function recordMatchOnce(
  stats: PlayerStats,
  writeId: string,
  won: boolean,
  kills: number,
  damage: number,
  xpGained: number
): { stats: PlayerStats; applied: boolean } {
  if (appliedWriteIds.has(writeId)) return { stats, applied: false };
  appliedWriteIds.add(writeId);
  return { stats: recordMatch(stats, won, kills, damage, xpGained), applied: true };
}
