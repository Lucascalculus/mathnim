// Semi-supervised and active learning: many examples without labels (grey studs) and only a few with (the forms).
// Semi-supervised learning lets the unlabelled shape the boundary; active learning asks a person for the one label that
// would help most: the point on the fence (dashed ring, ?). Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { arc, card, frame, ink, words } from '../_kit';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { cloud, dot, form } from './_ml';

const ASK: [number, number] = [3.05, 2.0];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })];
    for (const [x, z] of [...cloud(800, 22, 1.8, 1.7, 0.7), ...cloud(850, 22, 4.2, 2.4, 0.7)]) if (x > 0.2 && x < 5.8 && z > 0.2 && z < 3.9 && Math.hypot(x - ASK[0], z - ASK[1]) > 0.35) S.push(dot(x, z));
    S.push(form(1.4, 1.3, 0, 0.2 + 0.2 * u), form(2.1, 2.3, 0, 0.2 + 0.2 * u), form(4.5, 2.0, 1, 0.2 + 0.2 * u), form(4.0, 3.0, 1, 0.2 + 0.2 * u), dot(ASK[0], ASK[1], 0.06));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [[3.6, 0.052, 0.2], [2.5, 0.052, 3.9]], PIG.ink, 1.1, 0.5, true);
    ink(ctx, cam, arc(ASK, 0.28, 0, Math.PI * 2, 40, 0.06), PIG.ink, 1.3, 0.85, true);
    words(ctx, cam, '?', [ASK[0] + 0.36, 0.06, ASK[1] - 0.1], PIG.ink, 14, 'left', 0.9, 650);
  },
};
export default world;
