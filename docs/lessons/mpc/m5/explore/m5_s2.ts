import { admm_path, active_set_path, ip_path } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/solvers2d';
import { COST } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/qp2d';
console.log('H', COST.H);
for (const x0 of [[6.39, 1.75], [7.1, 1.9], [6.6, 2], [8, 0], [4, 0]]) {
  const row: string[] = [];
  for (const rho of [0.1, 1, 3, 10, 30, 100]) row.push(rho + ':' + (admm_path(x0, { rho }).length - 1));
  console.log(x0.join(','), row.join(' '));
}
// warm: start ADMM at the solution of a nearby state
const a = admm_path([6.39, 1.75], { rho: 10 });
console.log('ip sigma', [0.05, 0.1, 0.2, 0.3].map((s) => s + ':' + (ip_path([6.39, 1.75], { sigma: s, tol: 1e-6 }).length - 1)).join(' '));
console.log(a.slice(0, 12).map((s) => s.z.map((v) => v.toFixed(3)).join(',')).join(' | '));
