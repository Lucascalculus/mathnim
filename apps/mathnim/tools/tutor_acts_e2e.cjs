// End to end: the tutor acts in the figure on screen. A lesson step with an engine figure is opened, a question is
// asked in the margin, and the model's reply is played back from here (the /api/ai route is answered by this script:
// no key, no model) with ACT lines after the words. Checks: the words show without the ACT lines, the figure's state
// moves to what the tutor set, the light and the note are drawn, the history under the answer lists what was done,
// "Put it back" restores the state, and an act naming a thing the figure does not have is not done. Screenshots too.
//   (the site running)  node apps/mathnim/tools/tutor_acts_e2e.cjs [base-url] [out-dir] [lang]
const { chromium } = require('playwright');
const fs = require('fs');
const [BASE = 'http://127.0.0.1:5173', OUT = '/tmp/mathnim-tutor-acts', LANG = 'en'] = process.argv.slice(2);
const LESSON = 'mpc-m4-constraints', STEP = 'qp-world';
fs.mkdirSync(OUT, { recursive: true });

const WORDS = {
  en: 'Near the wall the **wall line** binds: the best plan sits on it, as far right as the line allows. Watch the dot slide along it as the cart starts closer.',
  zh: '靠近墙时，**墙那条线**起作用：最优计划就落在这条线上，在它允许的范围里尽量靠右。看小车起点更靠近墙时，这个点怎样沿着线滑动。',
};
const NOTE = { en: 'on the wall line', zh: '在墙线上' };
const reply = (lang) => `DIAGNOSIS: why the best plan sits on a line\n${WORDS[lang]}\nACT: set p0 9.3\nACT: point best\nACT: note best ${NOTE[lang]}\nACT: point Dot12`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((lang) => localStorage.setItem('mathnim.settings', JSON.stringify({ lang, provider: 'gift' })), LANG);
  const page = await ctx.newPage();
  const errors = [], sent = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // the server has a model (as far as the page can tell), and the model is played back: the tutor's words stream with
  // their acts; no picture for this question
  await page.route('**/api/providers', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"anthropic":false,"deepseek":true}' }));
  await page.route('**/api/ai', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push(body);
    if (body.op === 'tutor') {
      const text = reply(LANG), parts = text.match(/[\s\S]{1,24}/g);
      const sse = parts.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse });
    }
    if (body.op === 'plan') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"visual":"none","reason":"words answer it"}' } }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '' } }] }) });
  });
  await page.goto(`${BASE}/lessons/${LESSON}`);
  await page.waitForFunction(() => window.mathnim_view?.runtime?.lesson, null, { timeout: 60000 });
  await page.evaluate(async (id) => {
    const rt = window.mathnim_view.runtime;
    await rt.goto(id);
    while (!rt.player?.loaded) await new Promise((r) => setTimeout(r, 30));
  }, STEP);
  await page.waitForTimeout(2500); // (the setup plays)
  const before = await page.evaluate(() => window.mathnim_view.runtime.player.scene.report());
  await page.fill('.rail-talk .mn-input', LANG === 'zh' ? '为什么最优计划落在线上？' : 'Why does the best plan sit on a line?');
  await page.press('.rail-talk .mn-input', 'Enter');
  // the light comes up after the move (0.9 s) and stays ~2.6 s: look while it is on
  try {
    await page.waitForFunction(() => document.querySelectorAll('.mn-acts .mn-act').length >= 2, null, { timeout: 20000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/stuck-${LANG}.png` });
    console.log('stuck: sent', JSON.stringify(sent.map((b) => b.op)), 'card:', await page.evaluate(() => [...document.querySelectorAll('.mn-card')].map((c) => c.textContent.slice(0, 300)).join(' || ')), errors.join(' | '));
    throw e;
  }
  await page.waitForTimeout(400);
  const during = await page.evaluate(() => {
    const p = window.mathnim_view.runtime.player, f = p.scene, h = f.hands();
    return { report: f.report(), light: h.light.level.peek(), light_box: h.light.box, note: f.registry.get('tutor_note').box, history: h.history.map((r) => [r.act.op, r.ok, r.why || '']) };
  });
  await page.screenshot({ path: `${OUT}/acting-${LANG}.png` });
  const canvas = await page.evaluate(() => { const b = window.mathnim_view.runtime.player.canvas.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  await page.screenshot({ path: `${OUT}/acting-figure-${LANG}.png`, clip: canvas });
  await page.waitForFunction(() => document.querySelectorAll('.mn-acts .mn-act').length >= 3, null, { timeout: 20000 });
  const card = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.mn-card')].pop();
    return { text: c.querySelector('.mn-answer-text')?.textContent ?? '', acts: [...c.querySelectorAll('.mn-act')].map((x) => x.textContent), back: !!c.querySelector('.mn-act-back') };
  });
  await page.click('.mn-act-back');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.mathnim_view.runtime.player.scene.report());
  const tutor_req = sent.find((b) => b.op === 'tutor');
  const checks = {
    'the question carried the figure (things and what the hand can move)': !!tutor_req?.input?.context?.figure?.params?.some((p) => p.name === 'p0'),
    'the words show without ACT lines': card.text.length > 40 && !/ACT\s*:/.test(card.text),
    'the state moved to what the tutor set (p0 = 9.3)': Math.abs(during.report.p0 - 9.3) < 1e-9,
    'the light is drawn on the best plan': during.light > 0.5 && during.light_box.w > 0,
    'the note is drawn': during.note.w > 0,
    'the history lists the three acts done': card.acts.length === 3,
    "an act naming a thing the figure lacks is not done ('Dot12')": !during.history.some((r) => JSON.stringify(r).includes('Dot12') && r[1]),
    '"Put it back" was offered and restored the state': card.back && Math.abs(after.p0 - before.p0) < 1e-9 && Math.abs(after.v0 - before.v0) < 1e-9,
    'no page errors': errors.length === 0,
  };
  for (const [k, v] of Object.entries(checks)) console.log(`${v ? 'ok  ' : 'FAIL'} ${k}`);
  console.log('history:', JSON.stringify(during.history), '\nacts:', JSON.stringify(card.acts), errors.length ? `\nerrors: ${errors.join(' | ')}` : '');
  fs.writeFileSync(`${OUT}/result-${LANG}.json`, JSON.stringify({ checks, before, during, after, card, errors }, null, 1));
  await browser.close();
  process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
})();
