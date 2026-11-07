// The basic ideas: data as a table, one row per instance, one column per attribute, each attribute of a kind: nominal
// (categories, teal), ordinal (ordered levels, bars), numeric (a value, a length); the class in the last column (the
// forms). A new row (dashes) has no class yet: predicting it well is generalisation. Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';
import { form } from './_ml';

const ROWS = [[0, 2, 0.8, 0], [1, 1, 0.35, 1], [2, 3, 0.6, 0], [0, 1, 0.25, 1], [1, 2, 0.7, 0]];
const NOM = ['teal', 'violet', 'ochre'];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6.2, 4.2, { bias: -10 })], dz = 0.62, z0 = 0.55;
    ROWS.forEach((r, i) => S.push(form(5.3, z0 + i * dz, r[3], 0.12 + 0.18 * u, 0.15)));
    S.push(card(0.15, z0 + 5 * dz - 0.25, 6.05, z0 + 5 * dz + 0.25, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.6 }, 0.05, 0.02));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = 0.052;
    for (let c = 1; c < 4; c++) ink(ctx, cam, [[c * 1.45 + 0.3, y, 0.25], [c * 1.45 + 0.3, y, z0 + 4.4 * dz]], PIG.ink, 0.8, 0.25);
    [...ROWS, [1, 3, 0.5, -1]].forEach((r, i) => {
      const z = z0 + i * dz, a = i === 5 ? 0.55 : 0.9, p = cam.p([1.0, y, z]);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgba(${PIG[NOM[r[0]]].map((v) => Math.round(v * 255)).join(',')},0.8)`; ctx.beginPath(); ctx.arc(p[0], p[1], 4.2, 0, 7); ctx.fill(); ctx.restore();
      for (let k = 0; k < 3; k++) ink(ctx, cam, [[2.05 + k * 0.22, y, z + 0.14], [2.05 + k * 0.22, y, z + 0.14 - (k < r[1] ? 0.08 + k * 0.07 : 0.02)]], PIG.ink, 3, k < r[1] ? 0.75 * a : 0.15);
      ink(ctx, cam, [[3.35, y, z], [3.35 + r[2] * 1.2, y, z]], PIG.cobalt, 3, 0.7 * a);
    });
    words(ctx, cam, '?', [5.3, 0.06, z0 + 5 * dz + 0.12], PIG.ink, 13, 'center', 0.8, 650);
    words(ctx, cam, say(st, 'new', '新的'), [-0.12, 0.06, z0 + 5 * dz + 0.1], PIG.graphite_t, 10, 'right', 0.95, 500);
  },
};
export default world;
