// The kernel's own kinds and motions as registry entries (the kernel cannot import a figure to build a demo, so they
// are registered here, in the library). Every figure uses these; they are the vocabulary a kit author starts from.
// A new kind is its own file with its own entry; this list only names what the kernel already has.
import { Figure } from '../kernel/figure';
import { quadratic, Field } from '../kernel/gpu';
import { Marker, Path } from '../kernel/kinds';
import { define_motion, define_thing } from '../kernel/registry';
import { reveal, set } from '../kernel/script';
import { t, type Lang } from '../kernel/text';
import { row } from '../kernel/layout';

const KINDS = 'packages/engine/src/kernel/kinds.ts', SCRIPT = 'packages/engine/src/kernel/script.ts';
const V = '0.2.0';

/** A bowl y = a x² with a point on it: the smallest complete figure (plot, path, marker, label, script). */
function curve_demo(lang: Lang): Figure {
  const fig = new Figure({ lang });
  const a = fig.param('a', 0.5, { range: [0, 2], step: 0.1 });
  const XS = Array.from({ length: 41 }, (_, i) => -2 + i / 10);
  const P = fig.plot({ id: 'plane', x: [-2, 2], y: [0, 4], x_ticks: [-2, 0, 2], y_ticks: [0, 2, 4] });
  const curve = P.add(new Path(() => XS.map((u) => [u, a.value * u * u] as [number, number]), { id: 'curve', role: 'noun:cost' }));
  const dot = P.add(new Marker(() => [1, a.value], { id: 'dot', role: 'noun:value' }));
  fig.layout(row([P]));
  fig.script(reveal(P, curve, dot), set(a, 1.5, 'travel'));
  return fig;
}
function field_demo(lang: Lang): Figure {
  const fig = new Figure({ lang });
  const P = fig.plot({ id: 'bowl', x: [-2, 2], y: [-2, 2], aspect: 'equal', x_ticks: [-2, 0, 2], y_ticks: [-2, 0, 2] });
  P.add(new Field(quadratic(() => [0, 0, 1, 0.4, 1.6]), { id: 'cost', role: 'noun:cost', levels: [0.5, 1, 2, 3], range: [0, 6] }));
  fig.layout(row([P]));
  return fig;
}

const thing = (name: string, says: [string, string], syntax: string, o: { source?: string; demo?: (l: Lang) => Figure; rules?: string[]; internal?: boolean; since?: string } = {}) =>
  define_thing({ name, says: t(...says), zones: ['figure', 'world'], maturity: 'stable', since: o.since ?? V, syntax, source: o.source ?? KINDS, demo: o.demo, rules: o.rules, internal: o.internal });

thing('plot', ['a plane with axes, where marks are drawn in the data\'s own coordinates', '带坐标轴的平面，标记按数据坐标画在上面'], "fig.plot({ id, x: [x0, x1], y: [y0, y1], x_ticks, y_ticks, aspect })", { demo: curve_demo });
thing('path', ['a curve or polyline; it can draw itself on (upto) and carry arrowheads along it', '一条曲线或折线；可以一点点画出来（upto），也能沿线带箭头'], "P.add(new Path(() => pts, { id, role: 'noun:…', upto, heads }))", { demo: curve_demo });
thing('region', ['a filled area: a set, a constraint, what is allowed', '一块填色区域：集合、约束、允许的范围'], "P.add(new Region(() => pts, { id, role }))");
thing('marker', ['a point: a dot, ring, cross, square or arrow tip; a ring is a guess', '一个点：圆点、圆圈、叉、方块或箭头；空心圈表示猜测'], "P.add(new Marker(() => [x, y], { id, role, shape }))", { demo: curve_demo });
thing('dots', ['many points at once (data, samples)', '一次画很多点（数据、样本）'], "P.add(new Dots(() => pts, { id, role }))");
thing('arrow', ['an arrow from a point to a point (a vector, a step)', '从一点指向另一点的箭头（向量、一步）'], "P.add(new Arrow(() => from, () => to, { id, role }))");
thing('drawn', ['a shape drawn by hand in code, for what no kind covers', '用代码自己画的形状，给没有现成种类的东西'], "P.add(new Drawn((env, plot) => { …; return box }, { id, role }))");
thing('handle', ['glass where the hand can move a value; it shows only where it can be moved', '手能拖动数值的玻璃；只在能拖的时候出现'], "fig.handle(P, px, py, { id, says, to, at })", { rules: ['only when moving it is the concept (INTERACTION-BAR)'] });
thing('label', ['words attached to a thing, placed where they hide least', '贴在东西旁边的字，放在挡得最少的地方'], "fig.label('y = a x^2', thing, { tex: true })");
thing('caption', ['a paragraph in the figure, with nouns in their colour', '图里的一段话，名词带颜色'], "fig.caption(t('the [cost](noun:cost) is a bowl', '[代价](noun:cost)是一个碗'))");
thing('list', ['items revealed one by one', '一条一条出现的列表'], "fig.list([t('…', '…'), …])");
thing('readout', ['a value read off the figure: TeX and numbers whose digits never jump sideways', '从图上读出的值：公式和数字，数字不会左右跳'], "fig.readout([{ tex: 'J = ' }, { value: () => J.value, decimals: 2 }])");
thing('legend', ['a key: a swatch in each role\'s colour and its name', '图例：每个角色的颜色和名字'], "fig.legend([{ role: 'noun:cost', text: t('cost', '代价') }])");
thing('canvas', ['the escape hatch: paint anything on a 2D canvas, keeping the boundary contract', '逃生口：在 2D 画布上随便画，守住边界合约'], "fig.canvas((env, box) => { … }, { id, says })", { rules: ['keep a box, an id and role for what is exposed, says, and its checks'] });
thing('field', ['a scalar field shaded with its level lines, on the GPU where there is one, the same picture on the CPU', '标量场：带等值线的着色，有 GPU 用 GPU，没有就用 CPU 画同一张图'], "P.add(new Field(quadratic(() => [cx, cy, H11, H12, H22]), { role: 'noun:cost', levels: [1, 2, 3] }))", { source: 'packages/engine/src/kernel/gpu.ts', demo: field_demo, since: '0.2.1' });
thing('sim', ['a simulation on the figure\'s clock: a fixed step, so it seeks exactly and replays bit for bit', '跟着图的时钟走的模拟：固定步长，所以能精确跳转、逐位重放'], "fig.sim({ inputs, start, accel | deriv, method, dt, max_t })", { source: 'packages/engine/src/kernel/sim.ts', since: '0.2.1' });

const motion = (name: string, says: [string, string], syntax: string, source = SCRIPT) =>
  define_motion({ name, says: t(...says), zones: ['figure', 'world'], maturity: 'stable', since: V, syntax, source });
motion('reveal', ['things come in, each as its kind does (a path draws on, a word writes)', '东西出现，各按各的方式（线一点点画出，字一笔笔写）'], 'reveal(...things)');
motion('hide', ['things go', '东西退场'], 'hide(...things)');
motion('set', ['a value moves to another with an intent (travel, grow, converge, settle…), so the picture follows', '一个值带着意图变到另一个值（移动、生长、收敛、落定…），图跟着变'], "set(param, to, 'travel', dur?)");
motion('wait', ['a pause', '停一下'], 'wait(seconds)');
motion('beat', ['a § of the narration: the voice and the picture meet here', '旁白的一个段落：声音和画面在这里对齐'], 'beat()');
motion('together', ['steps at the same time', '几步同时进行'], 'together(...steps)');
motion('seq', ['steps one after another', '几步依次进行'], 'seq(...steps)');
motion('lagged', ['steps started one after another, overlapping', '几步依次开始，彼此重叠'], 'lagged(lag, ...steps)');
motion('call', ['your own motion: a function of u from 0 to 1 over the params it names', '自己的动作：u 从 0 到 1 的函数，作用在它列出的参数上'], 'call(dur, (u) => …, [params])');
motion('over', ['a step stretched or squeezed to a duration', '把一步拉长或压缩到某个时长'], 'over(dur, step)');
motion('run', ['a simulation runs for a while, as part of the script', '让模拟跑一段时间，作为脚本的一部分'], 'run(sim, seconds)', 'packages/engine/src/kernel/sim.ts');
