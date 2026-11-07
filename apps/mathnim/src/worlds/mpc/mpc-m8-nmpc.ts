// M8 Nonlinear MPC: the road bends, so the model is a curve. At the cart the solver lays a straight plank along it, the
// linear model of one QP (SQP); the next one waits a little ahead in dashes, from where this plan ends: the real-time
// iteration. Turning into the world shows the road's bends and the plank lying straight across them.
import { PIG, obox, render, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from './_mpc';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top);
    const z = (x: number) => 1.3 * Math.sin(x * 0.62), dz = (x: number) => 1.3 * 0.62 * Math.cos(x * 0.62);
    const S = [];
    for (let x = 0.2; x < 10; x += 0.5) S.push(obox(x + 0.25, z(x + 0.25), 0.56, 1.0, 0, 0.09, Math.atan(dz(x + 0.25)), { shade: 0.7 }));
    const at = (x: number, len: number, o: Parameters<typeof obox>[7]) => obox(x, z(x), len, 0.5, 0.1, 0.13, Math.atan(dz(x)), o);
    S.push(at(3.6, 3.4, { pig: 'ink', k: 1, tint: 0.12, alpha: 1, bias: 0.3 }));
    S.push(at(5.9, 3.0, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.35 + 0.4 * u }));
    S.push(obox(3.6, z(3.6), 0.92, 0.6, 0.12, 0.52, Math.atan(dz(3.6)), { pig: 'cobalt', k: 1, tint: 0.55, bias: 0.4 }));
    frame(cam, S, w, h, [12, 14, 12, 14]);
    render(ctx, cam, S);
    void PIG;
  },
};
export default world;
