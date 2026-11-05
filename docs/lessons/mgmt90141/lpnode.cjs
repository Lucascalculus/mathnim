// Solves the models on stdin ({ models: [...] }) with the instruments' own engine (public/frames/kit/lp.js), so the
// numbers written into the lessons are the numbers the instruments show. common.py cross-checks every one with scipy.
const fs = require('fs'), path = require('path');
require(path.join(__dirname, '../../../apps/mathnim/public/frames/kit/lp.js')); const LP = globalThis.LP;
const { models } = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = models.map((m) => {
  const s = LP.solve(m);
  if (s.status !== 'optimal') return { status: s.status };
  const r = LP.sensitivity(m, s);
  const num = (v) => (v === Infinity ? 1e30 : v);
  return { status: 'optimal', x: s.x, obj: s.obj,
    vars: r.vars.map((v) => ({ value: v.value, cost: v.cost, reduced: v.reduced, inc: num(v.inc), dec: num(v.dec) })),
    rows: r.rows.map((v) => ({ lhs: v.lhs, rhs: v.rhs, slack: v.slack, binding: v.binding, shadow: v.shadow, inc: num(v.inc), dec: num(v.dec) })) };
});
process.stdout.write(JSON.stringify(out));
