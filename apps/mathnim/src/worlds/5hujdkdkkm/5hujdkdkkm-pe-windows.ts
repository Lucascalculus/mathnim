// After one frame goes wrong: go-back-N and selective repeat. Frame 3 is lost (ochre). Go-back-N (above) sends 3 and
// everything after it again (dashes); selective repeat (below) sends only 3 again. Seen from above at rest; in the
// world, the frames sent twice stand taller.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const N = 8, LOST = 3;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], D = 0.7;
    for (let r = 0; r < 2; r++) for (let i = 1; i <= N; i++) {
      const again = r === 0 ? i >= LOST : i === LOST, z = r * 1.4;
      S.push(box(i * D, 0, z, i * D + 0.58, 0.05 + (again ? 0.4 : 0.12) * u, z + 0.58, i === LOST ? { pig: 'ochre', k: 1, tint: 0.55 } : again ? { pig: 'violet', k: 1, tint: 0.55 } : { pig: 'violet', k: 1, tint: 0.18 }));
    }
    frame(cam, S, w, h, [12, 12, 12, 12], [[-2.4, 0, 0.4], [-2.4, 0, 1.8]]);
    render(ctx, cam, S);
    for (let r = 0; r < 2; r++) for (let i = 1; i <= N; i++) { const again = r === 0 ? i >= LOST : i === LOST; words(ctx, cam, String(i), [i * D + 0.29, 0.05 + (again ? 0.4 : 0.12) * u, r * 1.4 + 0.4], PIG.ink, 10, 'center', 0.8, 650); }
    words(ctx, cam, say(st, 'go-back-N', '回退 N 帧'), [0.45, 0.05, 0.4], PIG.ink, 10.5, 'right');
    words(ctx, cam, say(st, 'selective repeat', '选择重传'), [0.45, 0.05, 1.8], PIG.ink, 10.5, 'right');
  },
};
export default world;
