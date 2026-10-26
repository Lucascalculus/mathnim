import { cart_step, double_integrator, make_mpc, type Vec } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/math';
const { A, B } = double_integrator(0.1);
const Q = [[1, 0], [0, 0]], R = [[0.1]];
function run(soft: any, push_k = 30, dv = 0.4, N = 20) {
  const mpc = make_mpc({ A, B, Q, R, N, u_min: [-1], u_max: [1], x_min: [null, -2], x_max: [10, 2], soft });
  let x: Vec = [0, 0]; const out: string[] = []; let inf = 0, vmax = 0, pmax = 0, crash = -1;
  for (let k = 0; k < 120; k++) {
    const pl = mpc.solve(x, { x_ref: [10, 0] });
    let a = pl.status === 'optimal' ? pl.U[0][0] : -1; if (pl.status !== 'optimal') inf++;
    if (k >= 28 && k < 38) out.push(`${k}:${x[1].toFixed(2)}/${a.toFixed(2)}/${pl.slack.toFixed(2)}`);
    const s = cart_step(x, a, { wall: 10 + 1e-9 }); if (s.crashed && s.impact > 1e-3) { crash = k; break; }
    x = s.x; if (k + 1 === push_k) x = [x[0], x[1] + dv];
    vmax = Math.max(vmax, x[1]); pmax = Math.max(pmax, x[0]);
  }
  return `inf ${inf} vmax ${vmax.toFixed(3)} pmax ${pmax.toFixed(4)} crash ${crash} end ${x.map(v=>v.toFixed(3))}\n  ${out.join(' ')}`;
}
console.log('hard', run(undefined));
for (const l1 of [1000, 100, 10, 3, 1, 0.3]) console.log('soft', l1, run({ l1, l2: 1 }));
for (const l1 of [1000, 10, 1]) console.log('nopush', l1, run({ l1, l2: 1 }, 999));
