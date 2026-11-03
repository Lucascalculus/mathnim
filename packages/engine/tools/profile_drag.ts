// Where a drag frame of a figure goes (node, CPU canvas): node tools/profile_drag.mjs
import { createCanvas } from '@napi-rs/canvas';
import { load_tex } from '../src/index';
import { use_node_canvas } from '../node';
import { qp_figure } from '../../visuals/src/mpc/qp_figure';
import { qp_view } from '../../visuals/src/mpc/qp_plane';

use_node_canvas();
await load_tex();
const fig = qp_figure({ story: 'setup', p0: 9, v0: 0.2, clip: true, lang: 'en' });
fig.build();
fig.layout_for(984, 554);
fig.at(fig.duration);
const g = createCanvas(1968, 1108).getContext('2d') as unknown as CanvasRenderingContext2D;
fig.draw(g, 2, { force: true });
const N = 60;
let t = performance.now();
for (let k = 0; k < N; k++) qp_view([5 + (k % 30) * 0.15, 0.2 + (k % 20) * 0.08]);
console.log(`qp_view (solve + polygon): ${((performance.now() - t) / N).toFixed(2)} ms`);
const per: Record<string, number> = {};
// time each thing's draw by wrapping it
for (const th of fig.registry.all()) {
  const d = th.draw.bind(th);
  th.draw = (env) => {
    const t0 = performance.now();
    d(env);
    per[th.id] = (per[th.id] ?? 0) + performance.now() - t0;
  };
}
t = performance.now();
for (let k = 0; k < N; k++) {
  fig.set_state(5 + (k % 30) * 0.15, 0.2 + (k % 20) * 0.08);
  fig.draw(g, 2);
}
const total = (performance.now() - t) / N;
console.log(`drag frame: ${total.toFixed(2)} ms; layers rebuilt ${fig.renderer.stats.layers_rebuilt}`);
for (const [k, v] of Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${k}: ${(v / N).toFixed(2)} ms`);
