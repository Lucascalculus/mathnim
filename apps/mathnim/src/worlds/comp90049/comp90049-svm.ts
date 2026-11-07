// Support vector machines: of all the lines that separate the two classes, the one with the widest street between them
// (the band, teal, its edges in dashes); the examples on the edges hold it in place (ringed): the support vectors.
// Seen from above at rest; in the world, the street rises as a plate.
import { PIG, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arc, card, frame, ink } from '../_kit';
import { form } from './_ml';

// the boundary: through (3, 2.05) along direction d; the margin half-width m
const O: [number, number] = [3.0, 2.05], DIR: [number, number] = [0.42, 0.91], N: [number, number] = [0.91, -0.42], M = 0.55;
const at = (s: number, t: number): [number, number] => [O[0] + DIR[0] * s + N[0] * t, O[1] + DIR[1] * s + N[1] * t];
const SV: [number, number, number][] = [[-1.0, -M, 0], [0.9, -M, 0], [0.1, M, 1]];
const OTHER: [number, number, number][] = [[-1.4, -1.4, 0], [0.2, -1.9, 0], [1.3, -1.25, 0], [-0.4, -2.4, 0], [1.6, -2.3, 0], [-1.6, 1.3, 1], [-0.7, 1.9, 1], [0.9, 1.4, 1], [1.7, 2.1, 1], [-0.2, 2.6, 1]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })];
    const band = [at(-1.75, -M), at(1.75, -M), at(1.75, M), at(-1.75, M)].map(([x, z]) => [x, 0.05, z] as V3);
    S.push(extrude(band, [0, 0.004 + 0.12 * u, 0], { pig: 'teal', k: 1, tint: 0.25, shade: 0.6, bias: -5 }));
    for (const [s, t, c] of [...SV, ...OTHER]) { const [x, z] = at(s, t); if (x > 0.25 && x < 5.75 && z > 0.25 && z < 3.85) S.push(form(x, z, c, 0.22, 0.12)); }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.054 + 0.12 * u, L = (t: number) => [at(-1.75, t), at(1.75, t)].map(([x, z]) => [x, y, z] as V3);
    ink(ctx, cam, L(0), PIG.ink, 1.8, 0.9);
    ink(ctx, cam, L(-M), PIG.ink, 1, 0.6, true); ink(ctx, cam, L(M), PIG.ink, 1, 0.6, true);
    for (const [s, t] of SV) ink(ctx, cam, arc(at(s, t), 0.24, 0, Math.PI * 2, 32, 0.06), PIG.ink, 1.2, 0.85);
  },
};
export default world;
