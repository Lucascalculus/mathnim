// Ensembles: several models (small stacks, each trained differently) each give an answer (the form on top); the
// ensemble takes the vote: three round against two square, so round (the larger form). Bagging, boosting and stacking
// differ in how the models are made and combined. Seen from above at rest; in the world, the models stand.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame } from '../_kit';
import { form } from './_ml';

const VOTES = [0, 1, 0, 0, 1];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    VOTES.forEach((v, i) => {
      const z = i * 0.95, hh = 0.06 + 0.45 * u;
      S.push(box(0, 0, z - 0.32, 0.9, hh, z + 0.32, { shade: 0.6 }));
      const f = form(0.45, z, v, 0.14, 0.15); for (const p of f.pts) p[1] += hh - 0.05; f.c[1] += hh - 0.05; S.push(f);
    });
    S.push(form(3.6, 1.9, 0, 0.3 + 0.3 * u, 0.32));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    VOTES.forEach((v, i) => arrow3(ctx, cam, [1.05, 0.03, i * 0.95], [3.1, 0.03, 1.9 + (i - 2) * 0.12], v ? PIG.ochre : PIG.cobalt, 1.1, 0.7));
  },
};
export default world;
