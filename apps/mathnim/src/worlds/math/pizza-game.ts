// Pizza shop (the game): why a circle's area is πr². The pizza cut into twelve slices (left), and the same slices laid
// head to tail (right): the half from below points up, the half from above points down, and together they make an
// almost-rectangle r tall and half the crust, πr, long. Seen from above at rest; in the world, the slices as dough.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';
import { wedge, type P2 } from './_math';

const N = 12, R = 1.6, D = (Math.PI * 2) / N, C = R * Math.sin(D / 2), X0 = 2.9;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), th = 0.06 + 0.14 * u, S: Solid[] = [];
    const lo = { pig: 'ochre', k: 1, tint: 0.55 }, hi = { pig: 'ochre', k: 1, tint: 0.2 };
    for (let k = 0; k < N; k++) {
      const a0 = k * D, a1 = a0 + D, m = a0 + D / 2, e = 0.05;
      S.push(wedge([e * Math.cos(m), e * Math.sin(m)], R - 0.02, a0 + 0.01, a1 - 0.01, 0, th, Math.sin(m) > 0 ? lo : hi));
    }
    // the strip: slices from below (arc down) at the top line, slices from above (arc up) between them
    const top = -R / 2;
    for (let j = 0; j < N / 2; j++) {
      const up: P2 = [X0 + C + 2 * C * j, top], dn: P2 = [X0 + 2 * C + 2 * C * j, top + R * Math.cos(D / 2)];
      S.push(wedge(up, R - 0.03, Math.PI / 2 - D / 2 + 0.012, Math.PI / 2 + D / 2 - 0.012, 0, th, lo));
      S.push(wedge(dn, R - 0.03, -Math.PI / 2 - D / 2 + 0.012, -Math.PI / 2 + D / 2 - 0.012, 0, th, hi));
    }
    const x1 = X0 + C * (N + 1);
    frame(cam, S, w, h, [12, 12, 12, 22], [[X0 - 0.8, 0, 0], [(X0 + x1) / 2, 0, R / 2 + 0.55]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[X0 - 0.2, th, top], [X0 - 0.2, th, top + R * Math.cos(D / 2)]], PIG.ink, 1, 0.7);
    for (const z of [top, top + R * Math.cos(D / 2)]) ink(ctx, cam, [[X0 - 0.3, th, z], [X0 - 0.1, th, z]], PIG.ink, 1, 0.7);
    words(ctx, cam, 'r', [X0 - 0.38, th, 0.12], PIG.ink, 13, 'right', 0.9, 650);
    words(ctx, cam, 'πr', [(X0 + x1) / 2, th, R / 2 + 0.5], PIG.ink, 13, 'center', 0.9, 650);
  },
};
export default world;
