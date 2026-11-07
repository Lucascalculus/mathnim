// Start here, the practice paper question by question: its eighteen questions as tiles in order, each tinted by the
// part of the course it tests: the wire and the link (violet), the network (cobalt), transport (teal), applications
// (ochre), security (ink). Seen from above at rest; in the world, they rise by their marks.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';

const PART = ['violet', 'violet', 'violet', 'violet', 'violet', 'violet', 'cobalt', 'cobalt', 'cobalt', 'cobalt', 'teal', 'teal', 'ochre', 'ochre', 'ochre', 'ink', 'ink', 'ink'];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], s = 0.9;
    PART.forEach((pig, i) => { const x = (i % 6) * 1.05, z = Math.floor(i / 6) * 1.05; S.push(card(x, z, x + s, z + s, { pig, k: 1, tint: pig === 'ink' ? 0.25 : 0.4 }, 0, 0.05 + (0.1 + 0.15 * ((i * 7) % 3)) * u)); });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    PART.forEach((_, i) => { const x = (i % 6) * 1.05, z = Math.floor(i / 6) * 1.05; words(ctx, cam, String(i + 1), [x + s / 2, 0.05 + (0.1 + 0.15 * ((i * 7) % 3)) * u, z + s / 2 + 0.12], PIG.ink, 11, 'center', 0.8, 650); });
  },
};
export default world;
