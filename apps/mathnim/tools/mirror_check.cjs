// The DOM mirror over an engine figure, in the real page: the layer covers the canvas; it reads in order and names
// the marks; its words sit where the canvas draws them (a screenshot with the words made visible in red, over the
// figure); a handle is a slider the keyboard moves, and the readouts are announced after; the words can be selected;
// a drag on the canvas still reaches the handle.
//   (the site running)  node apps/mathnim/tools/mirror_check.cjs [base-url] [out-dir] [lesson/step ...]
const { chromium } = require('playwright');
const fs = require('fs');
const [BASE = 'http://127.0.0.1:5173', OUT = '/tmp/mathnim-mirror', ...rest] = process.argv.slice(2);
const STEPS = rest.length ? rest : ['mpc-m4-constraints/qp-world', 'eigen-pca/det-try', 'ft-b3-training-eval/curve-1'];
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const lang of ['en', 'zh']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((l) => localStorage.setItem('mathnim.settings', JSON.stringify({ lang: l })), lang);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const s of STEPS) {
      const [lesson, step] = s.split('/');
      await page.goto(`${BASE}/lessons/${lesson}`);
      await page.waitForFunction(() => window.mathnim_view?.runtime?.lesson, null, { timeout: 60000 });
      await page.evaluate(async (id) => {
        const rt = window.mathnim_view.runtime;
        await rt.goto(id);
        while (!rt.player?.loaded) await new Promise((r) => setTimeout(r, 30));
        rt.player.show_end();
        rt.player.draw(true);
      }, step);
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const p = window.mathnim_view.runtime.player, m = p.mirror;
        if (!m) return { none: true };
        const c = p.canvas.getBoundingClientRect(), l = m.root.getBoundingClientRect();
        return { cover: [Math.abs(c.x - l.x), Math.abs(c.y - l.y), Math.abs(c.width - l.width), Math.abs(c.height - l.height)], text: m.text(), sliders: m.root.querySelectorAll('[role=slider]').length, hidden: p.canvas.getAttribute('aria-hidden') };
      });
      const checks = {};
      checks['a mirror is made'] = !r.none;
      if (!r.none) {
        checks['it covers the canvas'] = r.cover.every((d) => d < 1.5);
        checks['it says something in reading order'] = r.text.length >= 3;
        checks['the canvas is hidden from screen readers (the mirror speaks for it)'] = r.hidden === 'true';
      }
      // the words made visible, over the figure: they must sit on the drawn words
      await page.addStyleTag({ content: '.mn-mirror .mn-m-t{color:rgba(220,0,0,.55)!important;outline:1px solid rgba(220,0,0,.35)} .mn-mirror .mn-m-m{outline:1px dashed rgba(0,120,255,.6)}' });
      const clip = await page.evaluate(() => { const b = window.mathnim_view.runtime.player.canvas.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
      await page.screenshot({ path: `${OUT}/${lesson}--${step}-${lang}.png`, clip });
      await page.evaluate(() => document.querySelectorAll('style').forEach((st) => st.textContent.includes('rgba(220,0,0') && st.remove()));
      // selection copies the words
      const sel = await page.evaluate(() => {
        const el = window.mathnim_view.runtime.player.mirror?.root.querySelector('.mn-m-t');
        if (!el) return '';
        const range = document.createRange();
        range.selectNodeContents(el);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        const s = getSelection().toString();
        getSelection().removeAllRanges();
        return s;
      });
      checks['the words can be selected'] = sel.length > 0;
      // a handle as a slider: the arrow keys move it, and the readouts are announced after
      if (r.sliders) {
        const k = await page.evaluate(async () => {
          const p = window.mathnim_view.runtime.player, sl = p.mirror.root.querySelector('[role=slider]');
          const before = sl.getAttribute('aria-valuetext');
          sl.focus();
          sl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          sl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          await new Promise((res) => setTimeout(res, 1100));
          return { before, after: sl.getAttribute('aria-valuetext'), live: p.mirror.root.querySelector('[aria-live]').textContent, focused: document.activeElement === sl };
        });
        checks['the arrow keys move the slider'] = k.before !== k.after && k.focused;
        checks['the readouts are announced after a move'] = k.live.length > 0 || !(await page.evaluate(() => window.mathnim_view.runtime.player.scene.registry.all().some((t) => t.kind === 'readout' && t.visible())));
        // a drag on the canvas still reaches the handle (the layer lets it through)
        const drag = await page.evaluate(() => {
          const p = window.mathnim_view.runtime.player, h = p.scene.handles[0], [x, y] = h.center(), k = p.canvas.getBoundingClientRect().width / p.scene.frame.w;
          const r = p.canvas.getBoundingClientRect();
          return { x: r.x + x * k, y: r.y + y * k, before: [h.px.peek(), h.py?.peek()] };
        });
        await page.mouse.move(drag.x, drag.y);
        await page.mouse.down();
        await page.mouse.move(drag.x - 40, drag.y + 20, { steps: 5 });
        await page.mouse.up();
        const moved = await page.evaluate(() => { const h = window.mathnim_view.runtime.player.scene.handles[0]; return [h.px.peek(), h.py?.peek()]; });
        checks['a drag on the canvas still moves the handle'] = moved[0] !== drag.before[0] || moved[1] !== drag.before[1];
      }
      checks['no page errors'] = errors.length === 0;
      for (const [name, ok] of Object.entries(checks)) {
        if (!ok) bad++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} [${lang}] ${s}: ${name}`);
      }
      console.log(`     reads: ${JSON.stringify((r.text || []).slice(0, 14))}${(r.text || []).length > 14 ? ' …' : ''}`);
    }
    await ctx.close();
  }
  await browser.close();
  process.exitCode = bad ? 1 : 0;
})();
