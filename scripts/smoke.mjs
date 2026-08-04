import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

const port = 4173;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port)], {
  stdio: 'pipe',
});

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, tries = 30) {
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

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath:
    process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  await waitForServer(`http://localhost:${port}`);
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(1000);
  // Local bot match runs without a Nakama server, so exercise that path.
  await page.click('#btn-local');
  await wait(3000);

  const hudVisible = await page.evaluate(() => {
    const hud = document.getElementById('game-hud');
    const bodyText = document.body.innerText;
    return {
      hudExists: !!hud,
      aliveShown: bodyText.includes('Alive'),
      canvasCount: document.querySelectorAll('canvas').length,
    };
  });

  // Assert at least one render frame actually advances (INV-7 runtime check) by
  // sampling the HUD match timer twice; it increments every second.
  const timerA = await page.evaluate(() => document.getElementById('hud-timer')?.textContent ?? '');
  await wait(1500);
  const timerB = await page.evaluate(() => document.getElementById('hud-timer')?.textContent ?? '');
  const frameAdvanced = timerA !== timerB;

  console.log(JSON.stringify({ hudVisible, frameAdvanced, errors }, null, 2));

  const fatal = errors.filter(
    (e) =>
      !e.includes('WebGL') &&
      !e.includes('GPU') &&
      !e.includes('canvas.getContext') &&
      !e.includes('Failed to load resource')
  );
  const renderOk = hudVisible.hudExists && hudVisible.aliveShown && frameAdvanced;
  if (fatal.length > 0) {
    console.error('SMOKE FAILED: console/page errors');
    process.exitCode = 1;
  } else if (!renderOk) {
    console.error('SMOKE FAILED: HUD/game did not render or advance a frame');
    process.exitCode = 1;
  } else {
    console.log('SMOKE OK');
  }
} finally {
  await browser.close();
  server.kill();
  process.exit();
}
