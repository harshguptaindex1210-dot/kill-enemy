/**
 * Lobby viewport smoke (#47 / INV-L1, INV-L2): vite preview at phone + laptop widths.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

const port = 4174;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port)], {
  stdio: 'pipe',
});

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await wait(500);
  }
  throw new Error('server did not start');
}

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const win =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : null;
  if (win && existsSync(win)) return win;
  return undefined;
}

const launchOpts = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader'],
};
const chromePath = resolveChromePath();
if (chromePath) launchOpts.executablePath = chromePath;

async function checkViewport(page, { width, height, label }) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(800);

  return page.evaluate(
    ({ viewportHeight, viewportLabel }) => {
      const overlay = document.getElementById('lobby-overlay');
      const btnOnline = document.getElementById('btn-online');
      const doc = document.documentElement;
      const noOverflow = doc.scrollWidth <= doc.clientWidth;
      const atScrollTop = window.scrollY === 0;

      let playOnlineInFirstViewport = false;
      if (btnOnline) {
        const rect = btnOnline.getBoundingClientRect();
        const bottom = rect.top + rect.height;
        playOnlineInFirstViewport = rect.top >= 0 && bottom <= viewportHeight;
      }

      const panels = document.querySelector('.lobby-panels');
      const panelEls = panels ? Array.from(panels.querySelectorAll(':scope > .lobby-panel')) : [];
      let multiColumn = false;
      if (panelEls.length >= 2) {
        const a = panelEls[0].getBoundingClientRect();
        const b = panelEls[1].getBoundingClientRect();
        const sameRow = Math.abs(a.top - b.top) < 24;
        const sideBySide = Math.abs(a.left - b.left) > 12;
        const flexRow = panels ? getComputedStyle(panels).flexDirection === 'row' : false;
        multiColumn = (sameRow && sideBySide) || flexRow;
      }

      return {
        label: viewportLabel,
        overlayPresent: !!overlay,
        playOnlineInFirstViewport,
        atScrollTop,
        noOverflow,
        multiColumn,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      };
    },
    { viewportHeight: height, viewportLabel: label }
  );
}

const browser = await puppeteer.launch(launchOpts);
try {
  await waitForServer(`http://localhost:${port}`);
  const page = await browser.newPage();

  const phone = await checkViewport(page, { width: 390, height: 844, label: 'phone' });
  const laptop = await checkViewport(page, { width: 1280, height: 720, label: 'laptop' });

  console.log(JSON.stringify({ phone, laptop }, null, 2));

  const failures = [];
  if (!phone.overlayPresent) failures.push('phone: #lobby-overlay missing');
  if (!phone.atScrollTop) failures.push('phone: page scrolled before check');
  if (!phone.playOnlineInFirstViewport) failures.push('phone: #btn-online not in first viewport');
  if (!phone.noOverflow) failures.push('phone: horizontal overflow');
  if (!laptop.overlayPresent) failures.push('laptop: #lobby-overlay missing');
  if (!laptop.noOverflow) failures.push('laptop: horizontal overflow');
  if (!laptop.multiColumn) failures.push('laptop: panels not multi-column');

  if (failures.length > 0) {
    console.error('SMOKE:LOBBY FAILED:', failures.join('; '));
    process.exitCode = 1;
  } else {
    console.log('SMOKE:LOBBY OK');
  }
} finally {
  await browser.close();
  server.kill();
  process.exit(process.exitCode ?? 0);
}
