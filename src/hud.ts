import { MAP_SIZE } from './constants';

export function applyHudChrome(settings: { hudOpacity: number; hudScale: number }): void {
  const hud = document.getElementById('game-hud');
  if (!hud) return;
  const opacity = Math.min(1, Math.max(0.35, settings.hudOpacity));
  const scale = Math.min(1.3, Math.max(0.8, settings.hudScale));
  hud.style.opacity = String(opacity);
  hud.style.setProperty('--hud-scale', String(scale));
}

export function createHUD(): {
  update: (data: HUDData) => void;
  remove: () => void;
  onRespawn?: (handler: () => void) => void;
  onHealAction?: (handler: () => void) => void;
} {
  const el = document.createElement('div');
  el.id = 'game-hud';
  el.className = 'game-hud';
  el.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:10005;display:none;overflow:visible;--hud-scale:1;';
  el.innerHTML = `
    <div id="hud-top" class="hud-panel hud-top">
      <span id="hud-kills" class="hud-stat">KILLS 0</span>
      <span id="hud-targets" class="hud-stat">TGT 0</span>
      <span id="hud-alive" class="hud-stat">ALIVE 0</span>
      <span id="hud-phase" class="hud-stat hud-phase">LOBBY</span>
      <span id="hud-timer" class="hud-stat">TIME 0:00</span>
      <span id="hud-zone" class="hud-stat hud-zone">ZONE 0:00</span>
      <span id="hud-storm" class="hud-stat hud-storm">STORM</span>
    </div>
    <div id="hud-prompt" class="hud-panel hud-prompt"></div>
    <div id="hud-bottom" class="hud-panel hud-bottom">
      <div class="hud-vitals">
        <div class="hud-vital-row">
          <span class="hud-vital-label">HEALTH</span><span id="hud-health-num" class="hud-vital-value">100</span>
        </div>
        <div class="hud-bar-track hud-bar-health"><div id="hud-health-bar" class="hud-bar-fill"></div></div>
        <div class="hud-vital-row">
          <span class="hud-vital-label">ARMOR</span><span id="hud-armor-num" class="hud-vital-value">0</span>
        </div>
        <div class="hud-bar-track hud-bar-armor"><div id="hud-armor-bar" class="hud-bar-fill"></div></div>
        <div id="hud-heal-row" class="hud-bar-track hud-bar-heal"><div id="hud-heal-bar" class="hud-bar-fill"></div></div>
      </div>
      <div id="hud-weapon" class="hud-weapon">
        <div id="hud-weapon-name" class="hud-weapon-name">RIFLE</div>
        <div id="hud-ammo" class="hud-ammo">30 / 90</div>
        <div id="hud-reload" class="hud-reload">RELOADING...</div>
      </div>
      <div id="hud-skill" class="hud-skill">
        <div id="hud-skill-name" class="hud-skill-name">SKILL Speed [F]</div>
        <div id="hud-skill-status" class="hud-skill-status">READY</div>
      </div>
      <div class="hud-supplies">
        <div>GRN <span id="hud-grenades">2</span></div>
        <div>MED <span id="hud-heals">3</span></div>
      </div>
      <button id="hud-heal-action" type="button" class="hud-heal-btn">HEAL</button>
    </div>
    <div id="hud-killfeed" class="hud-killfeed"></div>
    <div id="hud-damage" class="hud-damage-flash"></div>
    <div id="hud-compass" class="hud-panel hud-compass">
      ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((d) => `<span data-dir="${d}" class="hud-compass-dir">${d}</span>`).join('')}
    </div>
    <div id="hud-damage-numbers" class="hud-damage-numbers"></div>
    <button id="hud-respawn" type="button" class="hud-respawn-btn">RESPAWN</button>
  `;
  document.body.appendChild(el);

  let respawnHandler: (() => void) | null = null;
  let healActionHandler: (() => void) | null = null;
  const respawnBtn = el.querySelector('#hud-respawn') as HTMLButtonElement;
  const healBtn = el.querySelector('#hud-heal-action') as HTMLButtonElement;
  respawnBtn.addEventListener('click', () => respawnHandler?.());
  const fireHeal = (event: Event) => {
    if (healBtn.disabled) return;
    event.preventDefault();
    healActionHandler?.();
  };
  healBtn.addEventListener('click', fireHeal);
  healBtn.addEventListener('touchstart', fireHeal, { passive: false });

  return {
    onRespawn(handler: () => void) {
      respawnHandler = handler;
    },
    onHealAction(handler: () => void) {
      healActionHandler = handler;
    },
    update(data: HUDData) {
      el.style.display = 'block';
      document.getElementById('hud-kills')!.textContent = `KILLS ${data.kills}`;
      document.getElementById('hud-targets')!.textContent = `TGT ${data.targetsHit ?? 0}`;
      document.getElementById('hud-alive')!.textContent = `ALIVE ${data.alive}`;
      document.getElementById('hud-phase')!.textContent = data.phaseLabel;
      document.getElementById('hud-timer')!.textContent = `TIME ${data.matchTimer}`;
      document.getElementById('hud-zone')!.textContent = `ZONE ${data.zoneTimer}`;
      document.getElementById('hud-health-bar')!.style.width =
        `${Math.max(0, Math.min(100, data.health))}%`;
      document.getElementById('hud-health-num')!.textContent = `${Math.round(data.health)}`;
      document.getElementById('hud-armor-bar')!.style.width =
        `${Math.max(0, Math.min(100, data.armor))}%`;
      document.getElementById('hud-armor-num')!.textContent = `${Math.round(data.armor)}`;
      document.getElementById('hud-weapon-name')!.textContent = data.weapon;
      document.getElementById('hud-ammo')!.textContent = `${data.ammo} / ${data.reserve}`;
      const reloadEl = document.getElementById('hud-reload')!;
      reloadEl.classList.toggle('is-visible', data.reloading);
      document.getElementById('hud-grenades')!.textContent = String(data.grenades);
      document.getElementById('hud-heals')!.textContent = String(data.heals);
      if (data.skillName) {
        document.getElementById('hud-skill-name')!.textContent = `SKILL ${data.skillName}`;
        const statusEl = document.getElementById('hud-skill-status')!;
        statusEl.textContent = data.skillCooldownText || 'READY';
        statusEl.classList.toggle('is-ready', !!data.skillReady);
        statusEl.classList.toggle('is-cooldown', !data.skillReady);
      }
      if (data.bearing) {
        document.querySelectorAll('#hud-compass span[data-dir]').forEach((s) => {
          const active = (s as HTMLElement).dataset.dir === data.bearing;
          s.classList.toggle('is-active', active);
        });
      }
      const stormEl = document.getElementById('hud-storm')!;
      stormEl.classList.toggle('is-visible', data.inStorm);
      const healRow = document.getElementById('hud-heal-row')!;
      if (data.healProgress > 0) {
        healRow.classList.add('is-visible');
        document.getElementById('hud-heal-bar')!.style.width =
          `${Math.round(data.healProgress * 100)}%`;
      } else {
        healRow.classList.remove('is-visible');
      }
      const promptEl = document.getElementById('hud-prompt')!;
      if (data.prompt) {
        promptEl.textContent = data.prompt;
        promptEl.classList.add('is-visible');
      } else {
        promptEl.classList.remove('is-visible');
      }
      healBtn.textContent = data.healActionLabel;
      healBtn.disabled = !data.healActionEnabled;
      healBtn.classList.toggle('is-disabled', !data.healActionEnabled);
      if (data.justHit) {
        const dmg = document.getElementById('hud-damage')!;
        dmg.style.opacity = '1';
        setTimeout(() => (dmg.style.opacity = '0'), 150);
      }
      respawnBtn.classList.toggle('is-visible', !!data.showRespawn);
    },
    remove() {
      el.remove();
    },
  };
}

export function addKillFeedEntry(text: string) {
  const feed = document.getElementById('hud-killfeed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = 'hud-killfeed-entry';
  entry.textContent = text;
  feed.appendChild(entry);
  setTimeout(() => entry.remove(), 4000);
}

/** Flashes an enemy-ping marker on the compass when a nearby enemy fires. */
export function addCompassPing(bearing: string) {
  const span = document.querySelector(
    `#hud-compass span[data-dir="${bearing}"]`
  ) as HTMLElement | null;
  if (!span) return;
  span.classList.add('is-ping');
  setTimeout(() => {
    if (span.isConnected) span.classList.remove('is-ping');
  }, 350);
}

/** Spawns a floating damage number at a screen position, drifting up as it fades. */
export function addDamageNumber(amount: number, x: number, y: number, isKill: boolean) {
  const host = document.getElementById('hud-damage-numbers');
  if (!host) return;
  const el = document.createElement('div');
  el.textContent = `-${Math.max(1, Math.round(amount))}`;
  el.style.cssText =
    `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);` +
    `color:${isKill ? '#f66' : '#fff'};font-size:${isKill ? 22 : 15}px;font-weight:bold;` +
    'text-shadow:0 0 6px rgba(0,0,0,0.8);transition:opacity 0.7s linear, transform 0.7s linear;pointer-events:none;';
  host.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%, -130%)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 750);
}

export interface HUDData {
  kills: number;
  targetsHit?: number;
  alive: number;
  health: number;
  armor: number;
  weapon: string;
  ammo: number;
  reserve: number;
  reloading: boolean;
  grenades: number;
  heals: number;
  matchTimer: string;
  phaseLabel: string;
  zoneTimer: string;
  healProgress: number;
  inStorm: boolean;
  justHit: boolean;
  prompt: string;
  bearing?: string;
  skillName?: string;
  skillCooldownText?: string;
  skillReady?: boolean;
  showRespawn?: boolean;
  healActionLabel: string;
  healActionEnabled: boolean;
}

export function createMinimap(onToggleFullscreen?: () => void): {
  update: (data: MinimapData) => void;
  remove: () => void;
} {
  const minimapAnchorTop = 'calc(env(safe-area-inset-top, 0px) + 12px)';
  const minimapAnchorLeft = 'calc(env(safe-area-inset-left, 0px) + 12px)';
  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.width = 160;
  canvas.height = 160;
  canvas.className = 'minimap-canvas';
  canvas.style.cssText = `position:fixed;top:${minimapAnchorTop};left:${minimapAnchorLeft};z-index:9997;`;
  canvas.addEventListener('click', () => onToggleFullscreen?.());
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let lastCanvasSize = 0;
  let lastFullscreen = false;
  const setAnchoredPosition = () => {
    canvas.style.top = minimapAnchorTop;
    canvas.style.left = minimapAnchorLeft;
    canvas.style.right = 'auto';
    canvas.style.transform = 'none';
    canvas.style.zIndex = '9997';
  };

  return {
    update(data: MinimapData) {
      const full = data.fullscreen || false;
      const base = data.size || 160;
      const size = full ? Math.min(window.innerWidth, window.innerHeight) * 0.5 : base;
      if (size !== lastCanvasSize || full !== lastFullscreen) {
        lastCanvasSize = size;
        lastFullscreen = full;
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        if (full) {
          canvas.style.top = '50%';
          canvas.style.right = '50%';
          canvas.style.transform = 'translate(50%, -50%)';
          canvas.style.zIndex = '9999';
        } else {
          setAnchoredPosition();
        }
      }
      const s = size / (data.mapExtent ?? MAP_SIZE);
      const ox = size / 2 - data.px * s;
      const oz = size / 2 - data.pz * s;
      const playerX = data.px * s + ox;
      const playerZ = data.pz * s + oz;

      ctx.fillStyle = '#080c12';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#7a8f5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(data.sx * s + ox, data.sz * s + oz, data.sr * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#4a5058';
      for (const b of data.buildings) ctx.fillRect(b.x * s + ox - 2, b.z * s + oz - 2, 4, 4);

      ctx.fillStyle = '#2f2';
      for (const l of data.loot) {
        if (l.collected) continue;
        ctx.fillRect(l.x * s + ox - 1.5, l.z * s + oz - 1.5, 3, 3);
      }

      ctx.fillStyle = '#f44';
      for (const e of data.enemies) {
        if (!e.alive) continue;
        ctx.beginPath();
        ctx.arc(e.x * s + ox, e.z * s + oz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#fc0';
      for (const a of data.airdrops || []) {
        if (a.claimed) continue;
        ctx.beginPath();
        ctx.arc(a.x * s + ox, a.z * s + oz, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#7a8f5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const aimYaw = data.aimYaw ?? data.pyaw;
      ctx.moveTo(playerX, playerZ);
      ctx.lineTo(playerX - Math.sin(aimYaw) * 15, playerZ - Math.cos(aimYaw) * 15);
      ctx.stroke();

      // Draw local player marker last, with contrast ring + core for visibility.
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9cb06e';
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 2.4, 0, Math.PI * 2);
      ctx.fill();
    },
    remove() {
      canvas.remove();
    },
  };
}

export interface MinimapData {
  px: number;
  pz: number;
  pyaw: number;
  aimYaw?: number;
  sx: number;
  sz: number;
  sr: number;
  buildings: { x: number; z: number }[];
  loot: { x: number; z: number; collected: boolean }[];
  enemies: { x: number; z: number; alive: boolean }[];
  airdrops?: { x: number; z: number; claimed: boolean }[];
  size?: number;
  mapExtent?: number;
  fullscreen?: boolean;
}
