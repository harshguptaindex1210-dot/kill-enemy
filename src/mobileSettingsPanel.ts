import type { Settings } from './settings';
import { MAP_IDS, mapPreset } from './mapPresets';

export interface MobileSettingsPanelOptions {
  getSettings: () => Settings;
  onChange: (changes: Partial<Settings>) => void;
}

const PANEL_ID = 'mobile-settings-panel';

export function openMobileSettingsPanel(options: MobileSettingsPanelOptions): void {
  document.getElementById(PANEL_ID)?.remove();
  const s = options.getSettings();
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'mobile-settings-panel';
  panel.innerHTML = buildPanelHtml(s);
  document.body.appendChild(panel);

  const close = () => panel.remove();
  panel.querySelector('.mobile-settings-backdrop')?.addEventListener('click', close);
  panel.querySelector('#ms-close')?.addEventListener('click', close);

  const wire = (id: string, field: keyof Settings) => {
    const el = panel.querySelector(`#${id}`) as HTMLSelectElement | null;
    if (!el) return;
    el.addEventListener('change', () => {
      let value: string | number | boolean = el.value;
      if (
        field === 'sensitivity' ||
        field === 'volume' ||
        field === 'touchSensitivityX' ||
        field === 'touchSensitivityY' ||
        field === 'hudOpacity' ||
        field === 'hudScale'
      ) {
        value = parseFloat(el.value);
      } else if (
        field === 'invertLookHorizontal' ||
        field === 'invertLookVertical' ||
        field === 'leftFireButton' ||
        field === 'gyroAim'
      ) {
        value = el.value === 'true';
      }
      options.onChange({ [field]: value } as Partial<Settings>);
    });
  };

  const wireRange = (id: string, field: keyof Settings, suffix = '') => {
    const input = panel.querySelector(`#${id}`) as HTMLInputElement | null;
    const valueEl = panel.querySelector(`#${id}-value`);
    if (!input) return;
    const push = () => {
      const v = parseFloat(input.value);
      if (valueEl) valueEl.textContent = `${v.toFixed(2)}${suffix}`;
      options.onChange({ [field]: v } as Partial<Settings>);
    };
    input.addEventListener('input', push);
    input.addEventListener('change', push);
  };

  wire('ms-quality', 'quality');
  wire('ms-map', 'mapId');
  wire('ms-sensitivity', 'sensitivity');
  wireRange('ms-touch-sens-x', 'touchSensitivityX', 'x');
  wireRange('ms-touch-sens-y', 'touchSensitivityY', 'x');
  wire('ms-camera', 'cameraMode');
  wire('ms-invert-h', 'invertLookHorizontal');
  wire('ms-invert-v', 'invertLookVertical');
  wire('ms-left-fire', 'leftFireButton');
  wire('ms-touch-sprint', 'touchSprintMode');
  wire('ms-touch-buttons', 'touchButtonPreset');
  wire('ms-touch-layout', 'touchLayoutPreset');
  wire('ms-minimap', 'minimapSize');
  wireRange('ms-hud-opacity', 'hudOpacity');
  wireRange('ms-hud-scale', 'hudScale', 'x');
  wire('ms-volume', 'volume');
}

function buildPanelHtml(s: Settings): string {
  const sel = (id: string, opts: [string, string][], cur: string) =>
    `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const row = (label: string, control: string) =>
    `<label class="mobile-settings-row"><span>${label}</span>${control}</label>`;
  const range = (id: string, value: number, min: number, max: number, step: number, suffix = '') =>
    `<span class="mobile-settings-range"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /><b id="${id}-value">${value.toFixed(2)}${suffix}</b></span>`;
  const toggle = (id: string, checked: boolean) =>
    sel(
      id,
      [
        ['false', 'Off'],
        ['true', 'On'],
      ],
      String(checked)
    );

  return `<div class="mobile-settings-backdrop"></div><div class="mobile-settings-sheet" role="dialog" aria-label="Settings"><header class="mobile-settings-header"><b>SETTINGS</b><button id="ms-close" type="button" aria-label="Close">✕</button></header><div class="mobile-settings-body">${row('Map', sel('ms-map', MAP_IDS.map((id) => [id, mapPreset(id).label]), s.mapId))}${row('Quality', sel('ms-quality', [['low', 'Low'], ['medium', 'Med'], ['high', 'High']], s.quality))}${row('Sensitivity', sel('ms-sensitivity', [['0.5', '0.5x'], ['1', '1x'], ['1.5', '1.5x'], ['2', '2x']], String(s.sensitivity)))}${row('Touch X', range('ms-touch-sens-x', s.touchSensitivityX, 0.35, 3, 0.05, 'x'))}${row('Touch Y', range('ms-touch-sens-y', s.touchSensitivityY, 0.35, 3, 0.05, 'x'))}${row('Camera', sel('ms-camera', [['tps', 'TPS'], ['fps', 'FPS']], s.cameraMode))}${row('Invert H', toggle('ms-invert-h', s.invertLookHorizontal))}${row('Invert V', toggle('ms-invert-v', s.invertLookVertical))}${row('Left Fire', toggle('ms-left-fire', s.leftFireButton))}${row('Sprint', sel('ms-touch-sprint', [['auto', 'Auto'], ['hold', 'Hold']], s.touchSprintMode))}${row('Buttons', sel('ms-touch-buttons', [['compact', 'Compact'], ['standard', 'Std']], s.touchButtonPreset))}${row('Layout', sel('ms-touch-layout', [['thumbs', 'Thumbs'], ['classic', 'Classic']], s.touchLayoutPreset))}${row('Minimap', sel('ms-minimap', [['small', 'Small'], ['large', 'Large']], s.minimapSize))}${row('HUD Alpha', range('ms-hud-opacity', s.hudOpacity, 0.35, 1, 0.05))}${row('HUD Scale', range('ms-hud-scale', s.hudScale, 0.8, 1.3, 0.05, 'x'))}${row('Volume', sel('ms-volume', [['0', 'Mute'], ['0.5', 'Med'], ['1', 'Max']], String(s.volume)))}</div></div>`;
}
