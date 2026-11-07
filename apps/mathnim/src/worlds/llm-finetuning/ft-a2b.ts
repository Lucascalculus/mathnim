// A2b Fine-tuning the retriever: the contrastive loss on the embedding space. The question (hollow ring) pulls its
// matching passage in (teal) and pushes the others away (grey); one pushed away is in fact relevant (ochre): the false
// negative that quietly hurts. Seen from above, the arrows; in the world, how similar each is to the question (height).
import { PIG, cylinder_y, render, ring_dot, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, words } from './_ft';

const NEG: [number, number][] = [[1.0, 0.8], [4.9, 0.7], [5.3, 2.9], [0.8, 3.0], [2.2, 3.5], [4.0, 3.6]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), q: [number, number] = [3.0, 2.0], S = [card(0, 0, 6, 4.1, { bias: -10 })]; // (the card first: the columns stand on it)
    const col = (x: number, z: number, sim: number, pig?: string) => cylinder_y(x, z, 0.14, 0.05, 0.08 + sim * 1.3 * u, 18, { pig, k: 1, tint: 0.55 });
    const pos: [number, number] = [3.75, 1.55], fneg: [number, number] = [1.9, 1.3];
    S.push(col(pos[0], pos[1], 0.9, 'teal'), col(fneg[0], fneg[1], 0.7, 'ochre'), ...NEG.map(([x, z]) => col(x, z, 0.2)));
    frame(cam, S, w, h, [12, 14, 12, 14]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [pos[0] + 0.35, 0.06, pos[1] - 0.25], [pos[0] + 0.05, 0.06, pos[1] - 0.05], PIG.teal, 1.4, 0.9);
    for (const [x, z] of NEG) { const dx = x - q[0], dz = z - q[1], l = Math.hypot(dx, dz); arrow3(ctx, cam, [x + (dx / l) * 0.2, 0.06, z + (dz / l) * 0.2], [x + (dx / l) * 0.6, 0.06, z + (dz / l) * 0.6], PIG.graphite_t, 1, 0.7); }
    { const dx = fneg[0] - q[0], dz = fneg[1] - q[1], l = Math.hypot(dx, dz); arrow3(ctx, cam, [fneg[0] + (dx / l) * 0.2, 0.06, fneg[1] + (dz / l) * 0.2], [fneg[0] + (dx / l) * 0.65, 0.06, fneg[1] + (dz / l) * 0.65], PIG.ochre, 1.3, 0.95); }
    const c = cam.p([q[0], 0.06, q[1]]); ring_dot(ctx, c[0], c[1], 5, PIG.cobalt, 0, 1.6);
    words(ctx, cam, say(st, 'question', '问题'), [q[0] + 0.28, 0.06, q[1] + 0.12], PIG.cobalt, 10.5, 'left');
    words(ctx, cam, say(st, 'false negative', '假负例'), [fneg[0], 0.06, fneg[1] + 0.6], PIG.ochre, 10.5);
  },
};
export default world;
