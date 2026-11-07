// How the people inside create value: the service-profit chain, five links in a row, each lifting the next: satisfied
// employees, better service, satisfied customers, loyalty, profit. Seen from above at rest; in the world, each link
// stands taller than the one before.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { person } from './_mktg';

const LINKS: [string, string, string | undefined][] = [['employees', '员工', 'violet'], ['service', '服务', 'teal'], ['customers', '顾客', 'teal'], ['loyalty', '忠诚', 'cobalt'], ['profit', '利润', 'cobalt']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], dx = 1.55;
    LINKS.forEach(([, , pig], i) => {
      if (i === 0 || i === 2) S.push(...person(i * dx, 0, { pig, k: 1, tint: 0.4 }, 0.12 + 0.7 * u));
      else S.push(box(i * dx - 0.4, 0, -0.4, i * dx + 0.4, 0.1 + (0.2 + i * 0.16) * u, 0.4, { pig, k: 1, tint: 0.2 + i * 0.08 }));
    });
    frame(cam, S, w, h, [12, 12, 12, 24], [[0, 0, 0.95], [4 * dx, 0, 0.95]]);
    render(ctx, cam, S);
    for (let i = 0; i < LINKS.length - 1; i++) arrow3(ctx, cam, [i * dx + 0.48, 0.03, 0], [(i + 1) * dx - 0.48, 0.03, 0], PIG.ink, 1.2, 0.75);
    LINKS.forEach(([en, zh, pig], i) => words(ctx, cam, say(st, en, zh), [i * dx, 0.03, 0.85], pig ? PIG[pig] : PIG.ink, 10.5));
  },
};
export default world;
