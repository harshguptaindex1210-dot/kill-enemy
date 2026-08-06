import type { Settings } from './settings';
import type { LeaderboardEntry, MatchRecord } from './net/leaderboard';
import type { PlayerProfile } from './profile';
import { CHASSIS_PRESETS, GUN_SKINS, SKILL_DEFS, chassisById, gunSkinById } from './cosmetics';
import './lobby.css';

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

  const select = (id: string, opts: [string, string][], cur: string) =>
    `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

  const row = (label: string, sel: string) =>
    `<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;">${label}${sel}</label>`;

  const historyMarkup =
    activity.history.length === 0
      ? '<span class="muted">No matches played yet</span>'
      : activity.history
          .slice(0, 5)
          .map(
            (match) =>
              `<div class="lobby-list-row"><span>${placementLabel(match.placement)} · ${match.kills} K</span><span style="color:${match.won ? '#4f4' : '#889'};">${match.won ? 'WIN' : 'LOSS'}</span></div>`
          )
          .join('');

  const leaderboardMarkup =
    activity.leaderboard.length === 0
      ? '<span class="muted">Connect online to load rankings</span>'
      : activity.leaderboard
          .slice(0, 10)
          .map(
            (entry, index) =>
              `<div class="lobby-board-row"><span>${index + 1}</span><span>${escapeHtml(entry.username)}</span><span>${placementLabel(entry.placement)}</span><span>${entry.kills} K</span></div>`
          )
          .join('');

  const chassisCards = CHASSIS_PRESETS.map((c) => {
    const owned = profile.ownedChassis.includes(c.id);
    const locked = stats.level < c.unlockLevel;
    const equipped = profile.chassisId === c.id;
    let action = '';
    if (equipped) action = '<span style="color:#4f4;">Equipped</span>';
    else if (owned) action = `<button data-equip-chassis="${c.id}">Equip</button>`;
    else if (locked) action = `<span style="color:#a66;">Lv ${c.unlockLevel}</span>`;
    else if (c.unlock === 'buy')
      action = `<button class="buy" data-buy-chassis="${c.id}">Buy ${c.price}</button>`;
    else action = '<span class="muted">Locked</span>';
    const skillDef = SKILL_DEFS[c.skill];
    return `<div class="lobby-card${equipped ? ' is-equipped' : ''}">
      ${renderRobotSvg(c.color)}
      <span class="lobby-card-name">${escapeHtml(c.name)}</span>
      <span class="lobby-card-meta">⚡ ${escapeHtml(skillDef.name)}</span>
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
    else if (owned) action = `<button data-equip-skin="${s.id}">Equip</button>`;
    else if (locked) action = `<span style="color:#a66;">Lv ${s.unlockLevel}</span>`;
    else if (s.unlock === 'buy')
      action = `<button class="buy" data-buy-skin="${s.id}">Buy ${s.price}</button>`;
    else action = `<span class="muted">Reach Lv ${s.unlockLevel}</span>`;
    return `<div class="lobby-card${equipped ? ' is-equipped' : ''}">
      ${renderGunSvg(s.weapon, s.color)}
      <span class="lobby-card-name">${escapeHtml(s.name)}</span>
      <span class="lobby-card-weapon">${s.weapon}</span>
      ${action}
    </div>`;
  }).join('');

  const equippedChassis = chassisById(profile.chassisId);
  const equippedSkill = equippedChassis ? SKILL_DEFS[equippedChassis.skill] : undefined;
  const equippedRifle = gunSkinById(profile.equippedRifleSkin);
  const equippedPistol = gunSkinById(profile.equippedPistolSkin);

  overlay.className = 'lobby-overlay';
  overlay.innerHTML = `
    <div class="lobby-shell">
      <header id="lobby-hero" class="lobby-hero">
        <h1>ROBOT ARENA</h1>
        <p class="lobby-tagline">Battle Royale — 10 players — Robot Apocalypse</p>
        <div class="lobby-play">
          <button id="btn-online" class="lobby-btn lobby-btn-primary" type="button">${queue.active ? 'Searching for match...' : 'Play Online'}</button>
          ${queue.message && !queue.active ? `<p class="lobby-queue-msg">${escapeHtml(queue.message)}</p>` : ''}
          <div class="lobby-play-row">
            <button id="btn-local" class="lobby-btn lobby-btn-secondary" type="button">Play Local</button>
            <button id="btn-cancel-queue" class="lobby-btn lobby-btn-danger" type="button" style="display:${queue.active ? 'inline-block' : 'none'};">Cancel</button>
          </div>
        </div>
      </header>
      ${shopMessage ? `<p id="shop-msg" class="lobby-shop-msg">${escapeHtml(shopMessage)}</p>` : ''}
      <div class="lobby-panels">
        <section class="lobby-panel">
          <b class="lobby-panel-title">Character</b>
          <div class="lobby-name-row">
            <input id="inp-name" maxlength="16" value="${escapeHtml(profile.name)}" />
            <button id="btn-rename" class="lobby-btn lobby-btn-primary" type="button" style="width:auto;padding:8px 14px;min-height:40px;font-size:0.75rem;">Save</button>
          </div>
          <div class="lobby-stats">
            <span class="muted">Level</span><span>${stats.level}</span>
            <span class="muted">XP</span><span>${stats.xp}</span>
            <span class="muted">Credits</span><span style="color:#fa0;">${profile.credits}</span>
            <span class="muted">Wins</span><span style="color:#4f4;">${stats.wins}</span>
            <span class="muted">Kills</span><span style="color:#f44;">${stats.kills}</span>
            <span class="muted">Matches</span><span>${stats.matches}</span>
          </div>
        </section>
        <section class="lobby-panel" style="display:flex;flex-direction:column;align-items:center;">
          <b class="lobby-panel-title">Equipped Loadout</b>
          <div class="lobby-loadout-head">
            ${renderRobotSvg(equippedChassis?.color ?? 0x3366cc)}
            <div>
              <div style="font-weight:bold;">${escapeHtml(equippedChassis?.name ?? 'Blue Pilot')}</div>
              <div style="font-size:0.6875rem;color:#00ffff;">⚡ ${escapeHtml(equippedSkill?.name ?? 'Speed Boost [F]')}</div>
              <div style="font-size:0.625rem;color:var(--lobby-muted);">${escapeHtml(equippedSkill?.description ?? '')}</div>
            </div>
          </div>
          <div class="lobby-loadout-guns">
            <div style="text-align:center;">
              ${renderGunSvg('rifle', equippedRifle?.color ?? 0xffcc33)}
              <div style="font-size:0.625rem;color:#aaa;">${escapeHtml(equippedRifle?.name ?? 'Rifle')}</div>
            </div>
            <div style="text-align:center;">
              ${renderGunSvg('pistol', equippedPistol?.color ?? 0xff8844)}
              <div style="font-size:0.625rem;color:#aaa;">${escapeHtml(equippedPistol?.name ?? 'Pistol')}</div>
            </div>
          </div>
        </section>
        <section class="lobby-panel">
          <b class="lobby-panel-title">Settings</b>
          <div class="lobby-settings">
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
        </section>
      </div>
      <section class="lobby-panel lobby-section">
        <b class="lobby-panel-title">Chassis</b>
        <div class="lobby-shop-grid">${chassisCards}</div>
      </section>
      <section class="lobby-panel lobby-section">
        <b class="lobby-panel-title">Gun Skins / Shop</b>
        <p class="lobby-section-hint">Level-locked skins cannot be bought early. Free skins unlock automatically at level.</p>
        <div class="lobby-shop-grid">${skinCards}</div>
      </section>
      <div class="lobby-activity">
        <section class="lobby-panel">
          <b class="lobby-panel-title">Recent Matches</b>
          <div class="lobby-list">${historyMarkup}</div>
        </section>
        <section class="lobby-panel">
          <b class="lobby-panel-title">Season Leaderboard</b>
          <div class="lobby-list">${leaderboardMarkup}</div>
        </section>
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
