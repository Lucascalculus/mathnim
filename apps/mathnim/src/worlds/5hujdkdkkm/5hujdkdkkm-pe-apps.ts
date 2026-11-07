// DNS, mail and video calls: three short answers, three small scenes. A name looked up down a tree of servers; a letter
// passed between mail servers; a call where late packets are worse than lost ones (the stream, one gap left as it
// was). Seen from above at rest; in the world, the cards lift.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';
import { it_glyph } from './_it';

const CARDS: [string, string, string][] = [['dns', 'DNS', 'DNS'], ['mail', 'mail', '邮件'], ['signal', 'video call', '视频通话']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], s = 1.9;
    CARDS.forEach((_, i) => S.push(card(i * 2.3, 0, i * 2.3 + s, s, { shade: 0.6 }, 0, 0.05 + 0.15 * u)));
    frame(cam, S, w, h, [12, 12, 12, 22], [[2.3, 0, s + 0.5]]);
    render(ctx, cam, S);
    const y = 0.052 + 0.15 * u;
    it_glyph(ctx, cam, 'dns', 0, 0, s, y);
    it_glyph(ctx, cam, 'mail', 2.3, 0, s, y);
    for (let k = 0; k < 6; k++) if (k !== 3) ink(ctx, cam, [[4.85 + k * 0.22, y, 0.95], [4.85 + k * 0.22 + 0.15, y, 0.95]], PIG.violet, 5, 0.8);
    CARDS.forEach(([, en, zh], i) => words(ctx, cam, say(st, en, zh), [i * 2.3 + s / 2, 0.05, s + 0.38], PIG.ink, 10.5));
  },
};
export default world;
