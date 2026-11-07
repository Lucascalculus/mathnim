// What information is worth: a decision tree (a square where you choose, circles where chance chooses, the payoffs at
// the leaves), solved from the leaves back (the kept branch in ink). Beside it, the best expected payoff without
// information and with perfect information (bars): the gap is what perfect information is worth, the EVPI.
import { PIG, box, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 8.4, 3.8, { bias: -10 })], y = 0.052;
    const EV = 0.55, EVPI = 0.8, BX = 5.9, BW = 2.0;
    S.push(box(BX, 0.05, 1.2, BX + BW * EV, 0.054 + 0.3 * u, 1.6, { pig: 'cobalt', k: 1, tint: 0.3, shade: 0.6 }));
    S.push(box(BX, 0.05, 2.2, BX + BW * EVPI, 0.054 + 0.45 * u, 2.6, { pig: 'cobalt', k: 1, tint: 0.55, shade: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const N: Record<string, [number, number]> = { d: [0.5, 1.9], a: [2.0, 1.0], b: [2.0, 2.8], a1: [3.6, 0.55], a2: [3.6, 1.45], b1: [3.6, 2.35], b2: [3.6, 3.25] };
    const E: [string, string, boolean][] = [['d', 'a', true], ['d', 'b', false], ['a', 'a1', true], ['a', 'a2', true], ['b', 'b1', false], ['b', 'b2', false]];
    for (const [p, q, kept] of E) ink(ctx, cam, [[N[p][0], y, N[p][1]], [(N[p][0] + N[q][0]) / 2, y, N[q][1]], [N[q][0], y, N[q][1]]], kept ? PIG.ink : PIG.graphite_t, kept ? 1.6 : 1, kept ? 0.9 : 0.4);
    const sq = cam.p([N.d[0], y, N.d[1]]); ctx.save(); ctx.fillStyle = 'rgba(26,27,31,.88)'; ctx.fillRect(sq[0] - 4.5, sq[1] - 4.5, 9, 9); ctx.restore();
    for (const k of ['a', 'b']) { const p = cam.p([N[k][0], y, N[k][1]]); ring_dot(ctx, p[0], p[1], 4.5, PIG.ink, 0, 1.3); }
    for (const [k, v] of [['a1', 0.9], ['a2', 0.2], ['b1', 0.5], ['b2', 0.45]] as const) ink(ctx, cam, [[N[k][0] + 0.15, y, N[k][1]], [N[k][0] + 0.15 + v * 1.1, y, N[k][1]]], PIG.ochre, 3, 0.75);
    const top = 0.054 + 0.45 * u;
    ink(ctx, cam, [[BX + BW * EV, 0.06, 1.65], [BX + BW * EV, 0.06, 2.95]], PIG.ink, 1, 0.6, true);
    ink(ctx, cam, [[BX + BW * EV, top, 2.95], [BX + BW * EVPI, top, 2.95]], PIG.ink, 1.6, 0.9);
    for (const x of [BX + BW * EV, BX + BW * EVPI]) ink(ctx, cam, [[x, top, 2.82], [x, top, 3.08]], PIG.ink, 1.2, 0.9);
    words(ctx, cam, 'EV', [BX - 0.1, 0.06, 1.52], PIG.cobalt, 10.5, 'right');
    words(ctx, cam, 'EVPI', [BX + BW * (EV + EVPI) / 2, top, 3.45], PIG.ink, 10.5);
  },
};
export default world;
