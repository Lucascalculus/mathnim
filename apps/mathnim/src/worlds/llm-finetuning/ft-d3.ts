// D3 DPO: derivation and geometry. The chosen answer (teal) and the rejected one (ochre), how likely the model makes
// each, before training (left) and after (right): the rejected one falls a long way, the chosen one falls too, so
// the gap between them widens while the chosen answer itself became less likely. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from './_ft';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    const bar = (x: number, hh: number, pig: string) => S.push(box(x - 0.32, 0, -0.3, x + 0.32, hh, 0.3, { pig, k: 1, tint: 0.5 }));
    bar(-2.1, 2.2, 'teal'); bar(-1.3, 1.9, 'ochre'); bar(1.3, 1.65, 'teal'); bar(2.1, 0.55, 'ochre');
    frame(cam, S, w, h, [12, 16, 12, 24], [[0, 2.6, 0], [0, -0.45, 0]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[-1.75, 2.2, 0.31], [-1.75, 1.9, 0.31]], PIG.ink, 1, 0.7);
    ink(ctx, cam, [[2.55, 1.65, 0.31], [2.55, 0.55, 0.31]], PIG.ink, 1.4, 0.85);
    ink(ctx, cam, [[-2.1, 2.3, 0.31], [1.3, 1.75, 0.31]], PIG.teal, 1, 0.7, true);
    words(ctx, cam, say(st, 'before', '训练前'), [-1.7, -0.4, 0.3], PIG.graphite_t, 10.5, 'center', 0.9, 500);
    words(ctx, cam, say(st, 'after', '训练后'), [1.7, -0.4, 0.3], PIG.graphite_t, 10.5, 'center', 0.9, 500);
    words(ctx, cam, say(st, 'chosen', '被选'), [-2.1, 2.42, 0.3], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'rejected', '被拒'), [2.1, 0.75, 0.3], PIG.ochre, 10.5);
  },
};
export default world;
