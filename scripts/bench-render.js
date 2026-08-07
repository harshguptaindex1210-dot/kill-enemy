/**
 * Render bench (INV-1): vite preview → Play Local → median rAF fps.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

const QUALITY = process.argv[2] || 'low';
const FPS_TARGET = QUALITY === 'low' ? 30 : 60;
const FRAME_COUNT = 300;
const port = 4175;

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port)],
  {
    stdio: 'pipe',
  }
);

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

async function bench() {
  await waitForServer(`http://localhost:${port}`);
  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 576 });

    await page.goto(`http://localhost:${port}?quality=${QUALITY}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });
    await wait(500);

    const localBtn = await page.waitForSelector('#btn-local, #btn-start', { timeout: 10000 });
    await localBtn.click();
    await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 1, {
      timeout: 15000,
    });
    // Let countdown finish and match enter playing phase (bots + targets active).
    await wait(8000);

    const fps = await page.evaluate(async (frameCount) => {
      const frames = [];
      return new Promise((resolve) => {
        function tick() {
          frames.push(performance.now());
          if (frames.length < frameCount) {
            requestAnimationFrame(tick);
          } else {
            resolve(frames);
          }
        }
        requestAnimationFrame(tick);
      });
    }, FRAME_COUNT);

    if (fps.length < 2) {
      console.error('Not enough frames');
      process.exitCode = 1;
      return;
    }

    const diffs = [];
    for (let i = 1; i < fps.length; i++) {
      diffs.push(fps[i] - fps[i - 1]);
    }

    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const fpsMean = 1000 / mean;
    const fpsMedian = 1000 / median;

    console.log(`Preset: ${QUALITY}`);
    console.log(`Frames: ${fps.length}`);
    console.log(`Mean frame time: ${mean.toFixed(2)} ms (${fpsMean.toFixed(1)} fps)`);
    console.log(`Median frame time: ${median.toFixed(2)} ms (${fpsMedian.toFixed(1)} fps)`);

    if (fpsMedian < FPS_TARGET) {
      console.error(`FAIL (${QUALITY}): median fps ${fpsMedian.toFixed(1)} < ${FPS_TARGET}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS (${QUALITY}): median fps ${fpsMedian.toFixed(1)} >= ${FPS_TARGET}`);
    }
  } finally {
    await browser.close();
    server.kill();
    process.exit(process.exitCode ?? 0);
  }
}

bench().catch((err) => {
  console.error(err);
  server.kill();
  process.exit(1);
});
