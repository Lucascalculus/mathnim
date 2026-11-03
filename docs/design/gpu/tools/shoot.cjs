// Headless check of the lab: for each material, open it alone, play its opening, run its own test, save a shot.
// usage: node shoot.cjs <out_dir> <v> <id,id,...> [w] [h] [wait_ms]
const { chromium } = require('playwright');
const [out = 'shots', v = '1', ids = '', W = '1280', H = '800', WAIT = '1500'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 1500)); });
  p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  require('fs').mkdirSync(out, { recursive: true });
  for (const id of ids.split(',')) {
    logs.length = 0;
    await p.goto(`http://127.0.0.1:5184/?v=${v}&m=${id}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    await p.waitForTimeout(+WAIT);
    if (process.env.DEMO) { await p.evaluate(() => window.__demo()); await p.waitForTimeout(+process.env.DEMO); await p.screenshot({ path: `${out}/${id}-demo.png` }); }
    const r = await p.evaluate(async (id) => (await window.__accept([id]))[0], id).catch((e) => ({ error: String(e) }));
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${id}.png` });
    console.log(id, JSON.stringify(r), logs.length ? '\n  ' + logs.join('\n  ') : '');
  }
  await b.close();
})();
