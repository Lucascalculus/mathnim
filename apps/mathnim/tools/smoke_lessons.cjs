// Walk every step of every lesson in a headless browser and record what happens: load time, console errors,
// page errors, whether a figure was drawn, and a screenshot of each figure's end state. Run it before and after a
// change and compare the two reports (node tools/smoke_compare.cjs a.json b.json).
//   npm run dev   (in another shell)
//   node apps/mathnim/tools/smoke_lessons.cjs <label> [width] [height] [only-lesson-id,...]
// Writes /tmp/mathnim-smoke/<label>/report.json and <label>/<lesson>/<step>.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [label = 'run', W = '1440', H = '900', only = ''] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://127.0.0.1:5173';
const OUT = path.join(process.env.SMOKE_DIR || '/tmp/mathnim-smoke', label);
fs.mkdirSync(OUT, { recursive: true });
const phone = +W < 600;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  let errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 400)));
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);
  // every lesson of every course, as the site lists them
  const lessons = await page.evaluate(async () => {
    const c = await import('/src/course.ts');
    await c.load_all_lessons();
    const out = [];
    for (const course of c.COURSES) for (const l of c.visible_lessons(course)) out.push({ id: l.id, path: c.lesson_path(l.id), course: course.id });
    return out;
  });
  const pick = only ? lessons.filter((l) => only.split(',').includes(l.id)) : lessons;
  const report = { label, W: +W, H: +H, started: new Date().toISOString(), lessons: [] };
  for (const l of pick) {
    errors = [];
    const t0 = Date.now();
    const row = { id: l.id, course: l.course, steps: [], open_ms: 0, errors: [] };
    try {
      await page.goto(BASE + l.path);
      await page.waitForFunction(() => window.mathnim_view && window.mathnim_view.runtime && window.mathnim_view.runtime.lesson, null, { timeout: 30000 });
      row.open_ms = Date.now() - t0;
      const steps = await page.evaluate(() => window.mathnim_view.runtime.lesson.steps.map((s) => ({ id: s.id, kind: s.kind })));
      fs.mkdirSync(path.join(OUT, l.id), { recursive: true });
      for (const s of steps) {
        const before = errors.length, s0 = Date.now();
        const r = await page.evaluate(async (id) => {
          const v = window.mathnim_view, rt = v.runtime;
          const t = performance.now();
          await rt.goto(id);
          const ms = performance.now() - t;
          const p = rt.player;
          let drawn = null;
          if (p) {
            try { p.show_end?.(); } catch (e) { return { ms, error: 'show_end: ' + e.message }; }
            // was anything drawn? count non-background pixels of the stage canvas
            const cv = v.el?.canvas || document.querySelector('canvas');
            try {
              const g = cv.getContext('2d');
              if (g) { const d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 0 && (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) n++; drawn = n; }
            } catch (e) { drawn = -1; }
          }
          return { ms, has_player: !!p, duration: p?.duration ?? null, drawn };
        }, s.id).catch((e) => ({ error: String(e.message || e).slice(0, 300) }));
        await page.waitForTimeout(r.has_player ? 600 : 250);
        let shot = null;
        if (r.has_player || s.kind === 'read' || s.kind === 'derive' || s.kind === 'checkpoint') {
          shot = path.join(l.id, s.id + '.png');
          await page.screenshot({ path: path.join(OUT, shot) }).catch(() => (shot = null));
        }
        row.steps.push({ ...s, ...r, wall_ms: Date.now() - s0, errors: errors.slice(before), shot });
      }
    } catch (e) {
      row.errors.push('lesson: ' + String(e.message || e).slice(0, 300));
    }
    row.errors.push(...errors.filter((x) => !row.steps.some((s) => s.errors.includes(x))));
    row.total_ms = Date.now() - t0;
    report.lessons.push(row);
    const bad = row.steps.filter((s) => s.error || s.errors.length).length;
    console.log(`${l.id}: ${row.steps.length} steps, ${bad} with errors, ${(row.total_ms / 1000).toFixed(1)} s`);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  }
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
})();
