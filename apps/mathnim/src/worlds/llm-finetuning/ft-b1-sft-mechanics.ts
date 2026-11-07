// B1 SFT: the same loss, aimed at the right tokens. A chat as a row of tokens: the user's (dashes: masked, not graded)
// then the assistant's (cobalt: graded) and the end token (ochre) that teaches it to stop. Seen from above, which
// tokens count; in the world, the loss stands only on those.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, token, words } from './_ft';

const KIND = 'uuuuuuaaaaaaae';
const LOSS = [0, 0, 0, 0, 0, 0, 0.9, 0.55, 0.7, 0.35, 0.5, 0.3, 0.45, 0.6];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), dx = 0.46, S: Solid[] = [];
    [...KIND].forEach((k, i) => {
      const x = i * dx + (k !== 'u' ? 0.3 : 0);
      if (k === 'u') S.push(token(x, 0, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.7 }));
      else S.push(token(x, 0, { pig: k === 'e' ? 'ochre' : 'cobalt', k: 1, tint: 0.55 }), box(x - 0.1, 0.3, -0.1, x + 0.1, 0.3 + LOSS[i] * 1.6 * u + 0.001, 0.1, { pig: 'ink', k: 1, tint: 0.12, shadow: false }));
    });
    frame(cam, S, w, h, [12, 22, 12, 26], [[0, 0, 0.9], [KIND.length * dx, 0, 0.9]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'user: not graded', '用户：不计分'), [2.5 * dx, 0.02, 0.7], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'answer: graded', '回答：计分'), [9.3 * dx + 0.3, 0.02, 0.7], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, 'end', '结束'), [13 * dx + 0.3, 0.42 + LOSS[13] * 1.6 * u, -0.4 + 0.4 * u], PIG.ochre, 10.5);
  },
};
export default world;
