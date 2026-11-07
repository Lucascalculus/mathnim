// M4 Constraints: the textbook picture of a constrained QP. The allowed plans (a polygon, viridian), the cost's
// ellipses round the plan it would pick with no limits (hollow), and the best allowed plan where the smallest ellipse
// touches the polygon (solid). Turning into the world, the polygon rises into a plate: the limits are walls.
import { PIG, box, extrude, poly, render, ring_dot, stroke_ink, stroke_prov, turned, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame } from './_mpc';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), W = 6, D = 4.2;
    const card = box(0, 0, 0, W, 0.05, D);
    const region: [number, number][] = [[0.7, 3.6], [0.7, 1.7], [1.6, 0.8], [3.3, 0.8], [4.0, 1.7], [3.2, 3.6]];
    const plate = extrude(region.map(([x, z]) => [x, 0.05, z] as V3), [0, 0.03 + 0.32 * u, 0], { pig: 'viridian', k: 1, tint: 0.24 });
    const S = [card, plate];
    frame(cam, S, w, h);
    render(ctx, cam, S);
    // the ellipses round the unconstrained best (C), the smallest touching the edge (3.3,0.8)-(4.0,1.7) at T
    const T: [number, number] = [3.62, 1.21], n = [0.79, -0.61], a = 1.25, b = 0.8, s = 0.95;
    const C: [number, number] = [T[0] + s * a * a * n[0], T[1] + s * b * b * n[1]], r = s * Math.sqrt(a * a * n[0] ** 2 + b * b * n[1] ** 2);
    const y = 0.052;
    for (const k of [1, 0.66, 0.33]) {
      const pts = Array.from({ length: 49 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return cam.p([C[0] + a * r * k * Math.cos(t), y, C[1] + b * r * k * Math.sin(t)]); });
      (k === 1 ? stroke_ink : (c: CanvasRenderingContext2D, p: () => void, g: number[], wd: number, al: number) => stroke_prov(c, p, g as [number, number, number], 0, wd, al))(ctx, poly(ctx, pts), PIG.ink, k === 1 ? 1.2 : 0.9, k === 1 ? 0.8 : 0.5);
    }
    const c = cam.p([C[0], y, C[1]]); ring_dot(ctx, c[0], c[1], 4.5, PIG.ink, 0, 1.3);
    const t = cam.p([T[0], 0.05 + 0.03 + 0.32 * u, T[1]]); ring_dot(ctx, t[0], t[1], 5, PIG.viridian, 1, 1.5);
  },
};
export default world;
