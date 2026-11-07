// B2 Where SFT data comes from: people, a stronger model, the model itself, and raw text, each feeding the pile of
// examples. Seen from above, the four streams into one dataset, each named beside its source; in the world, the
// dataset as a stack of examples.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, words } from './_ft';

const SRC: [number, string, string, string?][] = [[0, 'people', '人写的', 'teal'], [1.25, 'stronger model', '更强的模型', 'violet'], [2.5, 'the model itself', '模型自己', 'cobalt'], [3.75, 'raw text', '原始文本', undefined]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (const [z, , , pig] of SRC) S.push(box(0, 0, z, 0.9, 0.12 + 0.35 * u, z + 0.75, { pig, k: 1, tint: 0.45 }));
    for (let i = 0; i < 6; i++) S.push(card(4.2, 1.15, 5.8, 3.35, { bias: i }, i * (0.04 + 0.1 * u), 0.05));
    frame(cam, S, w, h, [12, 14, 12, 14], [[-2.3, 0, 0.4], [6.2, 0, 3.9]]);
    render(ctx, cam, S);
    SRC.forEach(([z, en, zh, pig]) => {
      const c = pig ? (PIG as any)[pig] : PIG.graphite_t;
      arrow3(ctx, cam, [1.0, 0.05, z + 0.38], [4.05, 0.05, 2.25 + (z - 1.875) * 0.3], c, 1.1, 0.75);
      words(ctx, cam, say(st, en, zh), [-0.12, 0.05, z + 0.48], c, 10.5, 'right');
    });
    words(ctx, cam, say(st, 'examples', '训练样例'), [5.0, 0.1, 3.8], PIG.ink, 10.5);
  },
};
export default world;
