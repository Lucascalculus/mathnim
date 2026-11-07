// Network security: what to protect, and the basics of cryptography. Alice sends to Bob (the message, locked in its
// box, violet); Eve (ochre) listens on the line (dashes): she can copy what passes, so what passes must mean nothing to
// her (confidentiality), and any change must show (integrity). Seen from above at rest; in the world, they stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';
import { link, person } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    S.push(...person(0, 0, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...person(5.0, 0, { pig: 'teal', k: 1, tint: 0.4 }, 0.15 + 0.75 * u), ...person(2.5, 1.8, { pig: 'ochre', k: 1, tint: 0.45 }, 0.15 + 0.75 * u));
    S.push(box(2.15, 0, -0.3, 2.85, 0.1 + 0.3 * u, 0.3, { pig: 'violet', k: 1, tint: 0.55 }), box(2.4, 0.1 + 0.3 * u, -0.08, 2.6, 0.18 + 0.38 * u, 0.08, { pig: 'ink', k: 1, tint: 0.5 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[2.5, 0, 2.4]]);
    link(ctx, cam, [0.3, 0], [4.7, 0], PIG.ink, 1.4, 0.65);
    ink(ctx, cam, [[2.5, 0.01, 1.5], [2.5, 0.01, 0.4]], PIG.ochre, 1.2, 0.8, true);
    render(ctx, cam, S);
    words(ctx, cam, 'Alice', [0, 0.02, 0.62], PIG.teal, 10.5); words(ctx, cam, 'Bob', [5.0, 0.02, 0.62], PIG.teal, 10.5); words(ctx, cam, 'Eve', [2.5, 0.02, 2.4], PIG.ochre, 10.5);
  },
};
export default world;
