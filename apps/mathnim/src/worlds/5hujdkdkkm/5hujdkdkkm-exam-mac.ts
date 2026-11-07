// A busy shared channel, contention or collision-free? Two timelines of the same channel under heavy load. Contention
// (above): stations grab slots at random and collide (ochre), wasting most of them. Collision-free (below): they take
// turns, every slot carries a frame. Seen from above at rest; in the world, the frames that got through rise.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const TOP = [1, 2, 0, 2, 2, 1, 0, 2, 2, 1], PIGS = ['violet', 'teal', 'cobalt', 'ochre'];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], D = 0.62;
    TOP.forEach((k, i) => S.push(box(i * D, 0, 0, i * D + D - 0.06, 0.04 + (k === 1 ? 0.35 : 0.04) * u, 0.6, k === 1 ? { pig: 'violet', k: 1, tint: 0.55 } : k === 2 ? { pig: 'ochre', k: 1, tint: 0.45 } : { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.5 })));
    TOP.forEach((_, i) => S.push(box(i * D, 0, 1.2, i * D + D - 0.06, 0.04 + 0.35 * u, 1.8, { pig: PIGS[i % 4], k: 1, tint: 0.5 })));
    frame(cam, S, w, h, [12, 12, 12, 12], [[-2.6, 0, 0.4], [-2.6, 0, 1.6]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'contention', '竞争'), [-0.2, 0.04, 0.4], PIG.ink, 10.5, 'right');
    words(ctx, cam, say(st, 'collision-free', '无冲突'), [-0.2, 0.04, 1.6], PIG.ink, 10.5, 'right');
  },
};
export default world;
