import { active_set_path, changes_of } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/solvers2d';
import { ids_of, solve_plan, working_set_point, slack_of, ROWS } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/qp2d';
let x = [4, 0];
let W: number[] = [];
let warm = 0, cold = 0;
for (let k = 0; k < 40; k++) {
  const pc = active_set_path(x);
  const pw = active_set_path(x, W);
  const done = pw[pw.length - 1];
  const s0 = working_set_point(x, W)!;
  const crossed = ROWS.map((_, i) => i).filter((i) => !W.includes(i) && slack_of(i, s0.z, x) > 1e-7);
  warm += changes_of(pw); cold += changes_of(pc);
  console.log(k, x.map((v) => v.toFixed(4)).join(','), 'cold', pc.map((s) => s.action + ':' + ids_of(s.W).join('+')).join('>'), changes_of(pc), '| warm', changes_of(pw), pw.map((s) => s.action + ':' + ids_of(s.W).join('+')).join('>'), '| prevW lam', s0.lambda.map((l) => l.toFixed(2)).join(','), 'crossed', ids_of(crossed).join(','), '| tot', warm, cold);
  W = done.W;
  const a = solve_plan(x).z[0];
  x = [x[0] + x[1] * 0.1 + 0.005 * a, x[1] + 0.1 * a];
}
