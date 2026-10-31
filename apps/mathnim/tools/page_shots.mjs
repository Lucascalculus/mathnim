// Drive the running site in a headless Chrome and screenshot it: the way to
// check a page, a flow or an animation without a browser window (open the
// site with `npm run dev` first). Steps are a JSON list run in order:
//   { "eval": "js", "print": true }   run JS in the page (awaited), print the result
//   { "mouse": [["mousePressed", x, y, waitMs], ...] }   real mouse events
//   { "wait": ms }
//   { "shot": "name", "clip": [x, y, w, h] }   save <outdir>/<name>.png (clip in page coordinates)
//   { "api_delay": ms }   from now on hold every /api/ request this long, as a distant server would (0: off)
// Usage:
//   node tools/page_shots.mjs <url> <outdir> <width> <height> <steps.json>   (DPR=2 for a retina screen)
// A fresh browser profile each run (empty localStorage): seed state with an "eval" step, then reload.
// Chrome is found from $CHROME, else Playwright's cached Chromium, else the installed Google Chrome.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, outdir, w = '1440', h = '900', steps_file] = process.argv.slice(2);
if (!url || !outdir || !steps_file) {
  console.error('usage: node tools/page_shots.mjs <url> <outdir> <width> <height> <steps.json>');
  process.exit(2);
}
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      for (const p of [`${d}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, `${d}/chrome-mac/Chromium.app/Contents/MacOS/Chromium`, `${d}/chrome-linux/chrome`]) {
        if (existsSync(path.join(cache, p))) return path.join(cache, p);
      }
    }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']) if (existsSync(p)) return p;
  throw new Error('no Chrome found: set $CHROME');
}
const steps = JSON.parse(readFileSync(steps_file, 'utf8'));
mkdirSync(outdir, { recursive: true });
const profile = mkdtempSync(path.join(os.tmpdir(), 'mathnim-shots-'));
const port = 9300 + Math.floor(Math.random() * 500);
const browser = spawn(chrome(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 80 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    await sleep(100);
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0, api_delay = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d.result ?? d.error);
    pending.delete(d.id);
  } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  else if (d.method === 'Fetch.requestPaused') setTimeout(() => void send('Fetch.continueRequest', { requestId: d.params.requestId }), api_delay);
  else if (d.method === 'Runtime.exceptionThrown') logs.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`);
};
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id;
  pending.set(i, r);
  ws.send(JSON.stringify({ id: i, method, params }));
});
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +(process.env.DPR ?? 1), mobile: +w < 700 });
await send('Page.navigate', { url });
await sleep(2500);
for (const s of steps) {
  if (s.eval) {
    const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true });
    if (s.print) console.log(JSON.stringify(r.result?.value ?? r));
  }
  if (s.mouse) {
    for (const [type, x, y, ms] of s.mouse) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
      if (ms) await sleep(ms);
    }
  }
  if (s.api_delay !== undefined) {
    api_delay = s.api_delay;
    await send(api_delay ? 'Fetch.enable' : 'Fetch.disable', api_delay ? { patterns: [{ urlPattern: '*/api/*' }] } : {});
  }
  if (s.wait) await sleep(s.wait);
  if (s.shot) {
    const params = { format: 'png' };
    if (s.clip) params.clip = { x: s.clip[0], y: s.clip[1], width: s.clip[2], height: s.clip[3], scale: 1 };
    const shot = await send('Page.captureScreenshot', params);
    writeFileSync(path.join(outdir, `${s.shot}.png`), Buffer.from(shot.data, 'base64'));
  }
}
if (logs.length) console.log(`console:\n${logs.slice(0, 20).join('\n')}`);
ws.close();
browser.kill();
