// C1 The memory budget: why every trained parameter costs 16 bytes. One parameter's bytes laid out as a 4 × 4 tile of
// cubes: its weight and its gradient (bf16, 2 bytes each), then an fp32 master copy of the weight and Adam's two
// moments (4 bytes each, violet): the optimizer's states are three quarters of it, the weight the smallest part.
// Seen from above at rest, the tile; in the world, the bytes stand up.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from './_ft';

// each row: four bytes, what holds them, the row's name
const ROWS: [(string | undefined)[], number, string, string][] = [
  [[undefined, undefined, 'cobalt', 'cobalt'], 0.45, 'weight · gradient', '权重 · 梯度'],
  [['violet', 'violet', 'violet', 'violet'], 0.3, 'fp32 master copy', 'fp32 主权重'],
  [['violet', 'violet', 'violet', 'violet'], 0.45, 'Adam m', 'Adam 一阶矩'],
  [['violet', 'violet', 'violet', 'violet'], 0.6, 'Adam v', 'Adam 二阶矩'],
];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], s = 0.62, g = 0.08;
    ROWS.forEach(([bytes, tint], r) => bytes.forEach((pig, c) => {
      const x = c * s + (c >= 2 && r === 0 ? 0.1 : 0), z = r * s + (r >= 1 ? 0.14 : 0);
      S.push(box(x, 0, z, x + s - g, 0.08 + 0.42 * u, z + s - g, { pig, k: 1, tint: pig ? tint : 0, shade: 0.6, bias: r * 0.01 }));
    }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[-1.7, 0, 1.2], [4 * s + 2.6, 0, 1.2]]);
    render(ctx, cam, S);
    const top = 0.08 + 0.42 * u;
    ROWS.forEach(([bytes, , en, zh], r) => words(ctx, cam, say(st, en, zh), [4 * s + 0.22, top, r * s + (r >= 1 ? 0.14 : 0) + s / 2 + 0.1], bytes[0] ? PIG.violet : PIG.ink, 10.5, 'left', 0.95, r === 0 ? 500 : 600));
    // the count, beside the tile from above; it gives way as the camera turns (it would sit on the cubes)
    const fade = Math.max(0, 1 - 2.5 * u);
    words(ctx, cam, '16', [-0.35, top, 1.35], PIG.ink, 22, 'right', 0.9 * fade, 650);
    words(ctx, cam, say(st, 'bytes', '字节'), [-0.35, top, 1.85], PIG.graphite_t, 10.5, 'right', 0.95 * fade, 500);
  },
};
export default world;
