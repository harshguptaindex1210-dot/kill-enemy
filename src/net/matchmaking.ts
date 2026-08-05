/** Pure helpers for online matchmaking + bot fill (#40). */

export const MATCH_CAP = 10;
/** Solo queue allowed: one human + bots fills the lobby. */
export const MATCHMAKER_MIN = 1;
export const MATCHMAKER_MAX = MATCH_CAP;
export const MATCHMAKER_QUERY = '*';

/**
 * How many server-side bots to spawn so the lobby reaches `cap`.
 * Humans already matched/joining are subtracted; result is clamped ≥ 0.
 */
export function botFillCount(humanCount: number, cap = MATCH_CAP): number {
  const humans = Math.max(0, Math.min(cap, Math.floor(humanCount)));
  return Math.max(0, cap - humans);
}

/** Match label format returned by match_init (mode is local|online). */
export function matchLabel(mode: 'local' | 'online'): string {
  return `battle-royale|${mode}`;
}

export function parseMatchLabel(label: string): { mode: 'local' | 'online' } {
  const mode = label.includes('|online') ? 'online' : 'local';
  return { mode };
}
