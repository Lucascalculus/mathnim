// D4 The DPO family and preference data in practice: preference pairs, each a chosen answer (teal) and a rejected
// one (ochre). Pairs with no clear winner teach nothing and are dropped (dashes): what is learned is the difference. The model's new answers make
// new pairs (the loop): iterative, rather than offline. Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, stack, words } from './_ft';

const DROP = new Set([2, 5]);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    for (let i = 0; i < 6; i++) {
      const z = i * 0.7, wire = DROP.has(i);
      S.push(card(0, z, 1.2, z + 0.5, wire ? { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.5 } : { pig: 'teal', k: 1, tint: 0.4 }, 0, 0.05 + 0.15 * u));
      S.push(card(1.4, z, 2.6, z + 0.5, wire ? { kind: 'wire', pig: 'ochre', solid: 0, alpha: 0.5 } : { pig: 'ochre', k: 1, tint: 0.35 }, 0, 0.05 + 0.05 * u));
    }
    const m = stack(5.2, 1.85, 4, { w: 1.5, d: 1.5, gap: 0.2, th: 0.09 });
    S.push(...m.solids);
    frame(cam, S, w, h, [12, 14, 12, 18], [[3.25, 0, 4.85], [1.3, 0, 4.4]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [2.8, 0.06, 1.85], [4.3, 0.06, 1.85], PIG.ink, 1.2, 0.8);
    ink(ctx, cam, [[5.2, 0.06, 2.75], [5.2, 0.06, 4.3], [1.3, 0.06, 4.3], [1.3, 0.06, 3.95]], PIG.cobalt, 1.1, 0.75, true);
    words(ctx, cam, say(st, 'new pairs', '新的偏好对'), [3.25, 0.06, 4.6], PIG.cobalt, 10.5);
  },
};
export default world;
