export interface AdConfig {
  skipAfterMs: number;
  online: boolean;
}

export function showAd(config: AdConfig = { skipAfterMs: 10000, online: false }): Promise<void> {
  return new Promise((resolve) => {
    // Fail-open: if any error occurs (e.g., DOM manipulation fails), skip immediately
    try {
      const overlay = document.createElement('div');
      overlay.id = 'ad-overlay';
      overlay.style.cssText =
        'position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;';
      overlay.innerHTML = `
        <div style="color:#888;font-family:sans-serif;font-size:24px;">Advertisement</div>
        <div style="color:#555;font-family:sans-serif;font-size:14px;margin-top:12px;">(placeholder — skippable in ${config.skipAfterMs / 1000}s)</div>
      `;
      document.body.appendChild(overlay);

      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'Skip →';
      skipBtn.style.cssText =
        'margin-top:24px;padding:8px 24px;font-size:16px;cursor:pointer;opacity:0.5;transition:opacity 0.3s;';
      skipBtn.disabled = true;
      overlay.appendChild(skipBtn);

      const timer = setTimeout(() => {
        skipBtn.disabled = false;
        skipBtn.style.opacity = '1';
        skipBtn.style.cursor = 'pointer';
      }, config.skipAfterMs);

      skipBtn.onclick = () => {
        clearTimeout(timer);
        if (overlay.parentNode) overlay.remove();
        resolve();
      };
    } catch {
      // Fail-open: if any DOM error occurs, skip immediately
      resolve();
    }
  });
}
