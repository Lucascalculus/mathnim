// F1 Choosing: the whole course as one decision map. From the need (left) a few questions branch (dots) to the method
// that fits (blocks, each in its colour): the context, RAG, SFT, LoRA, preferences, RL with checkable rewards. Seen
// from above at rest; in the world, the methods stand up at the ends of their branches.
import { PIG, box, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from './_ft';

const LEAVES: [number, string, string, string | undefined][] = [[0.3, 'context', '上下文', 'cobalt'], [1.1, 'RAG', 'RAG', 'teal'], [1.9, 'SFT', 'SFT', 'violet'], [2.7, 'LoRA', 'LoRA', 'violet'], [3.5, 'DPO', 'DPO', 'ochre'], [4.3, 'RLVR', 'RLVR', 'viridian']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    LEAVES.forEach(([z, , , pig]) => S.push(box(5.0, 0, z - 0.25, 5.6, 0.1 + 0.45 * u, z + 0.25, { pig, k: 1, tint: 0.45 })));
    S.push(box(0, 0, 2.05, 0.8, 0.3, 2.55, { shade: 0.7 }));
    frame(cam, S, w, h, [12, 12, 64, 12]);
    render(ctx, cam, S);
    const N: [number, number][] = [[2.0, 1.1], [2.0, 3.5], [3.5, 0.7], [3.5, 2.3], [3.5, 3.9]];
    const E: [number, number, number, number][] = [[0.8, 2.3, 2.0, 1.1], [0.8, 2.3, 2.0, 3.5], [2.0, 1.1, 3.5, 0.7], [2.0, 1.1, 3.5, 2.3], [2.0, 3.5, 3.5, 3.9], [3.5, 0.7, 5.0, 0.3], [3.5, 0.7, 5.0, 1.1], [3.5, 2.3, 5.0, 1.9], [3.5, 2.3, 5.0, 2.7], [3.5, 3.9, 5.0, 3.5], [3.5, 3.9, 5.0, 4.3]];
    for (const [x0, z0, x1, z1] of E) ink(ctx, cam, [[x0, 0.02, z0], [(x0 + x1) / 2, 0.02, z0], [(x0 + x1) / 2, 0.02, z1], [x1, 0.02, z1]], PIG.graphite_t, 1, 0.7);
    for (const [x, z] of N) { const p = cam.p([x, 0.02, z]); ring_dot(ctx, p[0], p[1], 4, PIG.ink, 0, 1.2); }
    words(ctx, cam, say(st, 'need', '需求'), [0.4, 0.3, 1.9], PIG.ink, 10.5);
    LEAVES.forEach(([z, en, zh, pig]) => words(ctx, cam, say(st, en, zh), [5.75, 0.1 + 0.45 * u, z + 0.12], pig ? (PIG as any)[pig] : PIG.graphite_t, 10.5, 'left'));
  },
};
export default world;
