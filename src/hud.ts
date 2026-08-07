import { MAP_SIZE } from './constants';

export function createHUD(): {
  update: (data: HUDData) => void;
  remove: () => void;
  onRespawn?: (handler: () => void) => void;
} {
  const el = document.createElement('div');
  el.id = 'game-hud';
  el.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9997;font-family:sans-serif;display:none;';
  el.innerHTML = `
    <div id="hud-top" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:24px;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:4px;color:#fff;font-size:13px;">
      <span id="hud-kills">☠️ 0</span>
      <span id="hud-targets">🎯 0</span>
      <span id="hud-alive">👥 0 Alive</span>
      <span id="hud-phase" style="color:#2dd4bf;">LOBBY</span>
      <span id="hud-timer">⏲ 0:00</span>
      <span id="hud-zone" style="color:#2dd4bf;">⏱ Zone in 0:00</span>
      <span id="hud-storm" style="display:none;color:#f44;">⚠️ STORM</span>
    </div>
    <div id="hud-prompt" style="position:absolute;bottom:160px;left:50%;transform:translateX(-50%);display:none;background:rgba(0,0,0,0.6);padding:6px 14px;border-radius:4px;color:#fff;font-size:14px;"></div>
    <div id="hud-bottom" style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;background:rgba(0,0,0,0.5);padding:8px 20px;border-radius:6px;color:#fff;">
      <div style="display:flex;flex-direction:column;gap:4px;min-width:140px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
          <span>HEALTH</span><span id="hud-health-num">100</span>
        </div>
        <div style="height:8px;width:140px;background:#1a2a3a;border-radius:4px;overflow:hidden;"><div id="hud-health-bar" style="height:100%;width:100%;background:#2dd4bf;border-radius:4px;transition:width 0.2s;"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
          <span>ARMOR</span><span id="hud-armor-num">0</span>
        </div>
        <div style="height:6px;width:140px;background:#1a2a3a;border-radius:4px;overflow:hidden;"><div id="hud-armor-bar" style="height:100%;width:0%;background:#38bdf8;border-radius:4px;transition:width 0.2s;"></div></div>
        <div id="hud-heal-row" style="display:none;height:5px;width:140px;background:#333;border-radius:4px;overflow:hidden;"><div id="hud-heal-bar" style="height:100%;width:0%;background:#ffaa44;border-radius:4px;"></div></div>
      </div>
      <div id="hud-weapon" style="text-align:center;">
        <div id="hud-weapon-name" style="font-size:13px;font-weight:bold;">RIFLE</div>
        <div id="hud-ammo" style="font-size:11px;color:#aaa;">30 / 90</div>
        <div id="hud-reload" style="font-size:11px;color:#fa0;display:none;">RELOADING...</div>
      </div>
      <div id="hud-skill" style="text-align:center;font-size:11px;background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.35);padding:4px 8px;border-radius:4px;">
        <div id="hud-skill-name" style="font-weight:bold;color:#2dd4bf;">⚡ Speed [F]</div>
        <div id="hud-skill-status" style="font-size:10px;color:#34d399;">READY</div>
      </div>
      <div style="text-align:center;font-size:11px;color:#aaa;">
        <div>💣 <span id="hud-grenades">2</span></div>
        <div>💊 <span id="hud-heals">3</span></div>
      </div>
    </div>
    <div id="hud-killfeed" style="position:absolute;top:64px;left:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;max-width:min(240px,calc(100vw - 200px));"></div>
    <div id="hud-damage" style="position:absolute;inset:0;background:radial-gradient(transparent 50%, rgba(255,0,0,0.4) 100%);opacity:0;transition:opacity 0.1s;pointer-events:none;"></div>
    <div id="hud-compass" style="position:absolute;top:56px;left:50%;transform:translateX(-50%);display:flex;gap:5px;background:rgba(0,0,0,0.45);padding:3px 10px;border-radius:4px;font-size:12px;">
      ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((d) => `<span data-dir="${d}" style="color:#889;min-width:15px;text-align:center;">${d}</span>`).join('')}
    </div>
    <div id="hud-damage-numbers" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;"></div>
    <button id="hud-respawn" type="button" style="display:none;position:absolute;bottom:120px;left:50%;transform:translateX(-50%);pointer-events:auto;padding:14px 32px;font-size:16px;font-weight:bold;background:linear-gradient(180deg,#5eead4,#14b8a6);color:#042f2e;border:none;border-radius:8px;cursor:pointer;box-shadow:0 8px 24px rgba(45,212,191,0.35);letter-spacing:0.06em;z-index:10002;">RESPAWN</button>
  `;
  document.body.appendChild(el);

  let respawnHandler: (() => void) | null = null;
  const respawnBtn = el.querySelector('#hud-respawn') as HTMLButtonElement;
  respawnBtn.addEventListener('click', () => respawnHandler?.());

  return {
    onRespawn(handler: () => void) {
      respawnHandler = handler;
    },
    update(data: HUDData) {
      el.style.display = 'block';
      document.getElementById('hud-kills')!.textContent = `☠️ ${data.kills}`;
      document.getElementById('hud-targets')!.textContent = `🎯 ${data.targetsHit ?? 0}`;
      document.getElementById('hud-alive')!.textContent = `👥 ${data.alive} Alive`;
      document.getElementById('hud-phase')!.textContent = data.phaseLabel;
      document.getElementById('hud-timer')!.textContent = `⏲ ${data.matchTimer}`;
      document.getElementById('hud-zone')!.textContent = `⏱ Zone in ${data.zoneTimer}`;
      document.getElementById('hud-health-bar')!.style.width =
        `${Math.max(0, Math.min(100, data.health))}%`;
      document.getElementById('hud-health-num')!.textContent = `${Math.round(data.health)}`;
      document.getElementById('hud-armor-bar')!.style.width =
        `${Math.max(0, Math.min(100, data.armor))}%`;
      document.getElementById('hud-armor-num')!.textContent = `${Math.round(data.armor)}`;
      document.getElementById('hud-weapon-name')!.textContent = data.weapon;
      document.getElementById('hud-ammo')!.textContent = `${data.ammo} / ${data.reserve}`;
      const reloadEl = document.getElementById('hud-reload')!;
      reloadEl.style.display = data.reloading ? 'block' : 'none';
      document.getElementById('hud-grenades')!.textContent = String(data.grenades);
      document.getElementById('hud-heals')!.textContent = String(data.heals);
      if (data.skillName) {
        document.getElementById('hud-skill-name')!.textContent = `⚡ ${data.skillName}`;
        const statusEl = document.getElementById('hud-skill-status')!;
        statusEl.textContent = data.skillCooldownText || 'READY';
        statusEl.style.color = data.skillReady ? '#34d399' : '#fbbf24';
      }
      if (data.bearing) {
        document.querySelectorAll('#hud-compass span[data-dir]').forEach((s) => {
          const active = (s as HTMLElement).dataset.dir === data.bearing;
          (s as HTMLElement).style.color = active ? '#fff' : '#889';
          (s as HTMLElement).style.fontWeight = active ? 'bold' : 'normal';
        });
      }
      const stormEl = document.getElementById('hud-storm')!;
      stormEl.style.display = data.inStorm ? 'block' : 'none';
      const healRow = document.getElementById('hud-heal-row')!;
      if (data.healProgress > 0) {
        healRow.style.display = 'block';
        document.getElementById('hud-heal-bar')!.style.width =
          `${Math.round(data.healProgress * 100)}%`;
      } else {
        healRow.style.display = 'none';
      }
      const promptEl = document.getElementById('hud-prompt')!;
      if (data.prompt) {
        promptEl.textContent = data.prompt;
        promptEl.style.display = 'block';
      } else {
        promptEl.style.display = 'none';
      }
      if (data.justHit) {
        const dmg = document.getElementById('hud-damage')!;
        dmg.style.opacity = '1';
        setTimeout(() => (dmg.style.opacity = '0'), 150);
      }
      respawnBtn.style.display = data.showRespawn ? 'block' : 'none';
      respawnBtn.style.zIndex = data.showRespawn ? '10002' : '';
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
  entry.style.cssText =
    'background:rgba(0,0,0,0.6);padding:3px 10px;border-radius:3px;color:#c4121a;font-size:12px;font-weight:bold;text-shadow:0 0 4px #6b0505;';
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
  span.style.color = '#f66';
  setTimeout(() => {
    if (span.isConnected) span.style.color = '#889';
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
}

export function createMinimap(onToggleFullscreen?: () => void): {
  update: (data: MinimapData) => void;
  remove: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.width = 160;
  canvas.height = 160;
  canvas.style.cssText =
    'position:fixed;top:14px;right:12px;z-index:9997;border:2px solid rgba(45,212,191,0.45);border-radius:4px;background:#0f1f35;cursor:pointer;transition:all 0.2s;';
  canvas.addEventListener('click', () => onToggleFullscreen?.());
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let lastCanvasSize = 0;
  let lastFullscreen = false;

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
          canvas.style.top = '14px';
          canvas.style.right = '12px';
          canvas.style.transform = 'none';
          canvas.style.zIndex = '9997';
        }
      }
      const s = size / (data.mapExtent ?? MAP_SIZE);
      const ox = size / 2 - data.px * s;
      const oz = size / 2 - data.pz * s;

      ctx.fillStyle = '#0f1f35';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(data.sx * s + ox, data.sz * s + oz, data.sr * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#555';
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

      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(ox, oz, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const aimYaw = data.aimYaw ?? data.pyaw;
      ctx.moveTo(ox, oz);
      ctx.lineTo(ox - Math.sin(aimYaw) * 15, oz - Math.cos(aimYaw) * 15);
      ctx.stroke();
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
