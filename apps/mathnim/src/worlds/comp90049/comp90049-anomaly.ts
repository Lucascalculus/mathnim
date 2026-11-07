// Anomaly detection: where the data are dense, the ground rises (the density as a hill of contour plates); a point far
// out on the flat (ochre, ringed) lives where almost nothing does: an anomaly, whichever way you measure it
// (statistics, distance, density, clusters). Seen from above at rest, the contours; in the world, the hill.
import { PIG, cylinder_y, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arc, card, frame, ink } from '../_kit';
import { cloud, dot } from './_ml';

const C: [number, number] = [2.4, 2.1], TH = -0.35, OUT: [number, number] = [5.1, 0.7];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })];
    for (let k = 0; k < 5; k++) {
      const a = 1.9 - k * 0.36, b = 1.15 - k * 0.22, y = 0.05 + k * (0.005 + 0.13 * u), ring: V3[] = [];
      for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2, x = a * Math.cos(t), z = b * Math.sin(t); ring.push([C[0] + x * Math.cos(TH) - z * Math.sin(TH), y, C[1] + x * Math.sin(TH) + z * Math.cos(TH)]); }
      S.push(extrude(ring, [0, 0.005 + 0.13 * u, 0], { pig: 'cobalt', k: 1, tint: 0.08 + k * 0.08, shade: 0.6, bias: -5 + k }));
    }
    const top = 0.05 + 5 * (0.005 + 0.13 * u);
    for (const [x, z] of cloud(900, 18, C[0], C[1], 0.55)) { const d = dot(x, z, 0.04); const lift = top - 0.05; for (const p of d.pts) p[1] += lift * Math.max(0, 1 - Math.hypot(x - C[0], z - C[1]) / 1.9); d.c[1] += lift; d.bias = 6; S.push(d); }
    S.push(cylinder_y(OUT[0], OUT[1], 0.13, 0.05, 0.05 + 0.06 + 0.1 * u, 14, { pig: 'ochre', k: 1, tint: 0.75, shadow: false }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, arc(OUT, 0.42, 0, Math.PI * 2, 40, 0.052), PIG.ochre, 1.5, 0.9);
  },
};
export default world;
