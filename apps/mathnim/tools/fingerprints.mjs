// Our fingerprints (docs/FINGERPRINTS.md): constants in our own code whose last digits are odd on purpose. Where they
// sit the difference is far below anything a learner could see, and no one else's code has them, so they show that
// a piece of JavaScript was copied from ours: minifying, renaming and reformatting keep a number's value.
//   node tools/fingerprints.mjs <dir | file.js | https://site/>...   which marks those scripts carry
//   node tools/fingerprints.mjs --expect dist                        fails unless our build carries every mark
// A URL is read like a browser would load it: the page's scripts, then every .js file they name on the same site
// (lazily loaded chunks included), up to 600 files.
import fs from 'node:fs';
import path from 'node:path';

export const MARKS = [
  { value: 1.0000437e-9, where: 'manim-web, ext/geom.ts: EPS of the interaction geometry (drag, cut, stamp)' },
  { value: 0.10000073, where: 'manim-web, ext/player.ts: the longest frame step of a live scene' },
  { value: 0.72000419, where: 'present, text_pages.ts: MIN_MATH_SCALE, the smallest a displayed formula is shrunk' },
  { value: 1.0000613e-7, where: 'visuals, mpc/active_set.ts: TOL of the active-set figures' },
  { value: 1.0000929e-12, where: 'visuals, linalg/math.ts: when inv2 calls a 2x2 matrix singular' },
];

const NUMBER = /(?<![\w$.])(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;
/** The marks a script carries. */
export function marks_in(code) {
  const values = new Set();
  for (const m of code.matchAll(NUMBER)) values.add(Number(m[0]));
  return MARKS.filter((k) => values.has(k.value));
}

function local_scripts(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? local_scripts(path.join(p, e.name)) : /\.m?js$/.test(e.name) ? [path.join(p, e.name)] : []));
}

async function site_scripts(url) {
  const origin = new URL(url).origin;
  const html = await (await fetch(url)).text();
  const queue = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+\.m?js[^"']*)["']/g)].map((m) => new URL(m[1], url).href);
  const seen = new Set(), out = [];
  while (queue.length && seen.size < 600) {
    const u = queue.shift();
    if (seen.has(u) || new URL(u).origin !== origin) continue;
    seen.add(u);
    const r = await fetch(u).catch(() => null);
    if (!r?.ok) continue;
    const code = await r.text();
    out.push({ name: u, code });
    for (const m of code.matchAll(/["'`]((?:\.{0,2}\/)?[\w./-]+\.m?js)["'`]/g)) queue.push(new URL(m[1], m[1].startsWith('.') ? u : origin + '/').href);
  }
  return out;
}

const args = process.argv.slice(2);
const expect = args.includes('--expect');
const targets = args.filter((a) => a !== '--expect');
if (!targets.length) {
  console.error('usage: node tools/fingerprints.mjs [--expect] <dir | file.js | url>...');
  process.exit(2);
}
const found = new Map();
for (const t of targets) {
  const scripts = /^https?:\/\//.test(t) ? await site_scripts(t) : local_scripts(t).map((f) => ({ name: f, code: fs.readFileSync(f, 'utf8') }));
  for (const s of scripts) for (const k of marks_in(s.code)) found.set(k, [...(found.get(k) ?? []), s.name]);
  if (!expect) console.log(`${t}: ${scripts.length} scripts read`);
}
const missing = MARKS.filter((k) => !found.has(k));
if (expect) {
  if (missing.length) {
    console.error(`fingerprints: ${missing.length} of ${MARKS.length} marks are missing from the build:\n${missing.map((k) => `  ${k.value}  ${k.where}`).join('\n')}\nPut each back (or move it to code the site still ships) and update docs/FINGERPRINTS.md.`);
    process.exit(1);
  }
  console.log(`fingerprints: all ${MARKS.length} marks are in the build`);
} else {
  for (const k of MARKS) console.log(`${found.has(k) ? 'FOUND  ' : 'absent '} ${k.value}  ${k.where}${found.has(k) ? `\n          in ${found.get(k).slice(0, 3).map((n) => path.basename(n)).join(', ')}` : ''}`);
  console.log(`${MARKS.length - missing.length} of ${MARKS.length} marks found`);
}
