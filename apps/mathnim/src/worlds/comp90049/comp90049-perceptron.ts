// The perceptron, a neuron that learns from its mistakes: inputs (left) weighted (the links, as thick as their weights)
// summed in one unit and passed through a step (the output). On a mistake each weight moves toward the right answer:
// one link grows (from dashes to ink). Seen from above at rest; in the world, the inputs and the unit stand.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, words } from '../_kit';

const IN: [number, number][] = [[0, 0.3], [0, 1.5], [0, 2.7]], WT = [2.4, 0.9, 1.6], UNIT: [number, number] = [3.0, 1.5];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    IN.forEach(([x, z]) => S.push(cylinder_y(x, z, 0.3, 0, 0.06 + 0.25 * u, 20, { pig: 'teal', k: 1, tint: 0.45 })));
    S.push(cylinder_y(UNIT[0], UNIT[1], 0.55, 0, 0.08 + 0.45 * u, 28, { pig: 'cobalt', k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[6.3, 0, 1.5]]);
    render(ctx, cam, S);
    IN.forEach(([x, z], i) => ink(ctx, cam, [[x + 0.32, 0.03, z], [UNIT[0] - 0.56, 0.03, UNIT[1] + (z - UNIT[1]) * 0.25]], PIG.ink, WT[i], 0.75));
    ink(ctx, cam, [[0.32, 0.03, 1.5 - 0.12], [UNIT[0] - 0.56, 0.03, UNIT[1] - 0.04]], PIG.cobalt, 1, 0.8, true);
    arrow3(ctx, cam, [UNIT[0] + 0.6, 0.03, UNIT[1]], [4.6, 0.03, UNIT[1]], PIG.ink, 1.3, 0.85);
    const y = 0.03, s = (x: number, z: number) => [4.85 + x, y, UNIT[1] - z] as [number, number, number];
    ink(ctx, cam, [s(0, 0.05), s(0.55, 0.05), s(0.55, 0.6), s(1.1, 0.6)], PIG.cobalt, 1.8, 0.95);
    words(ctx, cam, 'Σ', [UNIT[0], 0.08 + 0.45 * u, UNIT[1] + 0.12], PIG.ink, 14, 'center', 0.8, 650);
  },
};
export default world;
