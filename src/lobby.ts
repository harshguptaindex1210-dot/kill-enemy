import type { Settings } from './settings';
import type { LeaderboardEntry, MatchRecord } from './net/leaderboard';

export interface LobbyCallbacks {
  onPlayLocal: () => void;
  onPlayOnline: () => void;
  onCancelQueue: () => void;
  onSettingsChange: (changes: Partial<Settings>) => void;
}

export interface LobbyActivity {
  history: MatchRecord[];
  leaderboard: LeaderboardEntry[];
}

/** Queue state shown on the main button while matchmaking is active. */
export interface QueueStatus {
  active: boolean;
  message: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

function placementLabel(placement: number): string {
  if (placement === 1) return '1st';
  if (placement === 2) return '2nd';
  if (placement === 3) return '3rd';
  return `${placement}th`;
}

export function showLobby(
  stats: { level: number; xp: number; wins: number; kills: number; matches: number },
  settings: Settings,
  callbacks: LobbyCallbacks,
  activity: LobbyActivity = { history: [], leaderboard: [] },
  queue: QueueStatus = { active: false, message: '' }
) {
  const existing = document.getElementById('lobby-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lobby-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:linear-gradient(135deg,#0a0a1a,#1a1a3a);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;font-family:sans-serif;color:#fff;';

  const select = (id: string, opts: [string, string][], cur: string) =>
    `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

  const row = (label: string, sel: string) =>
    `<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;">${label}${sel}</label>`;

  const historyMarkup =
    activity.history.length === 0
      ? '<span style="color:#889;">No matches played yet</span>'
      : activity.history
          .slice(0, 5)
          .map(
            (match) =>
              `<div style="display:flex;justify-content:space-between;gap:16px;"><span>${placementLabel(match.placement)} · ${match.kills} K</span><span style="color:${match.won ? '#4f4' : '#889'};">${match.won ? 'WIN' : 'LOSS'}</span></div>`
          )
          .join('');

  const leaderboardMarkup =
    activity.leaderboard.length === 0
      ? '<span style="color:#889;">Connect online to load rankings</span>'
      : activity.leaderboard
          .slice(0, 10)
          .map(
            (entry, index) =>
              `<div style="display:grid;grid-template-columns:24px minmax(80px,1fr) auto auto;gap:8px;"><span>${index + 1}</span><span>${escapeHtml(entry.username)}</span><span>${placementLabel(entry.placement)}</span><span>${entry.kills} K</span></div>`
          )
          .join('');

  overlay.innerHTML = `
    <h1 style="font-size:46px;margin:0 0 6px;letter-spacing:4px;text-transform:uppercase;color:#4af;">ROBOT ARENA</h1>
    <p style="color:#889;margin:0 0 26px;font-size:13px;">Battle Royale — Robot Apocalypse</p>
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:20px;">
      <button id="btn-online" style="padding:13px 42px;font-size:17px;background:#4af;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">${queue.active ? 'Searching for match...' : 'Play Online'}</button>
      ${queue.message && !queue.active ? `<p style="color:#fa0;font-size:12px;margin:0;">${escapeHtml(queue.message)}</p>` : ''}
      <div style="display:flex;gap:10px;align-items:center;">
        <button id="btn-local" style="padding:8px 20px;font-size:13px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Play Local</button>
        <button id="btn-cancel-queue" style="padding:8px 20px;font-size:13px;background:#a33;color:#fff;border:none;border-radius:4px;cursor:pointer;display:${queue.active ? 'inline-block' : 'none'};">Cancel</button>
      </div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">
      <div style="background:rgba(255,255,255,0.05);padding:10px 18px;border-radius:8px;font-size:13px;">
        <b style="color:#8af;display:block;text-align:center;font-size:11px;margin-bottom:6px;">PLAYER</b>
        <div style="display:grid;grid-template-columns:auto auto;gap:3px 16px;">
          <span style="color:#889;">Level</span><span>${stats.level}</span>
          <span style="color:#889;">XP</span><span>${stats.xp}</span>
          <span style="color:#889;">Wins</span><span style="color:#4f4;">${stats.wins}</span>
          <span style="color:#889;">Kills</span><span style="color:#f44;">${stats.kills}</span>
          <span style="color:#889;">Matches</span><span>${stats.matches}</span>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.05);padding:10px 18px;border-radius:8px;font-size:13px;">
        <b style="color:#8af;display:block;text-align:center;font-size:11px;margin-bottom:6px;">SETTINGS</b>
        <div style="display:flex;flex-direction:column;gap:7px;color:#889;">
          ${row(
            'Quality',
            select(
              'sel-quality',
              [
                ['low', 'Low'],
                ['medium', 'Medium'],
              ],
              settings.quality
            )
          )}
          ${row(
            'Sensitivity',
            select(
              'sel-sensitivity',
              [
                ['0.5', 'Slow'],
                ['1', 'Normal'],
                ['1.5', 'Fast'],
                ['2', 'Very Fast'],
              ],
              String(settings.sensitivity)
            )
          )}
          ${row(
            'Camera',
            select(
              'sel-camera',
              [
                ['tps', 'Third Person'],
                ['fps', 'First Person'],
              ],
              settings.cameraMode
            )
          )}
          ${row(
            'Minimap',
            select(
              'sel-minimap',
              [
                ['small', 'Small'],
                ['large', 'Large'],
              ],
              settings.minimapSize
            )
          )}
          ${row(
            'Volume',
            select(
              'sel-volume',
              [
                ['0', 'Mute'],
                ['0.3', 'Quiet'],
                ['0.7', 'Normal'],
                ['1', 'Loud'],
              ],
              String(settings.volume)
            )
          )}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:14px;max-width:760px;width:calc(100% - 32px);">
      <div style="background:rgba(255,255,255,0.05);padding:10px 18px;border-radius:8px;font-size:13px;min-width:220px;flex:1;">
        <b style="color:#8af;display:block;font-size:11px;margin-bottom:6px;">RECENT MATCHES</b>
        <div style="display:flex;flex-direction:column;gap:5px;">${historyMarkup}</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);padding:10px 18px;border-radius:8px;font-size:13px;min-width:260px;flex:1;">
        <b style="color:#8af;display:block;font-size:11px;margin-bottom:6px;">SEASON LEADERBOARD</b>
        <div style="display:flex;flex-direction:column;gap:5px;">${leaderboardMarkup}</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-online')?.addEventListener('click', () => {
    if (queue.active) return;
    callbacks.onPlayOnline();
  });

  document.getElementById('btn-local')?.addEventListener('click', () => {
    if (queue.active) return;
    overlay.remove();
    callbacks.onPlayLocal();
  });

  document.getElementById('btn-cancel-queue')?.addEventListener('click', () => {
    callbacks.onCancelQueue();
    overlay.remove();
  });

  const wire = (id: string, field: keyof Settings) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const value =
        field === 'sensitivity' || field === 'volume' ? parseFloat(target.value) : target.value;
      callbacks.onSettingsChange({ [field]: value } as Partial<Settings>);
    });
  };
  wire('sel-quality', 'quality');
  wire('sel-sensitivity', 'sensitivity');
  wire('sel-camera', 'cameraMode');
  wire('sel-minimap', 'minimapSize');
  wire('sel-volume', 'volume');
}
