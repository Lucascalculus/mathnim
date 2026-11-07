// Keys: symmetric or public, and the man in the middle. Alice and Bob think they swapped public keys, but Mallory
// (ochre) sits between them and swapped in her own (two separate key exchanges, one on each side): she reads and
// re-encrypts everything. Seen from above at rest; in the world, they stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';
import { key, link, person } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [...person(0, 0, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...person(5.2, 0, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...person(2.6, 0, { pig: 'ochre', k: 1, tint: 0.5 }, 0.15 + 0.75 * u)];
    S.push(...key(0.8, 0.75, 'ochre', 0.05 + 0.08 * u), ...key(3.4, 0.75, 'ochre', 0.05 + 0.08 * u));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, 1.4]]);
    link(ctx, cam, [0.3, 0], [2.3, 0], PIG.ink, 1.3, 0.65); link(ctx, cam, [2.9, 0], [4.9, 0], PIG.ink, 1.3, 0.65);
    render(ctx, cam, S);
    words(ctx, cam, 'Alice', [0, 0.03, -0.5], PIG.teal, 10.5); words(ctx, cam, 'Mallory', [2.6, 0.03, -0.5], PIG.ochre, 10.5); words(ctx, cam, 'Bob', [5.2, 0.03, -0.5], PIG.teal, 10.5);
  },
};
export default world;
