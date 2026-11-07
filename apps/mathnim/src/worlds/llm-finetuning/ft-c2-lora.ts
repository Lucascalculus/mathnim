// C2 LoRA: learn a low-rank correction. The big weight matrix W stays frozen (plaster); the change ΔW (dashes, the
// same size) is made of two thin matrices: B, tall and narrow, and A, wide and short (violet): ΔW = BA, a sliver of
// the parameters. Seen from above, the shapes; in the world, only B and A stand up: they are what trains.
import { PIG, box, render, turned } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from './_ft';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), hgt = 0.06 + 0.5 * u;
    const S = [card(0, 0, 3, 3, { shade: 0.6 }), card(4.35, 0, 7.35, 3, { kind: 'wire', pig: 'violet', solid: 0, alpha: 0.55 }),
      box(3.5, 0, 0, 3.92, hgt, 3, { pig: 'violet', k: 1, tint: 0.55 }), box(4.35, 0, -0.95, 7.35, hgt, -0.53, { pig: 'violet', k: 1, tint: 0.55 })];
    frame(cam, S, w, h, [12, 12, 12, 16], [[0, 0, 3.5]]);
    render(ctx, cam, S);
    words(ctx, cam, 'W', [1.5, 0.06, 1.65], PIG.ink, 15, 'center', 0.8, 650);
    words(ctx, cam, say(st, 'frozen', '冻结'), [1.5, 0.06, 2.35], PIG.graphite_t, 10.5, 'center', 0.9, 500);
    words(ctx, cam, 'B', [3.71, hgt, 1.65], PIG.violet, 12.5);
    words(ctx, cam, 'A', [5.85, hgt, -0.6], PIG.violet, 12.5);
    words(ctx, cam, 'ΔW = BA', [5.85, 0.06, 1.65], PIG.violet, 13, 'center', 0.95, 650);
  },
};
export default world;
