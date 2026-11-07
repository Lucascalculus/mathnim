// How the weeks connect: the course's ideas as nodes round a ring, one per week, coloured by part; an exam question
// joins two of them, and the answer needs the sentence that links them (the cobalt chords), not two lists side by side.
// Seen from above at rest; in the world, the joined weeks stand up.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const N = 12, R = 1.8, PART = ['teal', 'teal', 'teal', 'cobalt', 'cobalt', 'cobalt', 'cobalt', 'violet', 'violet', 'violet', 'ochre', 'ochre'];
const LINKS: [number, number][] = [[1, 6], [4, 10], [8, 2]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], P = (i: number): [number, number] => [R * Math.cos((i / N) * Math.PI * 2 - Math.PI / 2), R * Math.sin((i / N) * Math.PI * 2 - Math.PI / 2)];
    const joined = new Set(LINKS.flat());
    for (let i = 0; i < N; i++) { const [x, z] = P(i); S.push(cylinder_y(x, z, 0.22, 0, 0.06 + (joined.has(i) ? 0.45 : 0.12) * u, 18, { pig: PART[i], k: 1, tint: 0.45 })); }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    for (let i = 0; i < N; i++) { const a = P(i), b = P((i + 1) % N); ink(ctx, cam, [[a[0], 0.01, a[1]], [b[0], 0.01, b[1]]], PIG.graphite_t, 1, 0.3); }
    for (const [i, j] of LINKS) { const a = P(i), b = P(j); ink(ctx, cam, [[a[0], 0.02, a[1]], [b[0], 0.02, b[1]]], PIG.cobalt, 1.8, 0.85); }
    render(ctx, cam, S);
    for (let i = 0; i < N; i++) { const [x, z] = P(i); words(ctx, cam, String(i + 1), [x * 1.22, 0.02, z * 1.22 + 0.1], PIG.graphite_t, 9, 'center', 0.85, 500); }
  },
};
export default world;
