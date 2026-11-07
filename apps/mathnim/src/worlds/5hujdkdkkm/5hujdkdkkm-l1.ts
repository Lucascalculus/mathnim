// What a network is, and why it is layered: two hosts, each a stack of five layers; a message goes down the sender's
// stack (each layer wrapping it), across the wire, and up the receiver's (each unwrapping): every layer talks only to
// the one below, and to its twin on the other side (dashes). Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink } from '../_kit';

const N = 5, DY = 0.42, XA = 0, XB = 4.4;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    for (const x of [XA, XB]) for (let i = 0; i < N; i++) S.push(box(x - 0.7, 0.2 + i * DY, -0.5, x + 0.7, 0.2 + i * DY + DY - 0.08, 0.5, { pig: 'violet', k: 1, tint: 0.08 + 0.07 * (N - i), shade: 0.6, bias: i * 0.01 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, 0]]);
    render(ctx, cam, S);
    const z = 0.51, top = 0.2 + N * DY - 0.2;
    arrow3(ctx, cam, [XA + 0.9, top, z], [XA + 0.9, 0.3, z], PIG.violet, 1.6, 0.9);
    ink(ctx, cam, [[XA + 0.9, 0.1, z], [XB - 0.9, 0.1, z]], PIG.violet, 1.6, 0.9);
    arrow3(ctx, cam, [XB - 0.9, 0.3, z], [XB - 0.9, top, z], PIG.violet, 1.6, 0.9);
    for (let i = 1; i < N; i++) ink(ctx, cam, [[XA + 0.75, 0.2 + i * DY + DY / 2 - 0.04, z], [XB - 0.75, 0.2 + i * DY + DY / 2 - 0.04, z]], PIG.graphite_t, 0.8, 0.4, true);
    ink(ctx, cam, [[XA - 0.7, 0.04, z], [XB + 0.7, 0.04, z]], PIG.ink, 1.4, 0.7);
  },
};
export default world;
