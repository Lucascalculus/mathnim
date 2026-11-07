// E2 The full recipe of a reasoning model (DeepSeek-R1): its stages in order, SFT stages cobalt and RL stages
// viridian: a base model, a cold start of a few long worked answers, RL on checkable problems, rejection-sampled SFT,
// and RL again. Seen from above at rest, the pipeline; in the world, each stage stands taller than the last.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from './_ft';

const STAGES: [string, string, string | undefined][] = [['base', '基座', undefined], ['cold start', '冷启动 SFT', 'cobalt'], ['RL', 'RL', 'viridian'], ['rejection SFT', '拒绝采样 SFT', 'cobalt'], ['RL', 'RL', 'viridian']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], dx = 1.55;
    STAGES.forEach(([, , pig], i) => S.push(box(i * dx, 0, 0, i * dx + 1.0, 0.12 + (0.25 + i * 0.22) * u, 1.0, { pig, k: 1, tint: 0.45 })));
    frame(cam, S, w, h, [12, 14, 12, 26], [[0, 0, 1.6], [STAGES.length * dx, 0, 1.6]]);
    render(ctx, cam, S);
    for (let i = 0; i < STAGES.length - 1; i++) arrow3(ctx, cam, [i * dx + 1.05, 0.08, 0.5], [(i + 1) * dx - 0.05, 0.08, 0.5], PIG.ink, 1.1, 0.7);
    STAGES.forEach(([en, zh, pig], i) => words(ctx, cam, say(st, en, zh), [i * dx + 0.5, 0.02, 1.45], pig ? (PIG as any)[pig] : PIG.graphite_t, 10, 'center'));
  },
};
export default world;
