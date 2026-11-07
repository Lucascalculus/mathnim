// Proving who is on the other side, public-key authentication: Alice sends Bob a fresh random number (the challenge,
// violet); Bob signs it with his private key (cobalt) and sends it back; Alice checks it with his public key. Only the
// holder of the private key could have answered. Seen from above at rest; in the world, they stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { key, person } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [...person(0, 0.6, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...person(5, 0.6, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...key(5.3, 1.5, 'cobalt', 0.06 + 0.1 * u)];
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, 1.9]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [0.4, 0.03, 0.35], [4.6, 0.03, 0.35], PIG.violet, 1.5, 0.9);
    arrow3(ctx, cam, [4.6, 0.03, 0.9], [0.4, 0.03, 0.9], PIG.cobalt, 1.5, 0.9);
    words(ctx, cam, 'R', [2.5, 0.03, 0.2], PIG.violet, 12, 'center', 0.95, 650);
    words(ctx, cam, 'sig(R)', [2.5, 0.03, 1.25], PIG.cobalt, 11, 'center', 0.95, 600);
    words(ctx, cam, 'Alice', [0, 0.03, 1.5], PIG.teal, 10.5); words(ctx, cam, 'Bob', [4.7, 0.03, 1.55], PIG.teal, 10.5, 'right');
  },
};
export default world;
