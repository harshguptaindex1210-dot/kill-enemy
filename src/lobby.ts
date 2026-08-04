import type { Settings } from './settings';

export interface LobbyCallbacks {
  onStartMatch: () => void;
  onSettingsChange: (changes: Partial<Settings>) => void;
}

export function showLobby(
  stats: { level: number; xp: number; wins: number; kills: number; matches: number },
  settings: Settings,
  callbacks: LobbyCallbacks
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

  overlay.innerHTML = `
    <h1 style="font-size:46px;margin:0 0 6px;letter-spacing:4px;text-transform:uppercase;color:#4af;">ROBOT ARENA</h1>
    <p style="color:#889;margin:0 0 26px;font-size:13px;">Battle Royale — Robot Apocalypse</p>
    <button id="btn-start" style="padding:13px 42px;font-size:17px;background:#4af;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;margin-bottom:20px;">Start Match</button>
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
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-start')?.addEventListener('click', () => {
    callbacks.onStartMatch();
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
