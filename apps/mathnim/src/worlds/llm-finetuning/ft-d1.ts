// D1 Why preferences, and reward models: what imitation cannot say, said as a comparison. Two answers to one prompt,
// A and B; a person prefers A; the reward model learns scores whose gap says how sure that is (Bradley–Terry).
// Seen from the front at rest: the two answers and their scores.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from './_ft';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    S.push(box(-2.4, 0, -0.05, -1.2, 1.5, 0.05, { shade: 0.6 }), box(1.2, 0, -0.05, 2.4, 1.5, 0.05, { shade: 0.6 }));
    S.push(box(-0.95, 0, -0.35, -0.45, 2.3, 0.35, { pig: 'teal', k: 1, tint: 0.5 }), box(0.45, 0, -0.35, 0.95, 0.9, 0.35, { pig: 'ochre', k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 22, 12, 22], [[0, 2.8, 0], [0, -0.45, 0]]);
    render(ctx, cam, S);
    for (const [x, y0] of [[-1.8, 0.3], [1.8, 0.3]]) for (let r = 0; r < 4; r++) ink(ctx, cam, [[x - 0.45, y0 + r * 0.28, 0.06], [x + (r === 3 ? 0.1 : 0.45), y0 + r * 0.28, 0.06]], PIG.graphite_t, 1, 0.55);
    words(ctx, cam, 'A', [-1.8, 1.65, 0], PIG.teal, 13);
    words(ctx, cam, 'B', [1.8, 1.65, 0], PIG.ochre, 13);
    words(ctx, cam, 'A ≻ B', [0, 2.6, 0], PIG.ink, 12.5, 'center', 0.9, 650);
    words(ctx, cam, say(st, 'reward', '奖励'), [0, -0.38, 0], PIG.graphite_t, 10.5, 'center', 0.9, 500);
  },
};
export default world;
