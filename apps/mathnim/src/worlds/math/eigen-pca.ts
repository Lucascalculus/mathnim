// Eigenvectors and PCA: a cloud of data on a card, the ellipse it fills (dashes), and its covariance matrix's two
// eigenvectors: v₁ along the cloud, the direction of most spread (cobalt), v₂ across it (ochre), each as long as its
// spread. Seen from above at rest; in the world, the points slide onto v₁: what PCA keeps.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';
import { cylinder_y } from '../../course_worlds';

const TH = -0.45, S1 = 1.25, S2 = 0.36, E1: [number, number] = [Math.cos(TH), Math.sin(TH)], E2: [number, number] = [-Math.sin(TH), Math.cos(TH)];
// the data: fixed pseudo-random normal pairs (the same picture every time)
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PTS = Array.from({ length: 46 }, (_, i) => {
  const r = Math.sqrt(-2 * Math.log(rnd(i) * 0.97 + 0.02)), t = rnd(i + 99) * Math.PI * 2, a = r * Math.cos(t) * S1, b = r * Math.sin(t) * S2;
  return [a * E1[0] + b * E2[0], a * E1[1] + b * E2[1], a] as [number, number, number];
});
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(-3.3, -2.1, 3.3, 2.1, { bias: -10 })], k = 0.85 * u;
    for (const [x, z, a] of PTS) S.push(cylinder_y(x + (a * E1[0] - x) * k, z + (a * E1[1] - z) * k, 0.065, 0.05, 0.1 + 0.08 * u, 10, { pig: 'ink', k: 1, tint: 0.3, shadow: false }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const Y = 0.052, ell = Array.from({ length: 73 }, (_, i) => { const t = (i / 72) * Math.PI * 2, a = 2 * S1 * Math.cos(t), b = 2 * S2 * Math.sin(t); return [a * E1[0] + b * E2[0], Y, a * E1[1] + b * E2[1]] as [number, number, number]; });
    ink(ctx, cam, ell, PIG.graphite_t, 1, 0.6, true);
    arrow3(ctx, cam, [0, Y, 0], [E1[0] * 2 * S1, Y, E1[1] * 2 * S1], PIG.cobalt, 2.2, 0.95);
    arrow3(ctx, cam, [0, Y, 0], [E2[0] * 2.2 * S2, Y, E2[1] * 2.2 * S2], PIG.ochre, 2, 0.95);
    words(ctx, cam, 'v₁', [E1[0] * 2 * S1 + 0.15, Y, E1[1] * 2 * S1 - 0.12], PIG.cobalt, 13, 'left');
    words(ctx, cam, 'v₂', [E2[0] * 2.2 * S2 + 0.12, Y, E2[1] * 2.2 * S2 + 0.38], PIG.ochre, 13, 'left');
  },
};
export default world;
