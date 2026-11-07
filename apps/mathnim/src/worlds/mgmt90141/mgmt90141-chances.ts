// Counting and combining chances: a probability is a share of an area. A police force as a square: the women (B, the
// bottom band) and, within each band, those promoted (A, cobalt). Each band has its own share promoted; the columns do
// not line up, so A and B are not independent. "Given B" keeps only the bottom band. In the world, A rises.
import { PIG, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const SB = 0.36, AB = 0.18, AN = 0.32, W = 5.0, D = 3.6;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), zB = D * (1 - SB);
    const rect = (x0: number, z0: number, x1: number, z1: number, pig: string | undefined, tint: number, hh: number): Solid =>
      extrude([[x0, 0.05, z0], [x1, 0.05, z0], [x1, 0.05, z1], [x0, 0.05, z1]] as V3[], [0, hh, 0], { pig, k: 1, tint, shade: 0.6 });
    const g = 0.04, S: Solid[] = [card(-0.2, -0.2, W + 0.2, D + 0.2, { bias: -10 }),
      rect(0, 0, W * AN - g, zB - g, 'cobalt', 0.38, 0.004 + 0.35 * u), rect(W * AN + g, 0, W, zB - g, undefined, 0, 0.004),
      rect(0, zB + g, W * AB - g, D, 'cobalt', 0.55, 0.004 + 0.35 * u), rect(W * AB + g, zB + g, W, D, 'teal', 0.22, 0.004 + 0.1 * u)];
    frame(cam, S, w, h, [26, 12, 12, 22], [[W * 0.2, 0, D + 0.65], [-0.5, 0, zB]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[W * AN, 0.06, -0.12], [W * AN, 0.06, zB], [W * AB, 0.06, zB], [W * AB, 0.06, D + 0.12]], PIG.ink, 1, 0.6, true);
    words(ctx, cam, 'A', [W * AN / 2, 0.06 + 0.35 * u, zB / 2 + 0.12], PIG.cobalt, 13, 'center', 0.95, 650);
    words(ctx, cam, 'B', [-0.35, 0.06, zB + SB * D / 2 + 0.1], PIG.teal, 13, 'right', 0.95, 650);
    words(ctx, cam, 'A ∩ B', [W * AB / 2, 0.06 + 0.35 * u, D + 0.5], PIG.cobalt, 10.5);
  },
};
export default world;
