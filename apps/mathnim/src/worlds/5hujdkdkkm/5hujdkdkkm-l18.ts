// Symmetric and public-key cryptography, digital signatures and authentication. Above: one secret key shared by both
// sides locks and unlocks (the same violet key twice). Below: anyone can lock with Bob's public key (teal), only his
// private key (cobalt) unlocks. Seen from above at rest; in the world, the keys and the boxes stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';
import { key } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], kh = 0.06 + 0.1 * u;
    S.push(...key(0, 0, 'violet', kh), ...key(4.4, 0, 'violet', kh), box(2.4, 0, -0.3, 3.0, 0.08 + 0.35 * u, 0.3, { pig: 'violet', k: 1, tint: 0.35 }));
    S.push(...key(0, 1.8, 'teal', kh), ...key(4.4, 1.8, 'cobalt', kh), box(2.4, 0, 1.5, 3.0, 0.08 + 0.35 * u, 2.1, { pig: 'teal', k: 1, tint: 0.3 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[-2.9, 0, 0.1], [-2.9, 0, 1.9]]); // (room for the names on the left)
    render(ctx, cam, S);
    arrow3(ctx, cam, [1.05, 0.03, 0], [2.3, 0.03, 0], PIG.ink, 1.1, 0.6); arrow3(ctx, cam, [3.1, 0.03, 0], [4.15, 0.03, 0], PIG.ink, 1.1, 0.6);
    arrow3(ctx, cam, [1.05, 0.03, 1.8], [2.3, 0.03, 1.8], PIG.ink, 1.1, 0.6); arrow3(ctx, cam, [3.1, 0.03, 1.8], [4.15, 0.03, 1.8], PIG.ink, 1.1, 0.6);
    words(ctx, cam, say(st, 'shared key', '同一把钥匙'), [-0.4, 0.03, 0.08], PIG.violet, 10.5, 'right');
    words(ctx, cam, say(st, 'public / private', '公钥 / 私钥'), [-0.4, 0.03, 1.88], PIG.teal, 10.5, 'right');
  },
};
export default world;
