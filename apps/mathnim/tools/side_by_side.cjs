// Side by side: the same lesson step on two sites (before and after a port), the figure only, at the end of its
// script (or after some JS), the old on the left and the new on the right, one PNG per step. For checking a ported
// figure by eye: a port must look the same on the desktop unless a difference was asked for.
//   (both sites running: the old one from a checkout of the commit before the port)
//   node apps/mathnim/tools/side_by_side.cjs <old-base> <new-base> <out-dir> <lesson/step[@js]>... [--w 1440] [--h 900] [--dpr 2] [--lang zh]
// The JS after @ runs in the page with `p` the step's player, e.g.
//   'mpc-m4-constraints/qp-world@p.scene.set_state(7.1, 1.9); p.engine ? p.draw() : p.refresh()'
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const W = +opt('w', 1440), H = +opt('h', 900), DPR = +opt('dpr', 2), LANG = opt('lang', 'en');
const [A, B, OUT, ...specs] = args;
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, base, lesson, step, js) {
  await page.goto(`${base}/lessons/${lesson}`);
  await page.waitForFunction(() => window.mathnim_view?.runtime?.lesson, null, { timeout: 60000 });
  await page.evaluate(async ([id, js]) => {
    const rt = window.mathnim_view.runtime;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await rt.goto(id);
    const p = rt.player;
    if (!p) return;
    while (!p.loaded) await sleep(20);
    p.pause();
    p.show_end();
    if (js) new Function('p', js)(p);
  }, [step, js ?? '']);
  await page.waitForTimeout(900); // (the margin's fade-ins)
  const r = await page.evaluate(() => {
    const c = window.mathnim_view.runtime.player?.canvas;
    const b = (c?.getBoundingClientRect?.() ?? document.querySelector('canvas').getBoundingClientRect());
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  return page.screenshot({ clip: r });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await ctx.addInitScript((lang) => {
    const k = 'mathnim.settings';
    const s = JSON.parse(localStorage.getItem(k) ?? '{}');
    localStorage.setItem(k, JSON.stringify({ ...s, lang }));
  }, LANG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  for (const spec of specs) {
    const at = spec.indexOf('@');
    const [ls, js] = at < 0 ? [spec, ''] : [spec.slice(0, at), spec.slice(at + 1)];
    const [lesson, step] = ls.split('/');
    const imgs = [];
    for (const base of [A, B]) imgs.push(await loadImage(await shot(page, base, lesson, step, js)));
    const gap = 24 * DPR, head = 30 * DPR;
    const c = createCanvas(imgs[0].width + imgs[1].width + gap, Math.max(imgs[0].height, imgs[1].height) + head);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111';
    g.font = `${14 * DPR}px sans-serif`;
    g.fillText(`before: ${A}`, 4, 20 * DPR);
    g.fillText(`after: ${B}`, imgs[0].width + gap + 4, 20 * DPR);
    g.drawImage(imgs[0], 0, head);
    g.drawImage(imgs[1], imgs[0].width + gap, head);
    g.fillStyle = '#ccc';
    g.fillRect(imgs[0].width + gap / 2 - 1, head, 2, c.height - head);
    const file = path.join(OUT, `${lesson}--${step}${js ? '--' + Buffer.from(js).toString('hex').slice(0, 8) : ''}-${LANG}.png`);
    fs.writeFileSync(file, c.toBuffer('image/png'));
    console.log(file);
  }
  await browser.close();
})();
