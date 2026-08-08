import type { Settings } from './settings';
import type { LeaderboardEntry, MatchRecord } from './net/leaderboard';
import type { PlayerProfile } from './profile';
import {
  CHASSIS_PRESETS,
  GUN_SKINS,
  CAR_SKINS,
  SKILL_DEFS,
  carSkinById,
  chassisById,
  gunSkinById,
} from './cosmetics';
import { isTouchDevice, safeScrollToTop } from './platform';
import { MAP_IDS, mapPreset } from './mapPresets';
import { GAME_SHARE_TEXT, GAME_SHARE_URL } from './siteUrl';
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
  onBuyCarSkin: (skinId: string) => void;
  onEquipCarSkin: (skinId: string) => void;
  onRename: (name: string) => void;
  onAddFriend: (username: string) => void;
  onRemoveFriend: (username: string) => void;
  onInviteFriend: (username: string) => void;
}

export interface FounderPanelState {
  isFounderName: boolean;
  trustState: 'locked' | 'trusted';
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

function renderInstructionsPanel(): string {
  const touchHint = isTouchDevice()
    ? '<dt>Mobile</dt><dd>Left joystick move · drag right side to aim · on-screen buttons to shoot, jump, reload</dd>'
    : '';
  return `<aside id="lobby-instructions" class="lobby-instructions" aria-label="How to play">
    <b class="lobby-panel-title">How to Play</b>
    <dl class="lobby-instructions-list">
      <dt>Move</dt>
      <dd><kbd>W A S D</kbd> walk · <kbd>Shift</kbd> sprint · <kbd>Ctrl</kbd> crouch · <kbd>Space</kbd> jump</dd>
      <dt>Aim &amp; shoot</dt>
      <dd>Mouse look · <kbd>LMB</kbd> fire · <kbd>R</kbd> reload · <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> weapons · <kbd>F</kbd> skill</dd>
      <dt>Grenades</dt>
      <dd><kbd>G</kbd> throw · cook with hold (release to toss)</dd>
      <dt>Loot</dt>
      <dd>Walk over weapon pads · <kbd>E</kbd> open crates &amp; airdrops</dd>
      <dt>Vehicles</dt>
      <dd><kbd>E</kbd> enter / exit · <kbd>W A S D</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer</dd>
      <dt>Respawn</dt>
      <dd>Local match: <kbd>R</kbd> or click <b>RESPAWN</b> on the death overlay</dd>
      <dt>Storm</dt>
      <dd>Stay inside the blue safe zone — damage ramps each phase</dd>
      <dt>Win</dt>
      <dd>Be the last fighter standing in the 10-player match</dd>
      ${touchHint}
    </dl>
  </aside>`;
}

function renderFriendsPanel(profile: PlayerProfile): string {
  const rows =
    profile.friends.length === 0
      ? '<p class="lobby-friends-empty muted">No friends yet — add by username below</p>'
      : profile.friends
          .map(
            (name) =>
              `<div class="lobby-friend-row">
                <span class="lobby-friend-name">${escapeHtml(name)}</span>
                <div class="lobby-friend-actions">
                  <button type="button" class="lobby-friend-invite" data-invite-friend="${escapeHtml(name)}" title="Invite to match (online stub)">Invite</button>
                  <button type="button" class="lobby-friend-remove" data-remove-friend="${escapeHtml(name)}" title="Remove friend">×</button>
                </div>
              </div>`
          )
          .join('');
  return `<aside id="lobby-friends" class="lobby-panel lobby-friends" aria-label="Friends">
    <b class="lobby-panel-title">Squad · Friends</b>
    <div class="lobby-friends-add">
      <input id="inp-friend" maxlength="20" placeholder="Add by username" aria-label="Friend username" />
      <button id="btn-add-friend" class="lobby-btn lobby-btn-primary lobby-btn-compact" type="button">Add</button>
    </div>
    <div class="lobby-friends-list">${rows}</div>
    <p class="lobby-friends-hint muted">Online invites sync when Nakama friends API is wired (#67).</p>
  </aside>`;
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

function renderCarSvg(vehicle: 'sedan' | 'buggy', colorNum: number): string {
  const hex = hexColor(colorNum);
  if (vehicle === 'sedan') {
    return `<svg width="72" height="34" viewBox="0 0 72 34" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
      <rect x="8" y="14" width="56" height="12" rx="3" fill="${hex}" stroke="#ffffff" stroke-width="0.75" />
      <rect x="14" y="8" width="28" height="8" rx="2" fill="${hex}" opacity="0.85" />
      <circle cx="18" cy="28" r="5" fill="#111" />
      <circle cx="54" cy="28" r="5" fill="#111" />
    </svg>`;
  }
  return `<svg width="72" height="34" viewBox="0 0 72 34" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
    <rect x="10" y="16" width="48" height="10" rx="2" fill="${hex}" stroke="#ffffff" stroke-width="0.75" />
    <rect x="18" y="10" width="20" height="6" rx="1" fill="${hex}" opacity="0.9" />
    <circle cx="20" cy="28" r="6" fill="#111" />
    <circle cx="52" cy="28" r="6" fill="#111" />
  </svg>`;
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
  shopMessage = '',
  founder: FounderPanelState = {
    isFounderName: false,
    trustState: 'locked',
  }
) {
  const existing = document.getElementById('lobby-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lobby-overlay';
  // Essential positioning if the CSS chunk is slow/unavailable (INV-L failure degrade).
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;overflow:auto;';

  const touchControlsHint = isTouchDevice()
    ? 'Touch: joystick move · drag to aim · on-screen buttons to shoot'
    : '<kbd>W A S D</kbd> move · Mouse aim · <kbd>LMB</kbd> shoot · <kbd>E</kbd> loot/vehicle · <kbd>G</kbd> grenade';

  const select = (id: string, opts: [string, string][], cur: string) =>
    `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

  const row = (label: string, sel: string) =>
    `<label class="lobby-settings-row">${label}${sel}</label>`;
  const range = (id: string, value: number, min: number, max: number, step: number, suffix = '') =>
    `<span class="lobby-settings-range">
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <b id="${id}-value" class="lobby-settings-range-value">${value.toFixed(2)}${suffix}</b>
    </span>`;
  const toggle = (id: string, checked: boolean, onLabel = 'On', offLabel = 'Off') =>
    `<select id="${id}"><option value="false"${!checked ? ' selected' : ''}>${offLabel}</option><option value="true"${checked ? ' selected' : ''}>${onLabel}</option></select>`;

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
    if (equipped) action = '<span class="lobby-card-equipped">Equipped</span>';
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
    if (equipped) action = '<span class="lobby-card-equipped">Equipped</span>';
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

  const carSkinCards = CAR_SKINS.map((s) => {
    const owned = profile.ownedCarSkins.includes(s.id);
    const locked = stats.level < s.unlockLevel;
    const equipped =
      (s.vehicle === 'sedan' && profile.equippedSedanSkin === s.id) ||
      (s.vehicle === 'buggy' && profile.equippedBuggySkin === s.id);
    let action = '';
    if (equipped) action = '<span class="lobby-card-equipped">Equipped</span>';
    else if (owned) action = `<button data-equip-car="${s.id}">Equip</button>`;
    else if (locked) action = `<span style="color:#a66;">Lv ${s.unlockLevel}</span>`;
    else if (s.unlock === 'buy')
      action = `<button class="buy" data-buy-car="${s.id}">Buy ${s.price}</button>`;
    else action = `<span class="muted">Reach Lv ${s.unlockLevel}</span>`;
    return `<div class="lobby-card${equipped ? ' is-equipped' : ''}">
      ${renderCarSvg(s.vehicle, s.color)}
      <span class="lobby-card-name">${escapeHtml(s.name)}</span>
      <span class="lobby-card-weapon">${s.vehicle}</span>
      ${action}
    </div>`;
  }).join('');

  const equippedChassis = chassisById(profile.chassisId);
  const equippedSkill = equippedChassis ? SKILL_DEFS[equippedChassis.skill] : undefined;
  const equippedRifle = gunSkinById(profile.equippedRifleSkin);
  const equippedPistol = gunSkinById(profile.equippedPistolSkin);
  const equippedSedan = carSkinById(profile.equippedSedanSkin);
  const equippedBuggy = carSkinById(profile.equippedBuggySkin);
  const founderStatusText = !founder.isFounderName
    ? 'Founder status: locked (not using reserved founder profile)'
    : founder.trustState === 'trusted'
      ? 'Founder status: unlocked / trusted'
      : 'Founder status: locked';
  const founderStatusClass =
    founder.trustState === 'trusted'
      ? 'lobby-founder-status is-trusted'
      : 'lobby-founder-status is-locked';

  overlay.className = 'lobby-overlay';
  overlay.innerHTML = `
    <div class="lobby-layout">
    <div class="lobby-shell">
      <header id="lobby-hero" class="lobby-hero">
        <div class="lobby-hero-badge">SEASON 1 · 10-PLAYER BATTLE ROYALE</div>
        <h1>KILL ENEMY</h1>
        <p class="lobby-tagline">Drop in, loot fast, drive hard, and survive the last-circle chaos.</p>
        <div class="lobby-hero-stats">
          <span><b>Lv ${stats.level}</b> <span class="muted">${escapeHtml(profile.name)}</span></span>
          <span><b class="lobby-stat-gold">${profile.credits}</b> <span class="muted">Credits</span></span>
          <span><b class="lobby-stat-wins">${stats.wins}</b> <span class="muted">Wins</span></span>
          <span><b class="lobby-stat-kills">${stats.kills}</b> <span class="muted">Kills</span></span>
        </div>
        <p class="lobby-share" aria-label="Share game link">
          <a class="lobby-share-link" href="${GAME_SHARE_URL}" target="_blank" rel="noopener noreferrer">${GAME_SHARE_URL}</a>
          <button id="btn-share" class="lobby-btn lobby-btn-secondary lobby-share-btn" type="button">Copy link</button>
        </p>
      </header>
      <section class="lobby-modes" aria-label="Play modes">
        <article class="lobby-mode-card lobby-mode-card-primary">
          <div class="lobby-mode-head">
            <span class="lobby-mode-label">Ranked Queue</span>
            <span class="lobby-mode-tag">ONLINE</span>
          </div>
          <p class="lobby-mode-desc">Matchmake with players worldwide. Bots fill empty slots.</p>
          <button id="btn-online" class="lobby-btn lobby-btn-primary" type="button">${queue.active ? 'SEARCHING…' : 'DEPLOY'}</button>
          ${queue.message && !queue.active ? `<p class="lobby-queue-msg">${escapeHtml(queue.message)}</p>` : ''}
          <button id="btn-cancel-queue" class="lobby-btn lobby-btn-danger lobby-queue-cancel${queue.active ? ' is-visible' : ''}" type="button">Cancel Search</button>
        </article>
        <article class="lobby-mode-card">
          <div class="lobby-mode-head">
            <span class="lobby-mode-label">Training Ground</span>
            <span class="lobby-mode-tag lobby-mode-tag-muted">LOCAL</span>
          </div>
          <p class="lobby-mode-desc">Instant match vs AI bots. No account required.</p>
          <button id="btn-local" class="lobby-btn lobby-btn-secondary lobby-btn-block" type="button"${queue.active ? ' disabled' : ''}>Training Ground</button>
        </article>
      </section>
      <section class="lobby-panel lobby-profile-panel" aria-label="Profile">
        <b class="lobby-panel-title">Profile / Player Name</b>
        <p class="lobby-profile-help">Saved locally.</p>
        <div class="lobby-name-row">
          <input id="inp-name" maxlength="20" value="${escapeHtml(profile.name)}" placeholder="Name" aria-label="Player name" />
          <button id="btn-rename" class="lobby-btn lobby-btn-primary lobby-btn-compact" type="button">Save</button>
        </div>
        <div class="lobby-founder-lock">
          <p id="founder-status" class="${founderStatusClass}">${escapeHtml(founderStatusText)}</p>
        </div>
        ${shopMessage ? `<p id="shop-msg" class="lobby-shop-msg">${escapeHtml(shopMessage)}</p>` : ''}
      </section>
      <section class="lobby-panel lobby-map-panel" aria-label="Map selection">
        <b class="lobby-panel-title">Map</b>
        <div class="lobby-map-grid">
          ${MAP_IDS.map((id) => {
            const m = mapPreset(id);
            return `<button id="btn-map-${id}" type="button" class="lobby-map-card${settings.mapId === id ? ' is-active' : ''}" data-map="${id}"><span class="lobby-map-name">${escapeHtml(m.label)}</span><span class="lobby-map-tag">${escapeHtml(m.tagline)}</span></button>`;
          }).join('')}
        </div>
        <p class="lobby-map-note muted">Selected map loads on your next match. Change anytime in ⚙ settings in-game.</p>
      </section>
      <section class="lobby-panel lobby-preset-panel" aria-label="Performance presets">
        <b class="lobby-panel-title">Device Presets</b>
        <div class="lobby-presets">
          <button id="btn-preset-low" class="lobby-preset${settings.quality === 'low' ? ' is-active' : ''}" type="button">Low · Max FPS (Phone)</button>
          <button id="btn-preset-medium" class="lobby-preset${settings.quality === 'medium' ? ' is-active' : ''}" type="button">Medium · Balanced (iPhone/Laptop)</button>
          <button id="btn-preset-high" class="lobby-preset${settings.quality === 'high' ? ' is-active' : ''}" type="button">High · Visual Quality (Laptop)</button>
        </div>
      </section>
      <p class="lobby-quick-controls" aria-label="Quick controls">${touchControlsHint}</p>
      <div class="lobby-body">
        <div class="lobby-body-main">
      <div class="lobby-panels">
        <section class="lobby-panel">
          <b class="lobby-panel-title">Character</b>
          <div class="lobby-stats">
            <span class="muted">Level</span><span>${stats.level}</span>
            <span class="muted">XP</span><span>${stats.xp}</span>
            <span class="muted">Credits</span><span class="lobby-stat-gold">${profile.credits}</span>
            <span class="muted">Wins</span><span class="lobby-stat-wins">${stats.wins}</span>
            <span class="muted">Kills</span><span class="lobby-stat-kills">${stats.kills}</span>
            <span class="muted">Matches</span><span>${stats.matches}</span>
          </div>
        </section>
        <section class="lobby-panel lobby-loadout-panel">
          <b class="lobby-panel-title">Equipped Loadout</b>
          <div class="lobby-loadout-head">
            ${renderRobotSvg(equippedChassis?.color ?? 0x3366cc)}
            <div>
              <div class="lobby-equipped-name">${escapeHtml(equippedChassis?.name ?? 'Blue Pilot')}</div>
              <div class="lobby-equipped-skill">⚡ ${escapeHtml(equippedSkill?.name ?? 'Speed Boost [F]')}</div>
              <div class="lobby-equipped-desc">${escapeHtml(equippedSkill?.description ?? '')}</div>
            </div>
          </div>
          <div class="lobby-loadout-guns">
            <div class="lobby-loadout-item">
              ${renderGunSvg('rifle', equippedRifle?.color ?? 0xffcc33)}
              <div class="lobby-loadout-item-label">${escapeHtml(equippedRifle?.name ?? 'Rifle')}</div>
            </div>
            <div class="lobby-loadout-item">
              ${renderGunSvg('pistol', equippedPistol?.color ?? 0xff8844)}
              <div class="lobby-loadout-item-label">${escapeHtml(equippedPistol?.name ?? 'Pistol')}</div>
            </div>
            <div class="lobby-loadout-item">
              ${renderCarSvg('sedan', equippedSedan?.color ?? 0x457b9d)}
              <div class="lobby-loadout-item-label">${escapeHtml(equippedSedan?.name ?? 'Sedan')}</div>
            </div>
            <div class="lobby-loadout-item">
              ${renderCarSvg('buggy', equippedBuggy?.color ?? 0x80b918)}
              <div class="lobby-loadout-item-label">${escapeHtml(equippedBuggy?.name ?? 'Buggy')}</div>
            </div>
          </div>
        </section>
        <section class="lobby-panel">
          <b class="lobby-panel-title">Settings</b>
          <div class="lobby-settings">
            ${row(
              'Map',
              select(
                'sel-map',
                MAP_IDS.map((id) => [id, mapPreset(id).label]),
                settings.mapId
              )
            )}
            ${row(
              'Quality',
              select(
                'sel-quality',
                [
                  ['low', 'Low (Performance)'],
                  ['medium', 'Medium (Balanced)'],
                  ['high', 'High (Quality)'],
                ],
                settings.quality
              )
            )}
            ${row(
              'Sensitivity',
              select(
                'sel-sensitivity',
                [
                  ['0.5', '0.5x'],
                  ['0.8', '0.8x'],
                  ['1', '1.0x'],
                  ['1.2', '1.2x'],
                  ['1.5', '1.5x'],
                  ['2', '2.0x'],
                ],
                String(settings.sensitivity)
              )
            )}
            ${row('Touch Look X', range('rng-touch-sens-x', settings.touchSensitivityX, 0.35, 3, 0.05, 'x'))}
            ${row('Touch Look Y', range('rng-touch-sens-y', settings.touchSensitivityY, 0.35, 3, 0.05, 'x'))}
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
              'Invert Horizontal',
              toggle('sel-invert-look-horizontal', settings.invertLookHorizontal)
            )}
            ${row(
              'Invert Vertical',
              toggle('sel-invert-look-vertical', settings.invertLookVertical)
            )}
            ${row(
              'Left Fire Button',
              toggle('sel-left-fire', settings.leftFireButton, 'Enabled', 'Disabled')
            )}
            ${row(
              'Sprint Mode',
              select(
                'sel-touch-sprint',
                [
                  ['auto', 'Auto Sprint'],
                  ['hold', 'Hold Sprint'],
                ],
                settings.touchSprintMode
              )
            )}
            ${row(
              'Button Size',
              select(
                'sel-touch-buttons',
                [
                  ['compact', 'Compact'],
                  ['standard', 'Standard'],
                ],
                settings.touchButtonPreset
              )
            )}
            ${row(
              'Touch Layout',
              select(
                'sel-touch-layout',
                [
                  ['thumbs', 'Thumbs (Recommended)'],
                  ['classic', 'Classic'],
                ],
                settings.touchLayoutPreset
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
            ${row('HUD Opacity', range('rng-hud-opacity', settings.hudOpacity, 0.35, 1, 0.05))}
            ${row('HUD Scale', range('rng-hud-scale', settings.hudScale, 0.8, 1.3, 0.05, 'x'))}
            ${row('Gyro Aim', toggle('sel-gyro', settings.gyroAim, 'On (Soon)', 'Off'))}
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
      <section class="lobby-panel lobby-section">
        <b class="lobby-panel-title">Car Skins / Shop</b>
        <p class="lobby-section-hint">Sedan and buggy recolors — material swap on blockout meshes.</p>
        <div class="lobby-shop-grid">${carSkinCards}</div>
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
        <div class="lobby-body-side">
          ${renderFriendsPanel(profile)}
        </div>
      </div>
    </div>
    ${renderInstructionsPanel()}
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.scrollTop = 0;
  safeScrollToTop();

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
  document.getElementById('inp-name')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      const inp = e.target as HTMLInputElement;
      callbacks.onRename(inp.value);
    }
  });
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-share') as HTMLButtonElement | null;
    const share = async (): Promise<boolean> => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Kill Enemy',
            text: GAME_SHARE_TEXT,
            url: GAME_SHARE_URL,
          });
          return true;
        } catch {
          /* user dismissed */
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(GAME_SHARE_TEXT);
          return true;
        } catch {
          /* restricted */
        }
      }
      return false;
    };
    const ok = await share();
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 2000);
    }
  });

  document.getElementById('btn-add-friend')?.addEventListener('click', () => {
    const inp = document.getElementById('inp-friend') as HTMLInputElement | null;
    if (inp?.value.trim()) callbacks.onAddFriend(inp.value.trim());
  });
  document.getElementById('inp-friend')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      const inp = e.target as HTMLInputElement;
      if (inp.value.trim()) callbacks.onAddFriend(inp.value.trim());
    }
  });
  overlay.querySelectorAll('[data-remove-friend]').forEach((el) => {
    el.addEventListener('click', () => {
      const name = (el as HTMLElement).dataset.removeFriend;
      if (name) callbacks.onRemoveFriend(name);
    });
  });
  overlay.querySelectorAll('[data-invite-friend]').forEach((el) => {
    el.addEventListener('click', () => {
      const name = (el as HTMLElement).dataset.inviteFriend;
      if (name) callbacks.onInviteFriend(name);
    });
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
  overlay.querySelectorAll('[data-equip-car]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.equipCar;
      if (id) callbacks.onEquipCarSkin(id);
    });
  });
  overlay.querySelectorAll('[data-buy-car]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.buyCar;
      if (id) callbacks.onBuyCarSkin(id);
    });
  });

  const wire = (id: string, field: keyof Settings) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      let value: string | number | boolean = target.value;
      if (
        field === 'sensitivity' ||
        field === 'volume' ||
        field === 'touchSensitivityX' ||
        field === 'touchSensitivityY' ||
        field === 'hudOpacity' ||
        field === 'hudScale'
      ) {
        value = parseFloat(target.value);
      } else if (
        field === 'invertLookHorizontal' ||
        field === 'invertLookVertical' ||
        field === 'leftFireButton' ||
        field === 'gyroAim'
      ) {
        value = target.value === 'true';
      }
      callbacks.onSettingsChange({ [field]: value } as Partial<Settings>);
    });
  };
  const wireRange = (id: string, field: keyof Settings, suffix = '') => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    const valueEl = document.getElementById(`${id}-value`);
    if (!input) return;
    const push = () => {
      const v = parseFloat(input.value);
      if (valueEl) valueEl.textContent = `${v.toFixed(2)}${suffix}`;
      callbacks.onSettingsChange({ [field]: v } as Partial<Settings>);
    };
    input.addEventListener('input', push);
    input.addEventListener('change', push);
  };
  wire('sel-map', 'mapId');
  wire('sel-quality', 'quality');
  wire('sel-sensitivity', 'sensitivity');
  wireRange('rng-touch-sens-x', 'touchSensitivityX', 'x');
  wireRange('rng-touch-sens-y', 'touchSensitivityY', 'x');
  wire('sel-camera', 'cameraMode');
  wire('sel-invert-look-horizontal', 'invertLookHorizontal');
  wire('sel-invert-look-vertical', 'invertLookVertical');
  wire('sel-left-fire', 'leftFireButton');
  wire('sel-touch-sprint', 'touchSprintMode');
  wire('sel-touch-buttons', 'touchButtonPreset');
  wire('sel-touch-layout', 'touchLayoutPreset');
  wire('sel-minimap', 'minimapSize');
  wireRange('rng-hud-opacity', 'hudOpacity');
  wireRange('rng-hud-scale', 'hudScale', 'x');
  wire('sel-gyro', 'gyroAim');
  wire('sel-volume', 'volume');

  const presetMap: Record<string, Settings['quality']> = {
    'btn-preset-low': 'low',
    'btn-preset-medium': 'medium',
    'btn-preset-high': 'high',
  };
  for (const [id, quality] of Object.entries(presetMap)) {
    document.getElementById(id)?.addEventListener('click', () => {
      callbacks.onSettingsChange({ quality });
    });
  }
  for (const id of MAP_IDS) {
    document.getElementById(`btn-map-${id}`)?.addEventListener('click', () => {
      callbacks.onSettingsChange({ mapId: id });
    });
  }
}
