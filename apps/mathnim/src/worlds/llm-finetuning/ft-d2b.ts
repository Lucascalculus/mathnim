// D2b The optimal policy under a KL leash: a learned reward rises to the right (ochre dashes); the policy that
// maximises reward − β·KL is the reference policy (grey) tilted toward it, the same shape moved a little (cobalt):
// the leash holds it near what the model already does. Far out the reward model is wrong (its bump, ring): without
// the leash the policy would pile onto it (thin dashes), reward hacking.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { card, curve, frame, ink, on, words } from './_ft';

const C: [number, number, number, number] = [0, 0, 6, 3.6];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), S = [card(...C)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [on(C, 0.06, 0.06), on(C, 0.97, 0.06)], PIG.ink, 0.9, 0.7);
    const bell = (x: number, m: number, v: number) => Math.exp(-((x - m) ** 2) / v);
    const rew = (x: number) => 0.12 + 0.5 * x + 0.22 * bell(x, 0.88, 0.0015);
    ink(ctx, cam, curve(C, rew, 0.06, 0.96, 72), PIG.ochre, 1.2, 0.85, true);
    ink(ctx, cam, curve(C, (x) => 0.08 + 0.7 * bell(x, 0.88, 0.0008), 0.8, 0.96, 40), PIG.cobalt, 1, 0.7, true);
    ink(ctx, cam, curve(C, (x) => 0.08 + 0.62 * bell(x, 0.3, 0.012), 0.06, 0.96), PIG.graphite_t, 1.5, 0.85);
    ink(ctx, cam, curve(C, (x) => 0.08 + 0.62 * bell(x, 0.44, 0.012), 0.06, 0.96), PIG.cobalt, 2, 0.95);
    const p = cam.p(on(C, 0.88, rew(0.88))); ring_dot(ctx, p[0], p[1], 4.5, PIG.ochre, 0, 1.4);
    words(ctx, cam, 'π_ref', on(C, 0.17, 0.62), PIG.graphite_t, 11, 'center', 0.9, 500);
    words(ctx, cam, 'π*', on(C, 0.55, 0.66), PIG.cobalt, 12);
    words(ctx, cam, say(st, 'reward', '奖励'), on(C, 0.64, 0.36), PIG.ochre, 10.5, 'left');
    words(ctx, cam, say(st, 'hacking', '钻漏洞'), on(C, 0.86, 0.9), PIG.ochre, 10.5, 'right');
  },
};
export default world;
