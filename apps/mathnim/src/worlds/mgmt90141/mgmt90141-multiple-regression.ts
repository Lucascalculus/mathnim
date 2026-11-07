// More predictors, and reading the output: with two predictors the fit is a plane, not a line. From above at rest, its
// contour lines over the (x₁, x₂) plane (equal predictions, cobalt) and the data on it (dots: above the plane teal,
// below ochre); in the world, each point stands at its value and the plane tilts up through them.
import { PIG, cylinder_y, render, ring_dot, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const W = 5.4, D = 3.8, F = (x: number, z: number) => 0.35 + 0.22 * x + 0.18 * (D - z);
const rnd = (i: number) => { const v = Math.sin(i * 91.7 + 13.3) * 43758.5; return v - Math.floor(v); };
const PTS = Array.from({ length: 16 }, (_, i) => { const x = 0.4 + rnd(i) * (W - 0.8), z = 0.4 + rnd(i + 50) * (D - 0.8); return [x, z, F(x, z) + (rnd(i + 99) - 0.5) * 0.6] as [number, number, number]; });
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, W, D, { bias: -10 })];
    for (const [x, z, y] of PTS) S.push(cylinder_y(x, z, 0.06, 0.05, 0.05 + 0.004 + y * u, 10, { pig: y > F(x, z) ? 'teal' : 'ochre', k: 1, tint: 0.55, shadow: false }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[W, 2.2 * u, 0], [W, 0, D + 0.5], [-0.45, 0, 0.25]]);
    render(ctx, cam, S);
    // the plane: its contour lines at rest, lifted to its heights in the world
    const pt = (x: number, z: number): V3 => [x, 0.052 + u * F(x, z), z];
    for (let k = 0; k < 7; k++) {
      const c = 0.6 + k * 0.28, line: V3[] = [];
      for (let x = 0; x <= W; x += 0.1) { const z = D - (c - 0.35 - 0.22 * x) / 0.18; if (z >= 0 && z <= D) line.push(pt(x, z)); }
      if (line.length > 1) ink(ctx, cam, line, PIG.cobalt, 1, 0.55);
    }
    for (const [x, z, y] of PTS) { const p = cam.p([x, 0.054 + y * u, z]); ring_dot(ctx, p[0], p[1], 3, y > F(x, z) ? PIG.teal : PIG.ochre, 1, 1); }
    words(ctx, cam, 'x₁', [W - 0.1, 0.05, D + 0.38], PIG.ink, 11.5, 'right');
    words(ctx, cam, 'x₂', [-0.15, 0.05, 0.25], PIG.ink, 11.5, 'right');
  },
};
export default world;
