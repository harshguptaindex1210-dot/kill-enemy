export function createHUD(): { update: (data: HUDData) => void; remove: () => void } {
  const el = document.createElement('div');
  el.id = 'game-hud';
  el.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9997;font-family:sans-serif;display:none;';
  el.innerHTML = `
    <div id="hud-top" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:24px;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:4px;color:#fff;font-size:13px;">
      <span id="hud-kills">☠️ 0</span>
      <span id="hud-alive">👥 0 Alive</span>
      <span id="hud-phase" style="color:#8af;">LOBBY</span>
      <span id="hud-timer">⏲ 0:00</span>
      <span id="hud-zone" style="color:#8af;">⏱ 0:00</span>
      <span id="hud-storm" style="display:none;color:#f44;">⚠️ STORM</span>
    </div>
    <div id="hud-prompt" style="position:absolute;bottom:160px;left:50%;transform:translateX(-50%);display:none;background:rgba(0,0,0,0.6);padding:6px 14px;border-radius:4px;color:#fff;font-size:14px;"></div>
    <div id="hud-bottom" style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;background:rgba(0,0,0,0.5);padding:8px 20px;border-radius:6px;color:#fff;">
      <div style="display:flex;flex-direction:column;gap:4px;min-width:140px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
          <span>HEALTH</span><span id="hud-health-num">100</span>
        </div>
        <div style="height:8px;width:140px;background:#333;border-radius:4px;overflow:hidden;"><div id="hud-health-bar" style="height:100%;width:100%;background:#4f4;border-radius:4px;transition:width 0.2s;"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;">
          <span>ARMOR</span><span id="hud-armor-num">0</span>
        </div>
        <div style="height:6px;width:140px;background:#333;border-radius:4px;overflow:hidden;"><div id="hud-armor-bar" style="height:100%;width:0%;background:#49f;border-radius:4px;transition:width 0.2s;"></div></div>
        <div id="hud-heal-row" style="display:none;height:5px;width:140px;background:#333;border-radius:4px;overflow:hidden;"><div id="hud-heal-bar" style="height:100%;width:0%;background:#ffaa44;border-radius:4px;"></div></div>
      </div>
      <div id="hud-weapon" style="text-align:center;">
        <div id="hud-weapon-name" style="font-size:13px;font-weight:bold;">RIFLE</div>
        <div id="hud-ammo" style="font-size:11px;color:#aaa;">30 / 90</div>
        <div id="hud-reload" style="font-size:11px;color:#fa0;display:none;">RELOADING...</div>
      </div>
      <div style="text-align:center;font-size:11px;color:#aaa;">
        <div>💣 <span id="hud-grenades">2</span></div>
        <div>💊 <span id="hud-heals">3</span></div>
      </div>
    </div>
    <div id="hud-killfeed" style="position:absolute;top:64px;right:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-end;"></div>
    <div id="hud-damage" style="position:absolute;inset:0;background:radial-gradient(transparent 50%, rgba(255,0,0,0.4) 100%);opacity:0;transition:opacity 0.1s;pointer-events:none;"></div>
  `;
  document.body.appendChild(el);

  return {
    update(data: HUDData) {
      el.style.display = 'block';
      document.getElementById('hud-kills')!.textContent = `☠️ ${data.kills}`;
      document.getElementById('hud-alive')!.textContent = `👥 ${data.alive} Alive`;
      document.getElementById('hud-phase')!.textContent = data.phaseLabel;
      document.getElementById('hud-timer')!.textContent = `⏲ ${data.matchTimer}`;
      document.getElementById('hud-zone')!.textContent = `⏱ ${data.zoneTimer}`;
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
    'background:rgba(0,0,0,0.6);padding:3px 10px;border-radius:3px;color:#fff;font-size:12px;';
  entry.textContent = text;
  feed.appendChild(entry);
  setTimeout(() => entry.remove(), 4000);
}

export interface HUDData {
  kills: number;
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
}

export function createMinimap(): { update: (data: MinimapData) => void; remove: () => void } {
  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.width = 160;
  canvas.height = 160;
  canvas.style.cssText =
    'position:fixed;top:50px;right:12px;z-index:9997;border:2px solid rgba(255,255,255,0.3);border-radius:4px;background:#1a1a2e;cursor:pointer;transition:all 0.2s;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  return {
    update(data: MinimapData) {
      const full = data.fullscreen || false;
      const size = full ? Math.min(window.innerWidth, window.innerHeight) * 0.5 : 160;
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
        canvas.style.top = '50px';
        canvas.style.right = '12px';
        canvas.style.transform = 'none';
        canvas.style.zIndex = '9997';
      }
      const s = size / 1000;
      const ox = size / 2 - data.px * s;
      const oz = size / 2 - data.pz * s;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#9932cc';
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

      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(ox, oz, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oz);
      ctx.lineTo(ox + Math.sin(data.pyaw) * 15, oz + Math.cos(data.pyaw) * 15);
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
  sx: number;
  sz: number;
  sr: number;
  buildings: { x: number; z: number }[];
  loot: { x: number; z: number; collected: boolean }[];
  enemies: { x: number; z: number; alive: boolean }[];
  fullscreen?: boolean;
}
