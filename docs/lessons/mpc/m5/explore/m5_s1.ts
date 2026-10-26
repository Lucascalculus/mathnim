import { active_set_path, changes_of, ip_path, admm_path, exact } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/solvers2d';
import { ids_of } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/qp2d';
for (const x0 of [[6.39, 1.75], [7.1, 1.9], [9, 0.2], [6.6, 2], [8, 0], [6, 1.5], [4, 0], [6.75, 1.79], [6.93, 1.8]]) {
  const p = active_set_path(x0);
  const ip = ip_path(x0);
  const ad = admm_path(x0);
  const e = exact(x0);
  const zl = p[p.length - 1].z, zi = ip[ip.length - 1].z, za = ad[ad.length - 1].z;
  console.log(x0.join(','), p.map((s) => s.action + ':' + ids_of(s.W).join('+')).join(' > '), 'chg', changes_of(p),
    '| AS err', Math.hypot(zl[0] - e[0], zl[1] - e[1]).toExponential(1), '| IP it', ip.length - 1, Math.hypot(zi[0] - e[0], zi[1] - e[1]).toExponential(1), '| ADMM it', ad.length - 1, Math.hypot(za[0] - e[0], za[1] - e[1]).toExponential(1));
}
