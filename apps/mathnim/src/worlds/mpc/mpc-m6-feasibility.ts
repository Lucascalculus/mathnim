// M6 Stability and feasibility: the price of short sight. Two lanes: above, a plan that looks too short a way ahead
// (ochre) and only sees the wall when it is too late to stop; below, the same cart whose plan must end inside a
// terminal set (viridian), a place from which it can always still stop. Turning into the world, the terminal set
// rises: a landing the plan has to reach.
import { PIG, box, label, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from './_mpc';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), dz = 1.7;
    const S = [];
    const lane = (z: number) => S.push(box(1.6, 0, z - 0.45, 10, 0.08, z + 0.45, { shade: 0.6, bias: -1 }));
    const car = (x: number, z: number) => S.push(box(x - 0.82, 0.08, z - 0.28, x, 0.44, z + 0.28, { pig: 'cobalt', k: 1, tint: 0.55 }));
    const plan = (xs: number[], z: number, pig: string) => xs.forEach((x, i) => S.push(box(x - 0.82, 0.08, z - 0.28, x, 0.44, z + 0.28, { kind: 'wire', pig, solid: 0, alpha: 0.85 - i * 0.1 })));
    lane(0); lane(dz);
    car(3.2, 0); plan([4.9, 6.6, 8.3, 10.0], 0, 'ochre');
    car(3.2, dz); plan([4.6, 5.9, 7.0, 7.95, 8.75], dz, 'cobalt');
    S.push(box(7.3, 0.08, dz - 0.4, 9.55, 0.1 + 0.24 * u, dz + 0.4, { pig: 'viridian', k: 1, tint: 0.3, shade: 0.5, bias: -0.5 }));
    S.push(box(10, 0, -0.65, 10.16, 1.0, dz + 0.65, { pig: 'ochre', k: 1, tint: 0.3, bias: -0.5 }));
    frame(cam, S, w, h, [14, 22, 14, 14]);
    render(ctx, cam, S);
    const lb = (t: string, x: number, z: number, pig: number[]) => { const p = cam.p([x, 0.1, z]); label(ctx, t, p[0], p[1], pig as [number, number, number], 11, 600, 'left'); };
    lb(say(st, 'too short a horizon', '看得太近'), 1.7, -0.62, PIG.ochre);
    lb(say(st, 'ends in the terminal set', '计划必须落进终端集'), 1.7, dz + 0.95, PIG.viridian);
  },
};
export default world;
