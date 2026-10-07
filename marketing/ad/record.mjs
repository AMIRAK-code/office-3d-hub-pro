// Renders the ads to MP4 by driving the real app frame by frame.
//
//   node record.mjs                 render both cuts
//   node record.mjs landscape       render one cut (landscape | vertical)
//   node record.mjs landscape --stills=2,5,9.5   save JPG stills at those seconds (fast review)
//   node record.mjs --serve         just serve the ad page for live preview in a browser
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import config from './page/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const FPS = 30;

const CUTS = {
  landscape: { viewport: { width: 1920, height: 1080 }, scale: 1, file: 'office-3d-hub-ad-16x9.mp4' },
  vertical: { viewport: { width: 540, height: 960 }, scale: 2, file: 'office-3d-hub-ad-9x16.mp4' },
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const routes = [
    ['/ad/', path.join(HERE, 'page')],
    ['/vendor/three/build/', path.join(APP, 'node_modules/three/build')],
    ['/vendor/three/addons/', path.join(APP, 'node_modules/three/examples/jsm')],
    ['/', path.join(APP, 'public')],
  ];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    for (const [prefix, dir] of routes) {
      if (!url.startsWith(prefix)) continue;
      const file = path.normalize(path.join(dir, url.slice(prefix.length) || 'index.html'));
      if (!file.startsWith(dir)) break;
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) break;
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

async function openCut(browser, port, cut) {
  const spec = CUTS[cut];
  const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: spec.scale });
  const shim = fs.readFileSync(path.join(HERE, 'page/time-shim.js'), 'utf8');
  await context.addInitScript(shim);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [page] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
  const url = `http://127.0.0.1:${port}/ad/ad.html?cut=${cut}&record=1&date=${encodeURIComponent(config.shootDate)}`;
  await page.goto(url);
  // Let the app boot: advance virtual time until the director reports ready.
  for (let i = 0; i < 400; i++) {
    const state = await page.evaluate(() => (window.__ad?.error ? `error: ${window.__ad.error}` : window.__ad?.ready ? 'ready' : null));
    if (state === 'ready') break;
    if (state?.startsWith('error')) throw new Error(state);
    await page.evaluate(() => window.__advance(50));
    await new Promise((r) => setTimeout(r, 30));
  }
  // Warm up a few frames so textures and fonts settle before frame 0.
  for (let i = 0; i < 20; i++) await page.evaluate(() => window.__advance(1000 / 30));
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`  GPU: ${renderer}`);
  return { page, context, spec };
}

async function stills(browser, port, cut, times) {
  const { page, context } = await openCut(browser, port, cut);
  await page.evaluate(() => window.__ad.start());
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  let t = 0;
  for (const target of times.sort((a, b) => a - b)) {
    while (t < target - 1e-6) {
      await page.evaluate(() => window.__advance(1000 / 30));
      t += 1 / FPS;
    }
    const file = path.join(OUT, 'stills', `${cut}-${target.toFixed(1).padStart(4, '0')}s.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    console.log(`  still ${file}`);
  }
  await context.close();
}

/** Screenshot with retries: a sleeping laptop or GPU hiccup shouldn't kill a long render. */
async function capture(page) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await page.screenshot({ type: 'jpeg', quality: 93, timeout: 60000 });
    } catch (err) {
      if (attempt >= 4) throw err;
      console.log(`  screenshot stalled (${err.name}), retrying ${attempt}/3…`);
    }
  }
}

async function render(browser, port, cut) {
  const started = Date.now();
  const { page, context, spec } = await openCut(browser, port, cut);
  const duration = await page.evaluate(() => window.__ad.duration);
  const frames = Math.round(duration * FPS);
  fs.mkdirSync(OUT, { recursive: true });

  console.log('  rendering soundtrack…');
  const wavB64 = await page.evaluate(() => window.__ad.renderAudio());
  const wavFile = path.join(OUT, `${cut}.wav`);
  fs.writeFileSync(wavFile, Buffer.from(wavB64, 'base64'));

  const outFile = path.join(OUT, spec.file);
  const ff = spawn(ffmpegPath, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wavFile,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', // social-platform loudness
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

  await page.evaluate(() => window.__ad.start());
  for (let i = 0; i < frames; i++) {
    await page.evaluate(() => window.__advance(1000 / 30));
    const jpg = await capture(page);
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) {
      const secs = (Date.now() - started) / 1000;
      console.log(`  ${cut}: frame ${i}/${frames} (${((i / frames) * 100).toFixed(0)}%) — ${secs.toFixed(0)}s elapsed`);
    }
  }
  ff.stdin.end();
  await ffDone;
  await context.close();
  fs.rmSync(wavFile);
  console.log(`  ✓ ${outFile} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}

const args = process.argv.slice(2);
const server = await serve();
const { port } = server.address();

if (args.includes('--serve')) {
  console.log(`Preview: http://127.0.0.1:${port}/ad/ad.html?cut=landscape  (or ?cut=vertical in a 540×960 window)`);
} else {
  const exe = findChrome();
  const browser = await chromium.launch({
    executablePath: exe,
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  });
  try {
    const stillsArg = args.find((a) => a.startsWith('--stills='));
    const cuts = args.filter((a) => CUTS[a]);
    for (const cut of cuts.length ? cuts : Object.keys(CUTS)) {
      console.log(`▶ ${cut}`);
      if (stillsArg) await stills(browser, port, cut, stillsArg.slice(9).split(',').map(Number));
      else await render(browser, port, cut);
    }
  } finally {
    await browser.close();
    server.close();
  }
}
