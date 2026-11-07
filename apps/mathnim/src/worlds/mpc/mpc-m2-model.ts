// M2 The model: the plan's states x₀ … x₅ as tiles in a row, each a step of the same rule. Seen from above they are a
// sequence; turning into the world they rise, each standing on the last, the input of each step (ochre) beside it:
// X = Φx₀ + ΓU, the whole plan predicted from where it starts.
import { PIG, box, label, render, turned } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow, frame } from './_mpc';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), n = 6, dx = 1.25;
    const S = [];
    for (let i = 0; i < n; i++) {
      const x = i * dx, top = 0.14 + i * 0.3 * u;
      S.push(box(x, 0, -0.5, x + 0.95, top, 0.5, i === 0 ? { pig: 'cobalt', k: 1, tint: 0.55 } : { shade: 0.8 }));
      if (i < n - 1) S.push(box(x + 0.98, 0, 0.72, x + 1.22, 0.16, 0.96, { pig: 'ochre', k: 1, tint: 0.5, shade: 0.6 }));
    }
    frame(cam, S, w, h, [14, 18, 14, 22], [[0, 0.14 + (n - 1) * 0.3, 0.5]]);
    render(ctx, cam, S);
    for (let i = 0; i < n - 1; i++) {
      const y = 0.16 + (i + 0.5) * 0.3 * u;
      arrow(ctx, cam.p([i * dx + 0.97, y, -0.15]), cam.p([(i + 1) * dx - 0.02, y + 0.15 * u, -0.15]), PIG.ink, 1.1, 0.65);
    }
    const lb = (t: string, q: [number, number, number], pig = PIG.ink) => { const p = cam.p(q); label(ctx, t, p[0], p[1], pig, 12, 600, 'center'); };
    lb('x₀', [0.47, 0.15, 0.95], PIG.cobalt);
    lb('x₅', [(n - 1) * dx + 0.47, 0.15, 0.95]);
    lb('u', [1.1, 0.17, 1.35], PIG.ochre);
  },
};
export default world;
