// Compare two smoke runs (tools/smoke_lessons.cjs) of the same site before and after a change: the same lessons and
// steps, no new errors, every figure still drawn, and each step's screenshot the same pixel for pixel - except the
// steps whose figure was meant to change (list them with --changed lesson/step,…; a whole lesson with lesson/*).
//   node apps/mathnim/tools/smoke_compare.cjs /tmp/mathnim-smoke/before-desktop /tmp/mathnim-smoke/after-desktop [--changed a/b,c/*] [--out diff.json]
// A screenshot differs when more than 0.2 % of its pixels differ by more than 24 in a channel (text antialiasing
// and the clock in a player bar move a few pixels).
const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

const [A, B] = process.argv.slice(2);
const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : '';
};
const changed = arg('changed').split(',').filter(Boolean);
const is_changed = (l, s) => changed.some((c) => c === `${l}/${s}` || c === `${l}/*`);
const load = (d) => {
  const r = JSON.parse(fs.readFileSync(path.join(d, 'report.json'), 'utf8'));
  return new Map(r.lessons.map((l) => [l.id, l]));
};
async function pixels(file) {
  const img = await loadImage(fs.readFileSync(file));
  const c = createCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
}
async function diff(fa, fb) {
  const [a, b] = await Promise.all([pixels(fa), pixels(fb)]);
  if (a.w !== b.w || a.h !== b.h) return 1;
  let n = 0;
  for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) > 24 || Math.abs(a.d[i + 1] - b.d[i + 1]) > 24 || Math.abs(a.d[i + 2] - b.d[i + 2]) > 24) n++;
  return n / (a.w * a.h);
}

(async () => {
  const before = load(A), after = load(B);
  const out = { lessons: 0, steps: 0, same: 0, changed_as_meant: [], differs: [], errors_new: [], missing: [], blank: [], players: { before: 0, after: 0 } };
  for (const [id, la] of before) {
    const lb = after.get(id);
    if (!lb) {
      out.missing.push(id);
      continue;
    }
    out.lessons++;
    const sb = new Map(lb.steps.map((s) => [s.id, s]));
    for (const s of la.steps) {
      const t = sb.get(s.id);
      out.steps++;
      if (!t) {
        out.missing.push(`${id}/${s.id}`);
        continue;
      }
      if (s.has_player) out.players.before++;
      if (t.has_player) out.players.after++;
      const eb = [...(t.errors ?? []), ...(t.error ? [t.error] : [])], ea = [...(s.errors ?? []), ...(s.error ? [s.error] : [])];
      if (eb.length > ea.length) out.errors_new.push({ step: `${id}/${s.id}`, errors: eb.slice(0, 3) });
      if (s.has_player && t.has_player && s.drawn > 0 && !(t.drawn > 0)) out.blank.push(`${id}/${s.id}`);
      if (!s.shot || !t.shot) continue;
      const d = await diff(path.join(A, s.shot), path.join(B, t.shot)).catch(() => 1);
      if (d <= 0.002) out.same++;
      else if (is_changed(id, s.id)) out.changed_as_meant.push({ step: `${id}/${s.id}`, diff: +d.toFixed(4) });
      else out.differs.push({ step: `${id}/${s.id}`, diff: +d.toFixed(4) });
    }
  }
  for (const id of after.keys()) if (!before.has(id)) out.missing.push(`(new) ${id}`);
  const o = arg('out');
  if (o) fs.writeFileSync(o, JSON.stringify(out, null, 1));
  console.log(`${out.lessons} lessons, ${out.steps} steps; screenshots the same: ${out.same}; changed as meant: ${out.changed_as_meant.length}; differ: ${out.differs.length}; new errors: ${out.errors_new.length}; blank figures: ${out.blank.length}; missing: ${out.missing.length}; players ${out.players.before} → ${out.players.after}`);
  for (const d of out.differs) console.log(`  differs ${d.step} (${(d.diff * 100).toFixed(2)} %)`);
  for (const e of out.errors_new) console.log(`  new error ${e.step}: ${e.errors[0]}`);
  for (const b of out.blank) console.log(`  blank ${b}`);
  for (const m of out.missing) console.log(`  missing ${m}`);
  process.exitCode = out.differs.length || out.errors_new.length || out.blank.length || out.missing.length ? 1 : 0;
})();
