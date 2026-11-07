// From a paragraph to a model you can trust: the problem as written (left, lines of text) with the phrases that
// matter marked (the goal cobalt, two limits ochre and teal), and the model they become (right): its objective and its
// constraints, each in the colour of the words it came from. Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';
import { text_lines } from './_mgmt';

// the marked phrases: row, from, to (share of the line), pigment; and the model row each becomes
const MARK: [number, number, number, string, number][] = [[0, 0.45, 0.85, 'cobalt', 0], [2, 0.1, 0.55, 'ochre', 1], [4, 0.35, 0.8, 'teal', 2]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 3.6, 3.2, { shade: 0.6 }), card(5.0, 0.3, 8.2, 2.9, { shade: 0.6 }, 0, 0.05 + 0.2 * u)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const lw = 3.0, z0 = 0.45, dz = 0.42;
    text_lines(ctx, cam, 0.3, z0, lw, [1, 0.92, 1, 0.8, 0.95, 0.6], dz, 0.052, 0.45);
    const ty = 0.05 + 0.2 * u + 0.002;
    MARK.forEach(([r, a, b, pig, row]) => {
      const z = z0 + r * dz;
      ink(ctx, cam, [[0.3 + lw * a, 0.052, z], [0.3 + lw * b, 0.052, z]], PIG[pig], 2.6, 0.9);
      const mz = 0.75 + row * 0.55;
      ink(ctx, cam, [[5.75, ty, mz], [5.75 + (row ? 1.7 : 2.1), ty, mz]], PIG[pig], 2.4, 0.9);
      arrow3(ctx, cam, [0.3 + lw * b + 0.15, 0.06, z], [4.85, 0.06, mz], PIG[pig], 1, 0.55);
    });
    ink(ctx, cam, [[5.75, ty, 0.75 + 3 * 0.55], [6.85, ty, 0.75 + 3 * 0.55]], PIG.graphite_t, 2, 0.6);
    words(ctx, cam, 'max', [5.6, ty, 0.82], PIG.cobalt, 10, 'right');
    words(ctx, cam, 's.t.', [5.6, ty, 1.37], PIG.ink, 10, 'right', 0.8, 500);
    words(ctx, cam, say(st, 'the problem', '题目原文'), [1.8, 0.05, 3.55], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'the model', '模型'), [6.6, 0.05, 3.25], PIG.graphite_t, 10.5, 'center', 0.95, 500);
  },
};
export default world;
