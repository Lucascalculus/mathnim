// Linear regression: the loss, the closed form, gradient descent. The squared error over the two weights (w₀, w₁) is a
// bowl, seen from above as its contour rings; gradient descent walks downhill in steps across them (dots), toward the
// bottom the closed form jumps to directly (ring). Seen from above at rest.
import { PIG, render, ring_dot, turned, type V3 } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, panel } from '../_kit';

const C: [number, number] = [0.62, 0.55], TH = -0.6, A = 0.5, B = 0.19;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), P = panel(0, 0, 5.6, 4.1);
    frame(cam, [P.card], w, h, [12, 12, 12, 12]);
    render(ctx, cam, [P.card]);
    P.axes(ctx, cam, 1, ['w₀', 'w₁']);
    const pt = (a: number, b: number): [number, number] => [C[0] + a * Math.cos(TH) - b * Math.sin(TH), C[1] + a * Math.sin(TH) + b * Math.cos(TH)];
    for (let k = 1; k <= 5; k++) { const ring: V3[] = []; for (let i = 0; i <= 72; i++) { const t = (i / 72) * Math.PI * 2, [q, p] = pt(A * k * 0.25 * Math.cos(t), B * k * 0.25 * Math.sin(t)); ring.push(P.at(q, p)); } ink(ctx, cam, ring, PIG.graphite_t, 1, 0.3 + 0.06 * (6 - k)); }
    // gradient descent on f = a²/A² + b²/B² in the rotated frame: steps zigzag across the narrow valley
    let a = -1.15 * A, b = 1.0 * B; const path: [number, number][] = [[a, b]];
    for (let i = 0; i < 7; i++) { a -= 0.32 * a; b -= 1.75 * b; path.push([a, b]); }
    const pts = path.map(([x, y]) => pt(x, y));
    for (let i = 0; i < pts.length - 1; i++) arrow3(ctx, cam, P.at(...pts[i]), P.at(...pts[i + 1]), PIG.cobalt, 1.2, 0.85);
    for (const p of pts.slice(0, -1)) { const s = cam.p(P.at(...p)); ring_dot(ctx, s[0], s[1], 2.6, PIG.cobalt, 1, 1); }
    const m = cam.p(P.at(...C)); ring_dot(ctx, m[0], m[1], 5.5, PIG.ink, 0, 1.6);
  },
};
export default world;
