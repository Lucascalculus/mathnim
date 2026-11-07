// Start here, the sample questions and how we learn them: the two sample papers as two rows of question cards, each
// with a drawing of what it asks: a busy shared channel, finding a process, TCP after a timeout, opening a page, mail and
// media; reading an encrypted file from the middle, proving who is on the other side. Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';
import { it_glyph } from './_it';

const ROWS = [['bus', 'blocks', 'auth'], ['ports', 'tahoe', 'rtt', 'mail']], S = 1.2;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S0: Solid[] = [];
    ROWS.forEach((r, i) => r.forEach((_, j) => S0.push(card(j * 1.45, i * 1.6, j * 1.45 + S, i * 1.6 + S, { shade: 0.6 }, 0, 0.05 + 0.15 * u))));
    frame(cam, S0, w, h, [52, 12, 12, 12]);
    render(ctx, cam, S0);
    ROWS.forEach((r, i) => r.forEach((g, j) => it_glyph(ctx, cam, g, j * 1.45, i * 1.6, S, 0.052 + 0.15 * u)));
    ['1', '2'].forEach((t, i) => words(ctx, cam, t, [-0.25, 0.05, i * 1.6 + S / 2 + 0.12], PIG.ink, 12, 'right', 0.8, 650));
  },
};
export default world;
