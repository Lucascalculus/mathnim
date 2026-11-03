// Performance of lesson steps in a headless browser, for comparing two builds of the site (before and after a change
// to the engine): for each step, how long it takes to open, what a frame costs along its whole timeline, what a seek
// to a random moment costs, how much is painted while the learner only looks (an explore step left alone), what a
// frame costs while a handle moves, the canvas's pixels and the JS heap. Frames are timed at 1x and with the CPU
// slowed 4x (Chrome's throttling), as a slow phone would run them.
//   npm run dev                                     (and the other build on another port)
//   node apps/mathnim/tools/perf_steps.cjs <label> <base-url> [w h dpr]
// Writes /tmp/mathnim-perf/<label>.json
const { chromium } = require('playwright');
const fs = require('fs');
const [label = 'run', BASE = 'http://127.0.0.1:5173', W = '1440', H = '900', DPR = '2'] = process.argv.slice(2);
const STEPS = (process.env.STEPS || 'mpc-m4-constraints/qp-scene,mpc-m4-constraints/qp-world,eigen-pca/det,eigen-pca/det-try,ft-b3-training-eval/curve-1,mpc-m4-constraints/explicit-scene').split(',');
const OUT = process.env.PERF_DIR || '/tmp/mathnim-perf';
fs.mkdirSync(OUT, { recursive: true });
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};
const stats = (xs) => ({ n: xs.length, p50: q(xs, 0.5), p95: q(xs, 0.95), max: xs.length ? Math.max(...xs) : null, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const phone = +W < 600;
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, isMobile: phone, hasTouch: phone });
  const out = { label, base: BASE, W: +W, H: +H, dpr: +DPR, steps: [] };
  for (const s of STEPS) {
    const [lesson, step] = s.split('/');
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/lessons/${lesson}`);
    await page.waitForFunction(() => window.mathnim_view?.runtime?.lesson, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    const row = { step: s, errors };
    for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const r = await page.evaluate(async (id) => {
        const rt = window.mathnim_view.runtime;
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        if (rt.step?.id === id) await rt.goto(rt.lesson.steps[0].id); // (open it fresh)
        await sleep(200);
        globalThis.gc?.();
        const heap0 = performance.memory?.usedJSHeapSize ?? 0;
        const t0 = performance.now();
        await rt.goto(id);
        const p = rt.player;
        const open_ms = performance.now() - t0;
        if (!p) return { open_ms, player: null };
        while (!p.loaded) await sleep(20);
        const loaded_ms = performance.now() - t0;
        p.pause();
        p.stop_live?.();
        const engine = !!p.engine;
        // playback: every frame along the timeline (at most 600 of them, evenly spaced), computed and drawn
        const step = Math.max(1, Math.floor(p.total_frames / 600));
        const frames = [];
        for (let f = 0; f < p.total_frames; f += step) {
          const t = performance.now();
          p.compute_frame(f);
          p.draw();
          frames.push(performance.now() - t);
        }
        // seeks: 40 moments in a fixed pseudo-random order
        const seeks = [];
        let r = 7;
        for (let k = 0; k < 40; k++) {
          r = (r * 48271) % 2147483647;
          const f = r % Math.max(1, p.total_frames);
          const t = performance.now();
          p.compute_frame(f);
          p.draw();
          seeks.push(performance.now() - t);
        }
        // the end state, left alone for 2 s in live mode (an explore step): what is painted while nothing changes
        p.show_end();
        let painted = 0, paint_ms = 0;
        const orig = p.draw.bind(p);
        const drawn0 = p.stats?.drawn ?? 0;
        p.draw = (...a) => {
          const t = performance.now();
          orig(...a);
          paint_ms += performance.now() - t;
          painted++;
        };
        p.start_live();
        await sleep(2000);
        p.stop_live();
        p.draw = orig;
        // (the engine's draw() is called but paints nothing when nothing changed: count real paints)
        const idle_paints = engine ? (p.stats.drawn - drawn0) : painted;
        // dragging: 60 states along a path, each followed by the frame the learner sees
        const sc = p.scene, drag = [];
        const move = sc.set_state ? (k) => sc.set_state(5 + (k % 30) * 0.15, 0.2 + (k % 20) * 0.08)
          : sc.M ? (k) => sc.M.set([[1.5, 0.5 + 0.02 * k], [0.5, 1.2 - 0.015 * k]]) : null;
        if (move) {
          for (let k = 0; k < 60; k++) {
            const t = performance.now();
            move(k);
            if (engine) p.draw();
            else p.refresh();
            drag.push(performance.now() - t);
          }
        }
        globalThis.gc?.();
        const heap1 = performance.memory?.usedJSHeapSize ?? 0;
        const c = p.canvas;
        return {
          engine, open_ms, loaded_ms, duration: p.duration, total_frames: p.total_frames, canvas_px: c.width * c.height, canvas: [c.width, c.height],
          frames, seeks, idle_paints_per_s: idle_paints / 2, idle_paint_ms_per_s: paint_ms / 2 * (engine ? (idle_paints ? 1 : 0) : 1), drag, heap_mb: (heap1 - heap0) / 1e6, heap_total_mb: heap1 / 1e6,
        };
      }, step);
      row[`x${rate}`] = {
        ...r, frames: r.frames ? stats(r.frames) : null, seeks: r.seeks ? stats(r.seeks) : null, drag: r.drag?.length ? stats(r.drag) : null,
      };
      console.log(`${label} ${s} x${rate}: open ${r.loaded_ms?.toFixed(0)} ms, frame p95 ${row[`x${rate}`].frames?.p95?.toFixed(2)} ms, seek p95 ${row[`x${rate}`].seeks?.p95?.toFixed(2)} ms, idle ${r.idle_paints_per_s} paints/s, drag p95 ${row[`x${rate}`].drag?.p95?.toFixed(2) ?? '-'} ms, ${r.canvas?.join('x')}`);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out.steps.push(row);
    await page.close();
  }
  fs.writeFileSync(`${OUT}/${label}.json`, JSON.stringify(out, null, 1));
  await browser.close();
})();
