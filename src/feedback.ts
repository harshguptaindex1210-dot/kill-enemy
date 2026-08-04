export interface KillFeedEntry {
  id: number;
  killerId: string;
  victimId: string;
  cause: string;
  time: number;
}

let killFeedId = 1;

export function makeKillFeedEntry(
  killerId: string,
  victimId: string,
  cause: string,
  time: number
): KillFeedEntry {
  return { id: killFeedId++, killerId, victimId, cause, time };
}

export function formatCompassBearing(yaw: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((yaw + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatPlacement(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export function hitMarkerClass(wasHit: boolean, wasKill: boolean): 'hit' | 'kill' | 'none' {
  if (!wasHit) return 'none';
  return wasKill ? 'kill' : 'hit';
}

export function xpForPlacement(aliveAtStart: number, placement: number): number {
  return Math.max(0, (aliveAtStart - placement + 1) * 10);
}
