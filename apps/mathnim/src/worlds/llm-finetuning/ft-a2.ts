// A2 RAG: put the knowledge into the context. A shelf of documents (the corpus, cards); the few that match the
// question (teal) are taken into the context the model reads, laid out in front of it. Seen from above at rest; in
// the world, the chosen cards stand up in the context.
import { PIG, box, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, stack, words } from './_ft';

const PICK = new Set([3, 8, 13]);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S = [];
    for (let i = 0; i < 16; i++) { const cx = (i % 4) * 0.95, cz = Math.floor(i / 4) * 0.75; if (!PICK.has(i)) S.push(card(cx, cz, cx + 0.75, cz + 0.55)); else S.push(card(cx, cz, cx + 0.75, cz + 0.55, { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.6 })); }
    const m = stack(7.6, 1.3, 4, { w: 1.8, d: 1.8, gap: 0.22, th: 0.1 });
    S.push(...m.solids);
    [0, 1, 2].forEach((k) => { const x = 4.9 + k * 0.25, z = 0.55 + k * 0.45; S.push(u > 0.05 ? box(x, 0, z, x + 0.06, 0.62 * u + 0.05, z + 0.5, { pig: 'teal', k: 1, tint: 0.5 }) : card(x - 0.3, z, x + 0.45, z + 0.5, { pig: 'teal', k: 1, tint: 0.5 })); });
    frame(cam, S, w, h, [12, 22, 12, 14], [[7.6, 0, 2.8]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [3.85, 0.06, 1.1], [4.5, 0.06, 1.1], PIG.teal, 1.3, 0.85);
    words(ctx, cam, say(st, 'documents', '文档库'), [1.6, 0.06, -0.2], PIG.graphite_t, 11, 'center', 0.9, 500);
    words(ctx, cam, say(st, 'context', '上下文'), [5.25, 0.06, 0.3], PIG.teal, 11);
    words(ctx, cam, say(st, 'model', '模型'), [7.6, m.top, 2.55], PIG.ink, 11, 'center', 0.9, 500);
  },
};
export default world;
