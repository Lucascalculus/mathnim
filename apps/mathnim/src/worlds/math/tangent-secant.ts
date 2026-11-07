// Tangents and secants, the power of a point: from a point P outside a circle, the square on the tangent (d², cobalt)
// equals the rectangle of the secant's two lengths (a·b, ochre). The square stands on the tangent; the rectangle on the
// secant's line, b long and a wide. Seen from above at rest; in the world, both rise as plates of equal area.
import { PIG, extrude, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';
import { arc, at, disc, type P2 } from './_math';

const P: P2 = [-1.6, 0.6], A: P2 = [-0.8, 0.6], B: P2 = [0.8, 0.6], a = 0.8, b = 2.4, d = Math.sqrt(a * b);
const al = Math.asin(1 / Math.hypot(P[0], P[1])), dir = Math.atan2(-P[1], -P[0]) - al, U: P2 = [Math.cos(dir), Math.sin(dir)], N: P2 = [U[1], -U[0]];
const T: P2 = [P[0] + d * U[0], P[1] + d * U[1]];
const quad = (q: P2[], y0: number, h: number, pig: string) => extrude(q.map((p) => [p[0], y0, p[1]] as [number, number, number]), [0, h, 0], { pig, k: 1, tint: 0.4, shade: 0.6 });
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), hp = 0.02 + 0.3 * u, y0 = 0.05;
    const sq: P2[] = [P, T, [T[0] + d * N[0], T[1] + d * N[1]], [P[0] + d * N[0], P[1] + d * N[1]]];
    const rc: P2[] = [[P[0] - b, P[1]], P, [P[0], P[1] + a], [P[0] - b, P[1] + a]];
    const paper = card(-4.3, -1.6, 1.35, 1.65, { bias: -10 });
    paper.after = (c: CanvasRenderingContext2D) => { ink(c, cam, [at([P[0] - b, P[1]]), at([1.3, P[1]])], PIG.ochre, 1.4, 0.85); ink(c, cam, [at(P), at(T)], PIG.cobalt, 1.8, 0.95); };
    const S: Solid[] = [paper, disc([0, 0], 1, 0.1, {}, (c) => ink(c, cam, arc([0, 0], 1, 0, Math.PI * 2, 96, 0.1), PIG.ink, 1.1, 0.6)), quad(sq, y0, hp, 'cobalt'), quad(rc, y0, hp, 'ochre')];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [at(A, 0.1), at(B, 0.1)], PIG.ochre, 1.4, 0.85); // (the chord, on the disc)
    for (const q of [A, B]) { const p = cam.p(at(q, 0.1)); ctx.save(); ctx.fillStyle = 'rgba(26,27,31,.85)'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill(); ctx.restore(); }
    const cs = sq.reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0]), cr = rc.reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0]);
    words(ctx, cam, 'd²', [cs[0], y0 + hp, cs[1] + 0.12], PIG.cobalt, 13, 'center', 0.95, 650);
    words(ctx, cam, 'a·b', [cr[0], y0 + hp, cr[1] + 0.12], PIG.ochre, 13, 'center', 0.95, 650);
    words(ctx, cam, 'P', [P[0] + 0.08, 0.06, P[1] + 0.32], PIG.ink, 11, 'left');
  },
};
export default world;
