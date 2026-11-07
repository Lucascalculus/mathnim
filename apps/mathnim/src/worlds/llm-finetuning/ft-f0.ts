// F0 Choosing, halfway: five short cases (cards, left), each sent to the route that fits it, of the five known so far
// (right): the context, RAG, an encoder classifier, SFT, continued pretraining. Seen from above, the sorting.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from './_ft';

const ROUTES: [string, string, string | undefined][] = [['context', '上下文', 'cobalt'], ['RAG', 'RAG', 'teal'], ['classifier', '编码器分类', 'ochre'], ['SFT', 'SFT', 'violet'], ['pretraining', '继续预训练', undefined]];
const TO = [1, 3, 0, 2, 4];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let i = 0; i < 5; i++) S.push(card(0, i * 0.9, 1.1, i * 0.9 + 0.6));
    ROUTES.forEach(([, , pig], i) => S.push(box(4.6, 0, i * 0.9, 5.4, 0.12 + 0.4 * u, i * 0.9 + 0.6, { pig, k: 1, tint: 0.45 })));
    frame(cam, S, w, h, [12, 12, 70, 12]);
    render(ctx, cam, S);
    TO.forEach((j, i) => { const pig = ROUTES[j][2]; ink(ctx, cam, [[1.15, 0.06, i * 0.9 + 0.3], [2.6, 0.06, i * 0.9 + 0.3], [3.4, 0.06, j * 0.9 + 0.3], [4.55, 0.06, j * 0.9 + 0.3]], pig ? (PIG as any)[pig] : PIG.graphite_t, 1.2, 0.8); });
    ROUTES.forEach(([en, zh, pig], i) => words(ctx, cam, say(st, en, zh), [5.55, 0.12 + 0.4 * u, i * 0.9 + 0.42], pig ? (PIG as any)[pig] : PIG.graphite_t, 10.5, 'left'));
  },
};
export default world;
