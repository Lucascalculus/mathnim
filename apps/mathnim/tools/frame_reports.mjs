// What every instrument in a frame tells the lesson (docs/REPORTS.md: answer, done, state), checked: each instrument in
// apps/mathnim/public/frames is opened standalone in a headless Chrome (file://, no server) with the parameters a lesson
// passes it, driven the way a learner would (a chip dropped wrong then right, a model checked wrong then right, a slider
// moved...), and its messages to the page are compared with what it should say. Both languages.
// Usage: node apps/mathnim/tools/frame_reports.mjs [name ...]   (names filter the cases: place, lp_check, flow_net, ...)
//        SHOW=1 node apps/mathnim/tools/frame_reports.mjs ...     also prints every message (to read the states as the tutor will)
// Chrome is found as in page_shots.mjs ($CHROME, Playwright's Chromium, the installed Google Chrome).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const only = process.argv.slice(2);

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

/** The params of the n-th frame block with this src in a lesson (public/demo/<course>/<lesson>.json). */
function params(course, lesson, src, n = 0) {
  const found = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.type === 'frame' && typeof o.src === 'string' && o.src.endsWith(src)) found.push(o.params ?? {});
      for (const k in o) walk(o[k]);
    }
  })(JSON.parse(readFileSync(path.join(pub, 'demo', course, `${lesson}.json`), 'utf8')));
  if (!found[n]) throw new Error(`no frame ${src} #${n} in ${lesson}`);
  return found[n];
}

// ---------------------------------------------------------------- the browser
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(path.join(os.tmpdir(), 'mathium-frames-'));
const port = 9300 + Math.floor(Math.random() * 500);
const browser = spawn(chrome(), ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=760,900', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 80 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(100); }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map(), waiters = [], errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  for (const w of waiters.splice(0)) if (w.method === d.method) w.resolve(); else waiters.push(w);
};
const send = (method, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: p })); });
const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 900, deviceScaleFactor: 1, mobile: false });
// the frame stands alone, so its parent is itself: catch what it posts to the page instead
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__mn = []; window.postMessage = function (m) { if (m && m.mn && m.mn !== 'height') window.__mn.push(JSON.parse(JSON.stringify(m))); };` });

async function ev(js) {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result?.value;
}
/** Opens an instrument the way the lesson page does (?lang=..#p=<JSON>) and waits for its first state. */
async function open(src, p, lang) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(30);
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: `${pathToFileURL(path.join(pub, 'frames', src)).href}?lang=${lang}#p=${encodeURIComponent(JSON.stringify(p))}` });
  await loaded;
  await sleep(450);
}
/** The messages posted since the last call, after the state has had time to settle (kit.js waits 350 ms). */
async function take(ms = 420) {
  await sleep(ms);
  const ms_ = await ev('window.__mn.splice(0)');
  if (process.env.SHOW) for (const m of ms_) console.log(`  ${cur} ${m.mn}: ${m.mn === 'state' ? m.text : JSON.stringify(m)}`);
  return ms_;
}
const js = (v) => JSON.stringify(v);

// ---------------------------------------------------------------- checking
let passed = 0, cur = '';
const fails = [];
function ok(cond, what) { if (cond) passed++; else fails.push(`${cur}: ${what}`); }
const answers = (ms) => ms.filter((m) => m.mn === 'answer');
const dones = (ms) => ms.filter((m) => m.mn === 'done');
const state = (ms) => ms.filter((m) => m.mn === 'state').pop()?.text ?? '';
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
/** Nothing judged (no answer, no done), and the state says each of `has`. */
function only_state(ms, has, what) {
  ok(!answers(ms).length && !dones(ms).length, `${what}: no answer or done (got ${js(ms.filter((m) => m.mn !== 'state'))})`);
  const s = state(ms);
  for (const h of has) ok(s.includes(h), `${what}: state has ${js(h)} (state: ${js(s)})`);
  return s;
}
const en = (x) => (x && typeof x === 'object' ? x.en : String(x));
const zh = (x) => (x && typeof x === 'object' ? x.zh : String(x));
const CJK = /[一-鿿]/;

// in-page helpers: a button by its text, typing into a field as a learner does (value, then an input event)
const H = `
  var btn = function (sel, text) { var b = [].slice.call(document.querySelectorAll(sel)).filter(function (x) { return x.textContent.trim() === text; })[0]; if (!b) throw new Error('no ' + sel + ' ' + text); return b; };
  var type = function (el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };`;
const run = (body) => ev(`(async function () { ${H}\n${body}\n})()`);

// ---------------------------------------------------------------- the cases
const cases = [];
const add = (name, src, p, fn) => cases.push({ name, src, p, fn });

// PLACE: a chip in the wrong zone, then the right one, then all of them; Start again
{
  const P = params('mktg90037', 'mktg90037-stp', 'place.html');
  add('place', 'kit/kinds/place.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh, N = P.chips.length, c0 = P.chips[0], z0 = [].concat(c0.zone)[0], wrong = P.zones.find((z) => z.id !== z0);
    let m = await take();
    ok(state(m).includes(lang === 'en' ? `0 of ${N} placed` : `已放 0 / ${N}`), `load state (${state(m)})`);
    const drop = (c, z) => `btn('.chip', ${js(L(c.label))}).click(); document.querySelector('.zone[data-z="${z}"]').click();`;
    await run(drop(c0, wrong.id));
    m = await take();
    ok(js(answers(m)) === js([{ mn: 'answer', item: c0.id, correct: false, response: L(wrong.label) }]), `wrong drop answer ${js(answers(m))}`);
    ok(state(m).includes(lang === 'en' ? 'Just now' : '刚才') && state(m).includes(L(wrong.label)), `miss in state (${state(m)})`);
    await run(P.chips.map((c) => drop(c, [].concat(c.zone)[0])).join('\n'));
    m = await take();
    ok(answers(m).length === N && answers(m).every((a) => a.correct) && answers(m)[0].item === c0.id, `right drops: ${N} correct answers`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, (N - 1) / N), `done once with score ${(N - 1) / N}: ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? `${N} of ${N} placed, 1 miss` : `已放 ${N} / ${N}，错 1 次`), `final state (${state(m)})`);
    await run(`btn('button', ${js(lang === 'en' ? 'Start again' : '重来')}).click();`);
    m = await take();
    ok(!dones(m).length && state(m).includes(lang === 'en' ? `0 of ${N} placed` : `已放 0 / ${N}`), `after start again (${state(m)})`);
  });
}
// TAG: a wrong tag, then the right one, then every line
{
  const P = params('mktg90037', 'mktg90037-stp', 'tag.html');
  add('tag', 'kit/kinds/tag.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh, N = P.items.length, ci = (id) => P.cats.findIndex((c) => c.id === id);
    let m = await take();
    ok(state(m).includes(lang === 'en' ? `0 of ${N} lines tagged` : `已判断 0 / ${N} 行`), `load state (${state(m)})`);
    const wrong = P.cats.findIndex((c) => c.id !== [].concat(P.items[0].cat)[0]);
    const tag = (k, c) => `document.querySelectorAll('.it')[${k}].querySelectorAll('.bt button')[${c}].click();`;
    await run(tag(0, wrong));
    m = await take();
    ok(js(answers(m)) === js([{ mn: 'answer', item: 'i1', correct: false, response: L(P.cats[wrong].label) }]), `wrong tag answer ${js(answers(m))}`);
    await run(P.items.map((it, k) => tag(k, ci([].concat(it.cat)[0]))).join('\n'));
    m = await take();
    ok(answers(m).length === N && answers(m).every((a, k) => a.correct && a.item === `i${k + 1}`), `right tags: ${js(answers(m).map((a) => a.item))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, (N - 1) / N), `done ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? `${N} of ${N} lines tagged, 1 miss` : `已判断 ${N} / ${N} 行，错 1 次`), `final state (${state(m)})`);
  });
}
// CONNECT: a wrong pair, then every right pair
{
  const P = params('mktg90037', 'mktg90037-co-creation', 'connect.html');
  add('connect', 'kit/kinds/connect.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh, N = P.left.length, lab = (side, id) => L(P[side].find((x) => x.id === id).label);
    let m = await take();
    ok(state(m).includes(lang === 'en' ? `0 of ${N} pairs made` : `已配好 0 / ${N} 对`), `load state (${state(m)})`);
    const pair = (l, r) => `btn('.col:first-child .card', ${js(lab('left', l))}).click(); btn('.col:last-child .card', ${js(lab('right', r))}).click();`;
    const wrong_r = P.pairs.find((p) => p[0] !== P.left[0].id)[1];
    await run(pair(P.left[0].id, wrong_r));
    m = await take();
    ok(js(answers(m)) === js([{ mn: 'answer', item: P.left[0].id, correct: false, response: lab('right', wrong_r) }]), `wrong pair answer ${js(answers(m))}`);
    await run(P.pairs.map((p) => pair(p[0], p[1])).join('\n'));
    m = await take();
    ok(answers(m).length === N && answers(m).every((a) => a.correct), `right pairs: ${N} correct answers`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, (N - 1) / N), `done ${js(dones(m))}`);
    ok(state(m).includes('↔'), `final state lists the pairs (${state(m)})`);
  });
}
// DIAL: a state only, and it follows the sliders
for (const [lesson, n] of [['mktg90037-stp', 0], ['mktg90037-firm-value', 0]]) {
  const P = params('mktg90037', lesson, 'dial.html', n);
  add(`dial (${lesson})`, 'kit/kinds/dial.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh, s0 = P.sliders[0];
    let m = await take();
    const a = only_state(m, [L(s0.label), L(P.outs.find((o) => !o.hide).label)], 'load');
    await run(`var r = document.querySelector('input[type=range]'); type(r, r.max);`);
    m = await take();
    const b = only_state(m, [], 'slider moved');
    ok(b && b !== a, `state changes with the slider (${b})`);
  });
}
// CHOOSE: no answers; done (without a score) when the last round is chosen
for (const [lesson, n, rounds] of [['mktg90037-pricing-value', 1, 4], ['mktg90037-community', 0, 2]]) {
  const P = params('mktg90037', lesson, 'choose.html', n);
  add(`choose (${lesson})`, 'kit/kinds/choose.html', P, async (lang) => {
    let m = await take();
    only_state(m, [lang === 'en' ? `Round 1 of ${rounds}` : `第 1 / ${rounds} 轮`], 'load');
    for (let i = 0; i < rounds; i++) await run(`document.querySelector('.opt').click(); await wait(320);`);
    m = await take();
    ok(!answers(m).length, 'no answers');
    ok(dones(m).length === 1 && dones(m)[0].score === undefined, `done without a score ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? `${rounds === 2 ? 'Both' : `All ${rounds}`} rounds chosen` : `${rounds} 轮都选完了`), `final state (${state(m)})`);
  });
}

// LP_CHECK: checks that do not read as a model are not answers; a wrong model, then the right one
for (const n of [0, 1]) {
  const P = params('mgmt90141', 'mgmt90141-lp-formulate', 'lp_check.html', n);
  add(`lp_check #${n}`, 'mgmt90141/lp_check.html', P, async (lang) => {
    const form = (a) => a.map((v, i) => (v ? `${v}${P.vars[i]}` : null)).filter(Boolean).join(' + ');
    const lines = P.rows.map((r) => `${form(r.a)} ${r.op} ${r.b}`);
    let m = await take();
    ok(state(m).includes(lang === 'en' ? 'Maximise or minimise not chosen' : '还没选最大化或最小化'), `load state (${state(m)})`);
    const fill = (ls) => `
      var ins = document.querySelectorAll('#lines input.ln');
      while (ins.length < ${lines.length}) { document.getElementById('add').click(); ins = document.querySelectorAll('#lines input.ln'); }
      type(document.getElementById('obj'), ${js(form(P.c))});
      var ls = ${js(ls)}; for (var i = 0; i < ins.length; i++) type(ins[i], ls[i] || '');`;
    await run(`${fill(lines)} document.getElementById('go').click();`);
    m = await take();
    ok(!answers(m).length, `no sense chosen: not an answer ${js(answers(m))}`);
    await run(`document.querySelectorAll('#sense button')[${P.sense === 'min' ? 1 : 0}].click(); ${fill([`${P.vars[0]} +`])} document.getElementById('go').click();`);
    m = await take();
    ok(!answers(m).length, `unreadable line: not an answer ${js(answers(m))}`);
    await run(`${fill(lines.slice(0, -1))} document.getElementById('go').click();`);
    m = await take();
    ok(answers(m).length === 1 && answers(m)[0].item === 'model' && answers(m)[0].correct === false, `a limit missing: wrong model ${js(answers(m))}`);
    ok(answers(m)[0]?.response?.startsWith(`${P.sense} ${form(P.c)} | ${lines[0]}`), `response is the model (${answers(m)[0]?.response})`);
    ok(state(m).includes((lang === 'en' ? en : zh)(P.rows[P.rows.length - 1].label)), `state names the limit not enforced (${state(m)})`);
    ok(!dones(m).length, 'no done yet');
    await run(`${fill(lines)} document.getElementById('go').click();`);
    m = await take();
    ok(answers(m).length === 1 && answers(m)[0].correct === true, `the full model: right ${js(answers(m))}`);
    ok(dones(m).length === 1 && dones(m)[0].score === 0, `done, score 0 (first model was wrong) ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? 'means the same' : '意思相同'), `final state (${state(m)})`);
    await run(`document.getElementById('go').click();`);
    m = await take();
    ok(answers(m).length === 1 && !dones(m).length, 'checking again: an answer, no second done');
  });
}
// LP_PLANE: a state only: the plan as moved, the best plan after the sweep
{
  const P = params('mgmt90141', 'mgmt90141-integer', 'lp_plane.html');
  add('lp_plane', 'mgmt90141/lp_plane.html', P, async (lang) => {
    let m = await take();
    only_state(m, [lang === 'en' ? 'Plan (3, 3)' : '方案 (3, 3)'], 'load');
    await run(`document.querySelector('[data-h=plan]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));`);
    m = await take();
    only_state(m, [lang === 'en' ? 'Plan (4, 3)' : '方案 (4, 3)'], 'plan moved');
    await run(`document.querySelector('#tools .verb').click(); await wait(1900);`);
    m = await take();
    only_state(m, lang === 'en' ? ['Best plan', 'Best whole-number plan'] : ['最优方案', '最优整数方案'], 'after the sweep');
  });
}
// LP_REPORT: a state only: the number touched, moved, and what the best plan becomes
{
  const P = params('mgmt90141', 'mgmt90141-lp-report', 'lp_report.html');
  add('lp_report', 'mgmt90141/lp_report.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh;
    let m = await take();
    only_state(m, [lang === 'en' ? 'No number touched' : '还没点报告里的数'], 'load');
    await run(`document.querySelector('#rep button[data-k=row][data-i="0"]').click();`);
    m = await take();
    only_state(m, [L(P.rows[0].label)], 'touched');
    await run(`type(document.querySelector('#ctl input[type=number]'), '${P.rows[0].b + 20}');`);
    m = await take();
    only_state(m, [String(P.rows[0].b + 20), lang === 'en' ? 'Best value' : '最优值'], 'moved');
  });
}
// TREE_ROLL: each node's value and each square's branch, answered when new; done when all right
{
  const P = params('mgmt90141', 'mgmt90141-drill', 'tree_roll.html');
  add('tree_roll', 'mgmt90141/tree_roll.html', P, async (lang) => {
    let m = await take();
    ok(state(m).includes(lang === 'en' ? 'Expected values' : '期望值'), `load state (${state(m)})`);
    const fill = (vals, branch) => `var v = document.querySelectorAll('input.v'), vals = ${js(vals)}; vals.forEach(function (x, i) { type(v[i], String(x)); }); document.querySelectorAll('button.br')[${branch}].click(); document.getElementById('chk').click();`;
    await run(fill([40, 44, 40], 1));
    m = await take();
    const got = answers(m).map((a) => `${a.item}=${a.correct}`).sort().join(' ');
    ok(got === 'n1:branch=false n1=false n2=true n3=true', `first check: ${got}`);
    ok(!dones(m).length, 'no done yet');
    await run(fill([44, 44, 40], 0));
    m = await take();
    ok(js(answers(m).map((a) => [a.item, a.correct])) === js([['n1', true], ['n1:branch', true]]), `second check: only what changed ${js(answers(m))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, 0.5), `done, score 2/4 ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? 'every node is right' : '每个节点都对'), `final state (${state(m)})`);
  });
}
// REG_OUTPUT: with questions, a cell touched is an answer to the question in hand; without, a state only
{
  const P = params('mgmt90141', 'mgmt90141-multiple-regression', 'reg_output.html', 1);
  add('reg_output (questions)', 'mgmt90141/reg_output.html', P, async (lang) => {
    const T = P.tasks, cell = (k) => `document.querySelector('td button[data-k="${k}"]').click(); await wait(30);`;
    let m = await take();
    ok(state(m).includes(lang === 'en' ? `Question 1 of ${T.length}` : `第 1 / ${T.length} 问`), `load state (${state(m)})`);
    await run(cell('b:1'));
    m = await take();
    ok(answers(m).length === 1 && answers(m)[0].item === 'q1' && !answers(m)[0].correct && answers(m)[0].response.includes('·'), `wrong cell ${js(answers(m))}`);
    await run(T.map((x) => cell(x.cell ?? x.cells[0])).join('\n'));
    m = await take();
    ok(answers(m).length === T.length && answers(m).every((a, k) => a.correct && a.item === `q${k + 1}`), `each question answered: ${js(answers(m).map((a) => a.item))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, (T.length - 1) / T.length), `done ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? `All ${T.length} questions answered` : `${T.length} 个问题都从表里找到了答案`), `final state (${state(m)})`);
  });
  const Q = params('mgmt90141', 'mgmt90141-multiple-regression', 'reg_output.html', 0);
  add('reg_output (no questions)', 'mgmt90141/reg_output.html', Q, async (lang) => {
    let m = await take();
    only_state(m, [lang === 'en' ? 'No number touched' : '还没点任何数'], 'load');
    await run(`document.querySelector('td button[data-k="r2"]').click();`);
    m = await take();
    only_state(m, ['R Square'], 'touched');
  });
}
// LOGIC_CHECK: a line per statement; an unreadable line is not an answer
{
  const P = params('mgmt90141', 'mgmt90141-integer', 'logic_check.html');
  const right = ['x1 <= x2', 'x1 + x2 <= 1', 'x1 + x2 + x3 <= 2', 'x1 = x3', 'x1 + x2 + x3 = 1'];
  add('logic_check', 'mgmt90141/logic_check.html', P, async (lang) => {
    const line = (i, v) => `${i ? `document.querySelectorAll('#chips button')[${i}].click();` : ''} type(document.getElementById('ln'), ${js(v)}); document.getElementById('go').click();`;
    let m = await take();
    ok(state(m).includes(lang === 'en' ? `Statement 1 of ${P.statements.length}` : `第 1 / ${P.statements.length} 条`), `load state (${state(m)})`);
    await run(line(0, 'x1 +'));
    m = await take();
    ok(!answers(m).length, 'unreadable line: no answer');
    await run(line(0, 'x1 + x2 <= 1'));
    m = await take();
    ok(js(answers(m)) === js([{ mn: 'answer', item: 's1', correct: false, response: 'x1 + x2 <= 1' }]), `wrong line ${js(answers(m))}`);
    ok(state(m).includes('(1,0,0)') || state(m).includes('(0,1,1)') || /\(\d,\d,\d\)/.test(state(m)), `state names the combinations (${state(m)})`);
    await run(right.map((v, i) => line(i, v)).join('\n'));
    m = await take();
    ok(answers(m).length === 5 && answers(m).every((a, i) => a.correct && a.item === `s${i + 1}`), `right lines ${js(answers(m))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, 4 / 5), `done ${js(dones(m))}`);
  });
}
// FLOW_NET: ship and assign show a plan; balance answers the dummy's side and amount; build answers each cell typed anew
{
  const S = params('mgmt90141', 'mgmt90141-network', 'flow_net.html', 0);
  add('flow_net ship', 'mgmt90141/flow_net.html', S, async (lang) => {
    const L = lang === 'en' ? en : zh;
    let m = await take();
    only_state(m, [lang === 'en' ? 'Nothing shipped yet' : '还没运输'], 'load');
    await run(`type(document.querySelector('input[data-i="0"][data-j="0"]'), '12000');`);
    m = await take();
    only_state(m, [`${L(S.rows[0])} → ${L(S.cols[0])} 12,000`, lang === 'en' ? 'broken' : '没守住'], 'a flow typed');
    await run(`document.querySelector('#bar .verb').click();`);
    m = await take();
    only_state(m, [lang === 'en' ? 'Best possible' : '最优', lang === 'en' ? 'this plan is at it' : '已经是最优'], 'solved');
  });
  const B = params('mgmt90141', 'mgmt90141-network', 'flow_net.html', 1);
  add('flow_net balance', 'mgmt90141/flow_net.html', B, async (lang) => {
    let m = await take();
    only_state(m, [lang === 'en' ? 'no dummy added yet' : '还没加虚拟项'], 'load');
    await run(`document.querySelectorAll('#dbtn button')[1].click();`);   // a dummy destination: supply is the short side here
    m = await take();
    ok(answers(m).length === 1 && answers(m)[0].item === 'dummy' && !answers(m)[0].correct, `wrong side ${js(answers(m))}`);
    await run(`document.querySelectorAll('#dbtn button')[0].click(); type(document.getElementById('amt'), '100'); document.getElementById('okamt').click();`);
    m = await take();
    ok(js(answers(m).map((a) => [a.item, a.correct])) === js([['dummy', true], ['amount', false]]), `right side, wrong amount ${js(answers(m))}`);
    await run(`type(document.getElementById('amt'), '200'); document.getElementById('okamt').click();`);
    m = await take();
    ok(js(answers(m).map((a) => [a.item, a.correct, a.response])) === js([['amount', true, '200']]), `right amount ${js(answers(m))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, 0), `done, score 0 ${js(dones(m))}`);
    ok(state(m).includes(lang === 'en' ? 'Nothing shipped yet' : '还没运输'), `then the plan's state (${state(m)})`);
  });
  const A = params('mgmt90141', 'mgmt90141-network', 'flow_net.html', 2);
  add('flow_net assign', 'mgmt90141/flow_net.html', A, async (lang) => {
    const L = lang === 'en' ? en : zh;
    let m = await take();
    only_state(m, [lang === 'en' ? 'Nothing assigned yet' : '还没分配'], 'load');
    await run(`document.querySelector('td.pick[data-i="0"][data-j="2"]').click();`);
    m = await take();
    only_state(m, [`${L(A.rows[0])} → ${L(A.cols[2])}`], 'a cell picked');
  });
  const D = params('mgmt90141', 'mgmt90141-network', 'flow_net.html', 3);
  add('flow_net build', 'mgmt90141/flow_net.html', D, async (lang) => {
    const R = D.ref, cells = R.cost.flat().length + R.supply.length + R.demand.length;
    const fill = (first) => `
      var R = ${js(R)};
      document.querySelectorAll('#tbl input').forEach(function (e) {
        var v = e.dataset.i !== undefined ? R.cost[+e.dataset.i][+e.dataset.j] : e.dataset.s !== undefined ? R.supply[+e.dataset.s] : R.demand[+e.dataset.d];
        if (e.dataset.i === '0' && e.dataset.j === '0' && ${first}) v = v + 1;
        type(e, v === null ? 'M' : String(v));
      });
      document.getElementById('chk').click();`;
    let m = await take();
    only_state(m, [lang === 'en' ? `0 of ${cells} cells filled` : `已填 0 / ${cells} 格`], 'load');
    await run(fill(true));
    m = await take();
    ok(answers(m).length === cells && answers(m).filter((a) => !a.correct).length === 1 && answers(m).find((a) => !a.correct).item === 'c0-0', `first check: ${cells} answers, c0-0 wrong`);
    await run(fill(false));
    m = await take();
    ok(js(answers(m).map((a) => [a.item, a.correct])) === js([['c0-0', true]]), `second check: only the cell changed ${js(answers(m))}`);
    ok(dones(m).length === 1 && near(dones(m)[0].score, (cells - 1) / cells), `done ${js(dones(m))}`);
    await run(`document.getElementById('slv').click();`);
    m = await take();
    ok(state(m).includes(lang === 'en' ? 'cheapest shipping plan' : '最省的运输方案'), `solved state (${state(m)})`);
  });
}
// the instruments that only show: a state on load and after a change, nothing judged
{
  const P = params('mgmt90141', 'mgmt90141-chances', 'area_table.html');
  add('area_table', 'mgmt90141/area_table.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh;
    only_state(await take(), [lang === 'en' ? 'A not chosen' : 'A 还没选'], 'load');
    await run(`document.querySelectorAll('#pa button')[0].click(); document.querySelectorAll('#pb button')[1].click();`);
    only_state(await take(), [`A = ${L(P.rows[0])}`, `B = ${L(P.cols[1])}`, 'P(A | B) = 0.15', lang === 'en' ? 'dependent' : '不独立'], 'A and B chosen');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-sample-info', 'bayes_flip.html');
  add('bayes_flip', 'mgmt90141/bayes_flip.html', P, async (lang) => {
    const L = lang === 'en' ? en : zh;
    only_state(await take(), [L(P.reports[0]), lang === 'en' ? 'Posterior' : '后验'], 'load');
    await run(`document.querySelectorAll('#which button')[1].click();`);
    only_state(await take(), [(lang === 'en' ? 'Report: ' : '报告：') + L(P.reports[1])], 'other report');
  });
}
{
  const F = params('mgmt90141', 'mgmt90141-random-variables', 'dist_lab.html', 0);
  add('dist_lab free', 'mgmt90141/dist_lab.html', F, async (lang) => {
    only_state(await take(), [lang === 'en' ? '(adds to 1)' : '（正好为 1）'], 'load');
    await run(`document.querySelector('.bar').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));`);
    only_state(await take(), [lang === 'en' ? '(does not add to 1)' : '（不等于 1）', '0.19'], 'a bar raised');
  });
  const Bn = params('mgmt90141', 'mgmt90141-random-variables', 'dist_lab.html', 1);
  add('dist_lab binomial', 'mgmt90141/dist_lab.html', Bn, async (lang) => {
    only_state(await take(), ['n = 2', lang === 'en' ? 'P(at least one)' : 'P(至少一次)'], 'load');
    await run(`type(document.querySelector('#sl input'), '3');`);
    only_state(await take(), ['n = 3'], 'n moved');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-describe-data', 'dot_plot.html', 1);
  add('dot_plot', 'mgmt90141/dot_plot.html', P, async (lang) => {
    const a = only_state(await take(), [P.sets[0].name, 'Q1', 'IQR'], 'load');
    await run(`document.querySelector('.dot').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));`);
    const b = only_state(await take(), [P.sets[1].name], 'a dot moved');
    ok(a !== b, 'state follows the dot');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-expected-value', 'evpi_lines.html');
  add('evpi_lines', 'mgmt90141/evpi_lines.html', P, async (lang) => {
    only_state(await take(), ['EVPI', '0.8'], 'load');
    await run(`type(document.getElementById('p'), '0.5');`);
    only_state(await take(), [lang === 'en' ? 'Probability of strong demand = 0.5' : '需求强的概率 = 0.5'], 'slider moved');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-exam-method', 'exam_clock.html');
  add('exam_clock', 'mgmt90141/exam_clock.html', P, async (lang) => {
    only_state(await take(), [lang === 'en' ? '3 of the 4 choice questions' : '选做题答了 3 / 4 道', lang === 'en' ? 'Skipping: Q5' : '不答：第 5 题'], 'load');
    await run(`document.querySelectorAll('.tog')[3].click();`);
    only_state(await take(), [lang === 'en' ? '4 of the 4 choice questions' : '选做题答了 4 / 4 道'], 'Q5 on');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-normal', 'normal_area.html', 0);
  add('normal_area', 'mgmt90141/normal_area.html', P, async (lang) => {
    only_state(await take(), ['P(X < 33,000) = 0.2420'], 'load');
    await run(`document.querySelectorAll('#modes button')[2].click();`);
    only_state(await take(), ['P(X > 33,000) = 1 − 0.2420 = 0.7580'], 'right tail');
  });
  const Q = params('mgmt90141', 'mgmt90141-normal', 'normal_area.html', 1);
  add('normal_area find', 'mgmt90141/normal_area.html', Q, async (lang) => {
    await take();
    await run(`document.querySelectorAll('#modes button')[3].click();`);
    only_state(await take(), [lang === 'en' ? 'Area 0.1000 to the left of x' : 'x 左边的面积 0.1000', 'z = −1.28'], 'find x');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-payoff', 'payoff_dial.html', 0);
  add('payoff_dial', 'mgmt90141/payoff_dial.html', P, async (lang) => {
    only_state(await take(), [lang === 'en' ? 'optimism 0.5' : '乐观度 0.5'], 'load');
    await run(`document.querySelectorAll('#modes button')[2].click();`);
    only_state(await take(), [lang === 'en' ? 'Rule: Regret' : '准则：后悔', lang === 'en' ? 'choose Medium complex' : '选中型楼盘'], 'regret');
  });
}
{
  const P = params('mgmt90141', 'mgmt90141-regression', 'reg_lab.html', 0);
  add('reg_lab', 'mgmt90141/reg_lab.html', P, async (lang) => {
    only_state(await take(), [lang === 'en' ? 'not the least-squares line' : '还不是最小二乘直线'], 'load');
    await run(`document.querySelector('#tools .verb').click(); await wait(900);`);
    only_state(await take(), [lang === 'en' ? 'this is the least-squares line' : '这就是最小二乘直线'], 'best line');
  });
}

// ---------------------------------------------------------------- run
for (const c of cases) {
  if (only.length && !only.some((o) => c.name.startsWith(o))) continue;
  for (const lang of ['en', 'zh']) {
    cur = `${c.name} [${lang}]`;
    errors.length = 0;
    try {
      await open(c.src, c.p, lang);
      // every state is in the learner's language
      const first = await ev('window.__mn.slice()');
      if (lang === 'zh') ok(CJK.test(state(first)), `load state is Chinese (${state(first)})`);
      await c.fn(lang);
    } catch (e) {
      fails.push(`${cur}: ${e.message}`);
    }
    ok(!errors.length, `no page errors (${errors.join(' | ')})`);
  }
}
ws.close();
browser.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log(`${passed} checks passed, ${fails.length} failed, ${cases.filter((c) => !only.length || only.some((o) => c.name.startsWith(o))).length} cases × 2 languages`);
for (const f of fails) console.log(`FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
