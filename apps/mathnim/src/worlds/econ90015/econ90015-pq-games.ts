// Predicted Q6, a game as a matrix and as a tree. The matrix (left): each player's better replies (arrows) lead into
// one cell, the Nash equilibrium (teal, rising in 3D). The tree (right): solved from the end back, the choices kept
// (ink) and dropped (faint) down to the path that is played.
import { PIG, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(5.0, 0, 9.4, 3.6, { bias: -10 })], c = 1.5;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const nash = i === 1 && j === 1;
      S.push(card(j * (c + 0.1), i * (c + 0.1), j * (c + 0.1) + c, i * (c + 0.1) + c, nash ? { pig: 'teal', k: 1, tint: 0.45 } : { shade: 0.5 }, 0, 0.05 + (nash ? 0.4 * u : 0)));
    }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.052, m = c / 2;
    arrow3(ctx, cam, [m, y, m + 0.35], [m, y, c + 0.1 + m - 0.4], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [m + 0.35, y, c + 0.1 + m], [c + 0.1 + m - 0.4, y, c + 0.1 + m], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [c + 0.1 + m, y, m + 0.35], [c + 0.1 + m, y, c + 0.1 + m - 0.4], PIG.ink, 1.2, 0.75);
    arrow3(ctx, cam, [m + 0.35, y, m], [c + 0.1 + m - 0.4, y, m], PIG.ink, 1.2, 0.75);
    const N: Record<string, [number, number]> = { r: [5.6, 1.8], a: [7.1, 0.9], b: [7.1, 2.7], a1: [8.7, 0.45], a2: [8.7, 1.35], b1: [8.7, 2.25], b2: [8.7, 3.15] };
    const E: [string, string, boolean][] = [['r', 'a', false], ['r', 'b', true], ['a', 'a1', true], ['a', 'a2', false], ['b', 'b1', false], ['b', 'b2', true]];
    for (const [p, q, kept] of E) ink(ctx, cam, [[N[p][0], y, N[p][1]], [N[q][0], y, N[q][1]]], kept ? PIG.ink : PIG.graphite_t, kept ? 1.8 : 1, kept ? 0.9 : 0.4);
    for (const [k, [x, z]] of Object.entries(N)) { const p = cam.p([x, y, z]); ring_dot(ctx, p[0], p[1], k.length > 1 ? 2.5 : 3.5, PIG.ink, k.length > 1 ? 1 : 0, 1.2); }
  },
};
export default world;
