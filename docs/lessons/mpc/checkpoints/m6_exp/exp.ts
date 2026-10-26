import { CART, cart_step, double_integrator, make_mpc, dlqr, matvec, eigvals, type Vec } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/math';
import { dock_run } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/dock';
const { A, B } = double_integrator(0.1);
const Q = [[1, 0], [0, 0]], R = [[0.1]];
const L = dlqr(A, B, Q, R);
console.log('K', L.K, 'P', L.P);
const Acl = [[A[0][0]-B[0][0]*L.K[0][0], A[0][1]-B[0][0]*L.K[0][1]],[A[1][0]-B[1][0]*L.K[0][0], A[1][1]-B[1][0]*L.K[0][1]]];
console.log('eig cl', eigvals(Acl));
function run(N: number, o: { P?: number[][]; terminal?: { G: number[][]; w: number[] }; soft?: any }) {
  const mpc = make_mpc({ A, B, Q, R, N, P: o.P, u_min: [-1], u_max: [1], x_min: [null, -2], x_max: [10, 2], terminal: o.terminal, soft: o.soft });
  let x: Vec = [0, 0]; let inf = -1, crash = -1, imp = 0, docked = -1, first_inf_start = false;
  for (let k = 0; k < 150; k++) {
    const pl = mpc.solve(x, { x_ref: [10, 0] });
    let a: number;
    if (pl.status !== 'optimal') { if (inf < 0) inf = k; a = -1; } else a = pl.U[0][0];
    const s = cart_step(x, a, { wall: 10 + 1e-9 });
    if (s.crashed && s.impact > 1e-3) { crash = k + 1; imp = s.impact; break; }
    x = s.x;
    if (Math.abs(x[0] - 10) < 5e-3 && Math.abs(x[1]) < 5e-3) { docked = k + 1; break; }
  }
  return `inf ${inf} crash ${crash} imp ${imp.toFixed(2)} docked ${docked} x ${x.map(v=>v.toFixed(3))}`;
}
const c = 1.95;
const brake = { G: [[1, c]], w: [10] };
for (const N of [3, 5, 8, 10, 15, 20]) {
  console.log(N, 'none', run(N, {}));
  console.log(N, 'P   ', run(N, { P: L.P }));
  console.log(N, 'Xbrk', run(N, { terminal: brake }));
  console.log(N, 'Xb+P', run(N, { terminal: brake, P: L.P }));
}
