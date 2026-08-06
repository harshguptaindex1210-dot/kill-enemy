import type { Settings } from './settings';
import type { LeaderboardEntry, MatchRecord } from './net/leaderboard';
import type { PlayerProfile } from './profile';
import { CHASSIS_PRESETS, GUN_SKINS, SKILL_DEFS, chassisById, gunSkinById } from './cosmetics';

export interface LobbyCallbacks {
  onPlayLocal: () => void;
  onPlayOnline: () => void;
  onCancelQueue: () => void;
  onSettingsChange: (changes: Partial<Settings>) => void;
  onProfileChange: (profile: PlayerProfile) => void;
  onBuyGunSkin: (skinId: string) => void;
  onBuyChassis: (chassisId: string) => void;
  onEquipChassis: (chassisId: string) => void;
  onEquipGunSkin: (skinId: string) => void;
  onRename: (name: string) => void;
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

export interface LobbyStats {
  level: number;
  xp: number;
  wins: number;
  kills: number;
  matches: number;
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

function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function renderGunSvg(weapon: 'rifle' | 'pistol', colorNum: number): string {
  const hex = hexColor(colorNum);
  if (weapon === 'rifle') {
    return `<svg width="84" height="34" viewBox="0 0 84 34" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
      <rect x="4" y="15" width="14" height="8" rx="2" fill="#222" />
      <rect x="18" y="13" width="12" height="10" rx="1" fill="#333" />
      <rect x="30" y="11" width="24" height="12" rx="2" fill="${hex}" stroke="#ffffff" stroke-width="0.75" />
      <polygon points="38,23 44,23 42,31 36,31" fill="#111" />
      <rect x="54" y="13" width="20" height="4" fill="#555" />
      <rect x="74" y="12" width="4" height="6" fill="#111" />
      <rect x="36" y="8" width="12" height="3" fill="#444" />
      <rect x="30" y="23" width="6" height="8" rx="1" fill="#222" transform="rotate(15 30 23)" />
    </svg>`;
  } else {
    return `<svg width="64" height="34" viewBox="0 0 64 34" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
      <rect x="12" y="9" width="32" height="10" rx="2" fill="${hex}" stroke="#ffffff" stroke-width="0.75" />
      <rect x="44" y="11" width="10" height="6" fill="#444" />
      <rect x="16" y="19" width="10" height="12" rx="2" fill="#111" transform="rotate(12 16 19)" />
      <path d="M26,19 C26,23 30,23 30,19" fill="none" stroke="#333" stroke-width="2" />
    </svg>`;
  }
}

function renderRobotSvg(colorNum: number): string {
  const hex = hexColor(colorNum);
  return `<svg width="48" height="48" viewBox="0 0 48 48" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));">
    <rect x="14" y="20" width="20" height="18" rx="4" fill="${hex}" stroke="#ffffff" stroke-width="0.75" />
    <circle cx="24" cy="28" r="4" fill="#00ffff" />
    <rect x="16" y="8" width="16" height="10" rx="3" fill="${hex}" stroke="#ffffff" stroke-width="0.5" />
    <rect x="18" y="11" width="12" height="4" rx="1" fill="#00ffff" />
    <rect x="8" y="20" width="5" height="10" rx="2" fill="#222" />
    <rect x="35" y="20" width="5" height="10" rx="2" fill="#222" />
  </svg>`;
}

export function showLobby(
  stats: LobbyStats,
  settings: Settings,
  profile: PlayerProfile,
  callbacks: LobbyCallbacks,
  activity: LobbyActivity = { history: [], leaderboard: [] },
  queue: QueueStatus = { active: false, message: '' },
  shopMessage = ''
) {
  const existing = document.getElementById('lobby-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lobby-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;overflow:auto;background:linear-gradient(135deg,#0a0a1a,#1a1a3a);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px 12px 40px;z-index:9998;font-family:sans-serif;color:#fff;';

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

  const chassisCards = CHASSIS_PRESETS.map((c) => {
    const owned = profile.ownedChassis.includes(c.id);
    const locked = stats.level < c.unlockLevel;
    const equipped = profile.chassisId === c.id;
    let action = '';
    if (equipped) action = '<span style="color:#4f4;">Equipped</span>';
    else if (owned)
      action = `<button data-equip-chassis="${c.id}" style="padding:4px 10px;background:#4af;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:11px;">Equip</button>`;
    else if (locked) action = `<span style="color:#a66;">Lv ${c.unlockLevel}</span>`;
    else if (c.unlock === 'buy')
      action = `<button data-buy-chassis="${c.id}" style="padding:4px 10px;background:#fa0;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:11px;">Buy ${c.price}</button>`;
    else action = `<span style="color:#889;">Locked</span>`;
    const skillDef = SKILL_DEFS[c.skill];
    return `<div style="display:flex;flex-direction:column;gap:6px;align-items:center;background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;min-width:110px;border:1px solid ${equipped ? '#4af' : 'rgba(255,255,255,0.1)'};">
      ${renderRobotSvg(c.color)}
      <span style="font-size:12px;font-weight:bold;">${escapeHtml(c.name)}</span>
      <span style="font-size:10px;color:#00ffff;background:rgba(0,240,255,0.1);padding:2px 6px;border-radius:3px;">⚡ ${escapeHtml(skillDef.name)}</span>
      ${action}
    </div>`;
  }).join('');

  const skinCards = GUN_SKINS.map((s) => {
    const owned = profile.ownedGunSkins.includes(s.id);
    const locked = stats.level < s.unlockLevel;
    const equipped =
      (s.weapon === 'rifle' && profile.equippedRifleSkin === s.id) ||
      (s.weapon === 'pistol' && profile.equippedPistolSkin === s.id);
    let action = '';
    if (equipped) action = '<span style="color:#4f4;">Equipped</span>';
    else if (owned)
      action = `<button data-equip-skin="${s.id}" style="padding:4px 10px;background:#4af;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:11px;">Equip</button>`;
    else if (locked) action = `<span style="color:#a66;">Lv ${s.unlockLevel}</span>`;
    else if (s.unlock === 'buy')
      action = `<button data-buy-skin="${s.id}" style="padding:4px 10px;background:#fa0;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:11px;">Buy ${s.price}</button>`;
    else action = `<span style="color:#889;">Reach Lv ${s.unlockLevel}</span>`;
    return `<div style="display:flex;flex-direction:column;gap:6px;align-items:center;background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;min-width:120px;border:1px solid ${equipped ? '#4af' : 'rgba(255,255,255,0.1)'};">
      ${renderGunSvg(s.weapon, s.color)}
      <span style="font-size:11px;font-weight:bold;text-align:center;">${escapeHtml(s.name)}</span>
      <span style="font-size:10px;color:#889;text-transform:uppercase;">${s.weapon}</span>
      ${action}
    </div>`;
  }).join('');

  const equippedChassis = chassisById(profile.chassisId);
  const equippedSkill = equippedChassis ? SKILL_DEFS[equippedChassis.skill] : undefined;
  const equippedRifle = gunSkinById(profile.equippedRifleSkin);
  const equippedPistol = gunSkinById(profile.equippedPistolSkin);

  overlay.innerHTML = `
    <h1 style="font-size:46px;margin:0 0 6px;letter-spacing:4px;text-transform:uppercase;color:#4af;">ROBOT ARENA</h1>
    <p style="color:#889;margin:0 0 18px;font-size:13px;">Battle Royale — 10 players — Robot Apocalypse</p>
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:18px;">
      <button id="btn-online" style="padding:13px 42px;font-size:17px;background:#4af;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">${queue.active ? 'Searching for match...' : 'Play Online'}</button>
      ${queue.message && !queue.active ? `<p style="color:#fa0;font-size:12px;margin:0;">${escapeHtml(queue.message)}</p>` : ''}
      <div style="display:flex;gap:10px;align-items:center;">
        <button id="btn-local" style="padding:8px 20px;font-size:13px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Play Local</button>
        <button id="btn-cancel-queue" style="padding:8px 20px;font-size:13px;background:#a33;color:#fff;border:none;border-radius:4px;cursor:pointer;display:${queue.active ? 'inline-block' : 'none'};">Cancel</button>
      </div>
    </div>
    ${shopMessage ? `<p id="shop-msg" style="color:#fa0;font-size:12px;margin:0 0 12px;">${escapeHtml(shopMessage)}</p>` : ''}
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:960px;width:100%;">
      <div style="background:rgba(255,255,255,0.05);padding:12px 18px;border-radius:8px;font-size:13px;min-width:220px;">
        <b style="color:#8af;display:block;text-align:center;font-size:11px;margin-bottom:8px;">CHARACTER</b>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <input id="inp-name" maxlength="16" value="${escapeHtml(profile.name)}" style="flex:1;padding:6px 8px;border-radius:4px;border:1px solid #445;background:#111;color:#fff;" />
          <button id="btn-rename" style="padding:6px 12px;background:#4af;color:#000;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Save</button>
        </div>
        <div style="display:grid;grid-template-columns:auto auto;gap:3px 16px;">
          <span style="color:#889;">Level</span><span>${stats.level}</span>
          <span style="color:#889;">XP</span><span>${stats.xp}</span>
          <span style="color:#889;">Credits</span><span style="color:#fa0;">${profile.credits}</span>
          <span style="color:#889;">Wins</span><span style="color:#4f4;">${stats.wins}</span>
          <span style="color:#889;">Kills</span><span style="color:#f44;">${stats.kills}</span>
          <span style="color:#889;">Matches</span><span>${stats.matches}</span>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.05);padding:12px 18px;border-radius:8px;font-size:13px;min-width:240px;display:flex;flex-direction:column;align-items:center;">
        <b style="color:#8af;display:block;text-align:center;font-size:11px;margin-bottom:8px;">EQUIPPED LOADOUT</b>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
          ${renderRobotSvg(equippedChassis?.color ?? 0x3366cc)}
          <div>
            <div style="font-weight:bold;color:#fff;">${escapeHtml(equippedChassis?.name ?? 'Blue Pilot')}</div>
            <div style="font-size:11px;color:#00ffff;">⚡ ${escapeHtml(equippedSkill?.name ?? 'Speed Boost [F]')}</div>
            <div style="font-size:10px;color:#889;">${escapeHtml(equippedSkill?.description ?? '')}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;background:rgba(0,0,0,0.25);padding:6px 12px;border-radius:6px;width:100%;">
          <div style="text-align:center;">
            ${renderGunSvg('rifle', equippedRifle?.color ?? 0xffcc33)}
            <div style="font-size:10px;color:#aaa;">${escapeHtml(equippedRifle?.name ?? 'Rifle')}</div>
          </div>
          <div style="text-align:center;">
            ${renderGunSvg('pistol', equippedPistol?.color ?? 0xff8844)}
            <div style="font-size:10px;color:#aaa;">${escapeHtml(equippedPistol?.name ?? 'Pistol')}</div>
          </div>
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
    <div style="margin-top:16px;background:rgba(255,255,255,0.05);padding:12px 18px;border-radius:8px;max-width:960px;width:100%;">
      <b style="color:#8af;display:block;font-size:11px;margin-bottom:10px;">CHASSIS</b>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">${chassisCards}</div>
    </div>
    <div style="margin-top:12px;background:rgba(255,255,255,0.05);padding:12px 18px;border-radius:8px;max-width:960px;width:100%;">
      <b style="color:#8af;display:block;font-size:11px;margin-bottom:6px;">GUN SKINS / SHOP</b>
      <p style="color:#889;font-size:11px;margin:0 0 10px;text-align:center;">Level-locked skins cannot be bought early. Free skins unlock automatically at level.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">${skinCards}</div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:14px;max-width:960px;width:100%;">
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

  document.getElementById('btn-rename')?.addEventListener('click', () => {
    const inp = document.getElementById('inp-name') as HTMLInputElement | null;
    if (inp) callbacks.onRename(inp.value);
  });

  overlay.querySelectorAll('[data-equip-chassis]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.equipChassis;
      if (id) callbacks.onEquipChassis(id);
    });
  });
  overlay.querySelectorAll('[data-buy-chassis]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.buyChassis;
      if (id) callbacks.onBuyChassis(id);
    });
  });
  overlay.querySelectorAll('[data-equip-skin]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.equipSkin;
      if (id) callbacks.onEquipGunSkin(id);
    });
  });
  overlay.querySelectorAll('[data-buy-skin]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.buySkin;
      if (id) callbacks.onBuyGunSkin(id);
    });
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
