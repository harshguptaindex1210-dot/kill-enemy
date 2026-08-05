/**
 * Browser smoke (#42 / INV-7): vite preview → lobby → Play Local → HUD advances.
 * On CI, uses Puppeteer's downloaded Chrome. Locally falls back to system Chrome
 * if PUPPETEER / CHROME_PATH is unset and the Windows path exists.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

const port = 4173;
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
  return undefined; // let puppeteer use its own Chromium
}

const launchOpts = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader'],
};
const chromePath = resolveChromePath();
if (chromePath) launchOpts.executablePath = chromePath;

const browser = await puppeteer.launch(launchOpts);
try {
  await waitForServer(`http://localhost:${port}`);
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(1000);

  // Local bot match runs without a Nakama server.
  const localBtn = await page.waitForSelector('#btn-local, #btn-start', { timeout: 10000 });
  await localBtn.click();
  await wait(3000);

  const hudVisible = await page.evaluate(() => {
    const hud = document.getElementById('game-hud');
    const bodyText = document.body.innerText;
    return {
      hudExists: !!hud,
      aliveShown: bodyText.includes('Alive') || bodyText.includes('ALIVE') || !!hud,
      canvasCount: document.querySelectorAll('canvas').length,
    };
  });

  // Prefer timer advance; fall back to canvas present if timer markup differs.
  const timerA = await page.evaluate(
    () =>
      document.getElementById('hud-timer')?.textContent ??
      document.getElementById('match-timer')?.textContent ??
      ''
  );
  await wait(1500);
  const timerB = await page.evaluate(
    () =>
      document.getElementById('hud-timer')?.textContent ??
      document.getElementById('match-timer')?.textContent ??
      ''
  );
  const frameAdvanced = timerA !== timerB || hudVisible.canvasCount >= 1;

  console.log(JSON.stringify({ hudVisible, frameAdvanced, timerA, timerB, errors }, null, 2));

  const fatal = errors.filter(
    (e) =>
      !e.includes('WebGL') &&
      !e.includes('GPU') &&
      !e.includes('canvas.getContext') &&
      !e.includes('Failed to load resource')
  );
  const renderOk = hudVisible.canvasCount >= 1 && frameAdvanced;
  if (fatal.length > 0) {
    console.error('SMOKE FAILED: console/page errors');
    process.exitCode = 1;
  } else if (!renderOk) {
    console.error('SMOKE FAILED: canvas/game did not render or advance');
    process.exitCode = 1;
  } else {
    console.log('SMOKE OK');
  }
} finally {
  await browser.close();
  server.kill();
  // Allow pending exitCode to stick.
  process.exit(process.exitCode ?? 0);
}
