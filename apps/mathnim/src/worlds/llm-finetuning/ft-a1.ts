// A1 Five ways to make a model do something: where each acts on the model. A model is a stack of layers; the prompt and
// retrieved documents go into its input (the context, left), an SFT run changes every layer (the bracket), LoRA slides
// out one small drawer beside them, and preferences act on what comes out (top). Seen from the front at rest.
import { PIG, box, render, turned, type V3 } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, stack, words } from './_ft';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true);
    const m = stack(0, 0, 7, { style: (i) => (i === 4 ? { pig: 'violet', k: 0.35, tint: 0.5 } : {}) });
    const S = [...m.solids];
    S.push(box(1.25, m.y(4) + 0.02, -0.5, 2.05, m.y(4) + 0.1, 0.1, { pig: 'violet', k: 1, tint: 0.85, shadow: false }));
    for (let i = 0; i < 3; i++) S.push(box(-3.5 + i * 0.38, 0, -0.05, -3.2 + i * 0.38, 0.75, 0.05, { pig: i === 2 ? 'teal' : undefined, k: 1, tint: 0.45 }));
    S.push(box(-2.05, 0, -0.05, -1.7, 0.55, 0.05, { pig: 'cobalt', k: 1, tint: 0.5 }));
    S.push(box(-0.6, m.top + 0.32, -0.3, 0.6, m.top + 0.46, 0.3, { pig: 'ochre', k: 1, tint: 0.5 }));
    const extra: V3[] = [[-3.7, m.top + 0.9, 0], [2.9, m.top + 0.9, 0]];
    frame(cam, S, w, h, [12, 14, 12, 14], extra);
    render(ctx, cam, S);
    arrow3(ctx, cam, [-2.9, 0.4, 0], [-2.2, 0.4, 0], PIG.teal, 1.2, 0.9);
    arrow3(ctx, cam, [-1.6, 0.3, 0], [-1.25, 0.3, 0], PIG.cobalt, 1.2, 0.9);
    ink(ctx, cam, [[1.35, 0.02, 0.85], [1.5, 0.02, 0.85], [1.5, m.top, 0.85], [1.35, m.top, 0.85]], PIG.ink, 1, 0.7);
    words(ctx, cam, say(st, 'prompt', '提示'), [-1.88, 0.75, 0], PIG.cobalt, 10.5);
    words(ctx, cam, 'RAG', [-3.13, 0.95, 0], PIG.teal, 10.5);
    words(ctx, cam, 'LoRA', [2.1, m.y(4) + 0.3, 0], PIG.violet, 10.5, 'left');
    words(ctx, cam, 'SFT', [1.62, m.top * 0.42, 0.85], PIG.ink, 10.5, 'left');
    words(ctx, cam, say(st, 'preferences', '偏好'), [0, m.top + 0.68, 0], PIG.ochre, 10.5);
  },
};
export default world;
