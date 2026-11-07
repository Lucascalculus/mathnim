// D2a From policy gradient to PPO: the clipped objective. For an action better than expected, the objective rises
// with how much more likely the new policy makes it (the ratio r), but only inside a band round 1 (teal): past 1+ε it
// stays flat, so one update cannot run away. The unclipped line goes on in dashes. Seen from above at rest, the plot.
import { PIG, render, turned } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, on, wash, words } from './_ft';

const C: [number, number, number, number] = [0, 0, 6, 3.6];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), S = [card(...C)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const X = (r: number) => 0.08 + (r / 2.2) * 0.88, Y = (o: number) => 0.1 + o * 0.38;
    wash(ctx, cam, [on(C, X(0.8), 0.06), on(C, X(1.2), 0.06), on(C, X(1.2), 0.95), on(C, X(0.8), 0.95)], PIG.teal, 0.14);
    ink(ctx, cam, [on(C, 0.08, 0.95), on(C, 0.08, 0.06), on(C, 0.97, 0.06)], PIG.ink, 0.9, 0.7);
    ink(ctx, cam, [on(C, X(1.2), Y(1.2)), on(C, X(2.2), Y(2.2))], PIG.graphite_t, 1.2, 0.8, true);
    ink(ctx, cam, [on(C, X(0), Y(0)), on(C, X(1.2), Y(1.2)), on(C, X(2.2), Y(1.2))], PIG.cobalt, 2, 0.95);
    words(ctx, cam, '1−ε', on(C, X(0.8), 0.0, 0.052), PIG.teal, 10.5);
    words(ctx, cam, '1+ε', on(C, X(1.2), 0.0, 0.052), PIG.teal, 10.5);
    words(ctx, cam, 'r', on(C, 0.95, 0.12), PIG.ink, 11.5);
  },
};
export default world;
