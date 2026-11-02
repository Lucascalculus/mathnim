// The design previews' data (data.js): the real courses, units, lessons, minutes and thumbnails, with a made-up
// learner part-way through three of them. Run from the repo root: node docs/design/ui-2026-11/make_data.mjs
import fs from 'node:fs';

const manifest = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('= {', src.indexOf('export const MANIFEST')) + 2;
  const end = src.indexOf('\n};', start) + 2;
  return JSON.parse(src.slice(start, end));
};
const zh = (x) => (typeof x === 'string' ? x : x?.zh ?? x?.en ?? '');
// the lesson's figure at 1920 × 1080 (hi/, rendered from the thumbnail scene) and its detail: the 16:10 window with
// the most coloured ink (crops.json, from crops.py), so a small plate shows a readable piece, not the whole shrunk
const HI = 'docs/design/ui-2026-11/hi';
const CROPS = JSON.parse(fs.readFileSync('docs/design/ui-2026-11/crops.json', 'utf8'));
const thumb = (id) => (fs.existsSync(`${HI}/${id}.zh.webp`) ? `hi/${id}.zh.webp` : fs.existsSync(`${HI}/${id}.en.webp`) ? `hi/${id}.en.webp` : null);
const lessons = (list) => list.map((l) => ({ id: l.id, title: zh(l.title), summary: zh(l.summary), minutes: l.minutes, thumb: thumb(l.id), crop: CROPS[l.id] ?? null }));

// one accent per course, all at the same perceived lightness and similar chroma (OKLCH), only the hue differs, so no
// course looks more important than another when they sit side by side
function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const g = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)));
  return '#' + lin.map((x) => g(x).toString(16).padStart(2, '0')).join('');
}
const accent = (h) => oklch(0.54, 0.135, h);

const ft = manifest('apps/mathnim/src/lessons/ft/manifest.generated.ts');
const mpc = manifest('apps/mathnim/src/lessons/mpc/manifest.generated.ts');
const demo = JSON.parse(fs.readFileSync('apps/mathnim/public/demo/courses.json', 'utf8'));
const fromDemo = (id) => {
  const c = demo.find((x) => x.id === id);
  const by = new Map(c.lessons.map((l) => [l.id, l]));
  return { units: c.units.map((u) => ({ title: zh(u.title), lessons: lessons(u.lessons.map((id) => by.get(id))) })), title: zh(c.title), summary: zh(c.summary) };
};

const courses = [
  { id: 'llm-finetuning', title: '大模型微调', short: '微调', category: 'AI', accent: accent(295), cover: '../../../apps/mathnim/public/courses/llm-finetuning/map.zh.webp',
    summary: '提示词、RAG、SFT、LoRA、偏好与强化学习：什么时候用哪一种，以及它们各自怎么工作。',
    units: ft.units.map((u) => ({ title: zh(u.title).replace(/^微调 · /, ''), lessons: lessons(u.lessons) })) },
  { id: 'mpc', title: '模型预测控制', short: 'MPC', category: 'AI', accent: accent(185), cover: '../../../apps/mathnim/public/courses/mpc/horizon.zh.webp',
    audience: '懂线性代数和微积分的大学生与工程师',
    outcomes: ['说清 MPC 在做什么：用模型预测未来、解一个优化问题、只执行第一步、下一刻重来', '把一个带约束的控制问题写成二次规划，并用代码解出来', '判断什么时候该用 MPC 而不是 PID 或 LQR，懂稳定、可行和实时的取舍'],
    prereq: { line: '会线性代数（矩阵、特征值）和微积分就够了，懂一点最小二乘更好。', links: ['Brunton：Control Bootcamp', 'Boyd：《凸优化》第 4 章', 'Rawlings：《模型预测控制》'] },
    summary: '预测、代价、约束、二次规划、稳定与可行、非线性 MPC：让一辆小车在限制之内停到墙边。',
    units: mpc.units.map((u) => ({ title: zh(u.title), lessons: lessons(u.lessons) })) },
  { id: 'math', title: '在运动中学几何', short: '几何', category: '中学数学', accent: accent(255), cover: 'hi/pizza.en.webp',
    summary: '圆的面积、圆与角、特征向量：亲手拖动，看着结论自己长出来。',
    units: [
      { title: '圆与面积', lessons: [{ id: 'pizza-game', title: '披萨店', summary: '一张 16 寸还是两张 8 寸？把圆切开拼成长方形。', minutes: 15, thumb: thumb('pizza-game') }] },
      { title: '线性代数（大学）', lessons: [{ id: 'eigen-pca', title: '特征向量与 PCA', summary: '把矩阵握在手里，看清特征向量为什么正是 PCA 需要的。', minutes: 20, thumb: thumb('eigen-pca') }] },
      { title: '角与圆', lessons: [{ id: 'best-angle', title: '最佳射门角', summary: '边锋插上：球门在哪里看起来最宽？圆给出答案。', minutes: 15, thumb: thumb('best-angle') }] },
    ] },
  { id: '5hujdkdkkm', category: '由课件生成', accent: accent(65), ...fromDemo('5hujdkdkkm'), title: 'Internet Technologies' },
  { id: 'econ90015', category: '由课件生成', accent: accent(15), ...fromDemo('econ90015'), title: 'ECON90015 模考精讲' },
];

// a learner part-way through three courses (done lessons, then the current one)
const progress = { mpc: { done: 1, current: 'mpc-m2-model', step: 6, steps: 14 }, 'llm-finetuning': { done: 3, current: 'ft-b1-sft-mechanics', step: 7, steps: 16 }, econ90015: { done: 9, current: 'econ90015-pq-games', step: 3, steps: 11 } };
for (const c of courses) {
  const all = c.units.flatMap((u) => u.lessons);
  const p = progress[c.id];
  all.forEach((l, i) => (l.status = !p ? 'new' : i < p.done ? 'done' : l.id === p.current ? 'current' : 'new'));
  c.lessonCount = all.length;
  c.minutes = all.reduce((n, l) => n + (l.minutes || 0), 0);
  if (p) c.progress = p;
}

// MPC lesson 2 as the learner reads it (apps/mathnim/tools/lesson_text.mjs mpc-m2-model zh): every step's kind and
// title, and four steps in full (a page to read, a guess, a scene, the reading after the world), with the formulas
// typeset by MathJax here so the previews need no network
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mj = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) });
const tex = (t, display) => adaptor.outerHTML(mj.convert(t, { display }));
const escape = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
/** Lesson prose: $$display$$, $inline$, **bold**, *italic*. */
const md = (x) =>
  x.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/).map((part) => {
    if (part.startsWith('$$')) return tex(part.slice(2, -2), true);
    if (part.startsWith('$')) return tex(part.slice(1, -1), false);
    return escape(part).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
  }).join('');

const lesson = {
  course: 'mpc', id: 'mpc-m2-model', title: '模型：从物理到预测', minutes: 30,
  summary: '把小车精确离散化，用 X = Φx₀ + ΓU 预测整个计划，并看清线性预测为什么让 MPC 成为 QP。',
  steps: [
    ['read', '规划好不好，全看预测准不准'], ['derive', '小车的一步'], ['read', '为什么不直接用欧拉法？'], ['derive', '把模型展开：X = Φx₀ + ΓU'],
    ['check', '先猜一猜'], ['scene', '总量相同，时机不同'], ['explore', '自己规划这次停车'], ['read', '这个世界说明了什么'],
    ['code', '二十行代码算出 Φ 和 Γ'], ['read', '关键事实：预测对计划是线性的'], ['check', '读出速度'], ['check', '用欧拉模型规划'],
    ['check', '可疑的 Γ'], ['check', '解释一下'],
  ].map(([kind, title], i) => ({ n: i + 1, kind, title })),
  // the learner is on step 6; steps 1–5 are done
  at: 6,
  pages: {
    1: {
      paras: [
        md('M1 里的规划器一直在问同一个问题：*如果我按这 $N$ 个加速度去开，小车每一步会在哪？* 它考虑的每个计划都要回答一遍；墙之所以拦得住小车，只是因为预测说了一句“这个计划会越过 10 米”。回答这个问题的规则，就是**模型**。'),
        md('MPC 的模型要同时做到三件事：**准**，在控制器自己的采样周期上，对系统的描述是对的；**快**，优化器每个采样周期都要反复用它；**形状对**，让优化问题保持好解。'),
        md('这节课从物理出发，把小车的模型搭出来，三件事逐一核对。第三件最出人意料：预测对计划是**线性**的，而 MPC 之所以能解得又快又稳，靠的就是这一点。'),
      ],
      asks: ['“形状对”具体指什么形状？', '为什么不能直接用更细的模拟？'],
    },
    5: {
      q: md('计划 A 在前五根柱子（$u_0$ 到 $u_4$）上以 −1 m/s² 刹车，计划 B 在后五根（$u_5$ 到 $u_9$）上刹。刹车总量一样。$k = 10$ 时哪个说法对？'),
      options: [md('速度一样，位置也一样'), md('速度一样；B 停得更远'), md('速度一样；A 停得更远'), md('$k = 10$ 时 B 还在动')],
      right: 1, chosen: 0,
      explain: md('两者都是 $\\sum u_j = -5$，所以 $v_{10}$ 都是 0。可是 B 先以全速滑行了半秒：A 停在 9.825 米，B 停在 10.075 米，穿过了墙。'),
    },
    6: {
      figure: thumb('mpc-m2-model'),
      caption: '模拟：小车从 9.7 米处以 0.5 m/s 滑向 10 米处的墙，Δt = 0.1 秒，N = 10',
      lines: ['十根柱子，就是十个计划好的加速度，每个保持十分之一秒。下面是预测的速度和位置。虚线是一直滑行：小车最后会冲进墙里二十厘米。',
        '在前五根柱子上用力刹车。速度降到零，小车在离墙十七点五厘米的地方停下。',
        '现在把同样的刹车挪到后五根柱子。最后的速度还是零，因为速度只是把柱子加起来。',
        '可小车先全速滑行了半秒，所以最后停在墙后七点五厘米。总量相同，时机不同，位置就不同。柱子下面的灰色数字，说的就是差多少。'],
      line: 3, seconds: 38, at: 27,
      asks: ['为什么速度只看总量？', '灰色数字是怎么算出来的？'],
    },
    8: {
      paras: [
        md('你刚才在调的两个数，就是 $\\Gamma$ 的最后一个块行。**速度**给每根柱子同样的权重 $\\Delta t$：只看总量，要停住就得 $\\sum u_j = -5$。**位置**给第 $j$ 根柱子的权重是 $(9.5 - j)\\,\\Delta t^2$：早刹比晚刹减掉更多距离。'),
        md('把两条放在一起，有个很漂亮的读法。只要小车最后停住，它走过的距离就等于初速度乘以**刹车的平均时刻** $t_c$：'),
        md('$$ p_N - p_0 = v_0\\, t_c, \\qquad t_c = \\frac{\\sum_j (j + \\tfrac12)\\Delta t\\; u_j}{\\sum_j u_j} $$'),
        md('就好像所有刹车都集中在 $t_c$ 这一瞬间：在那之前，小车一直保持 0.5 m/s。早刹的计划 $t_c = 0.25$ 秒，走 12.5 厘米；晚刹的 $t_c = 0.75$ 秒，走 37.5 厘米。停靠要走 30 厘米，所以 $t_c = 0.6$ 秒。'),
      ],
      aside: md('十根柱子，两个方程：能停靠的计划有很多。哪一个**最好**（最平顺？最快？），模型回答不了，那是代价函数的事，M3 讲。'),
      asks: ['$t_c$ 和物理里的质心有关系吗？', '如果最后没有停住，这个读法还成立吗？'].map(md),
      note: { para: 1, q: '为什么刹车可以看成“集中在一瞬间”？', a: md('因为距离对每根柱子都是线性的：把刹车按力度加权，求出它们的平均时刻 $t_c$，总效果就和在 $t_c$ 那一刻一次刹完一样。这和用质心代替一个物体的全部质量，是同一种算法。') },
    },
  },
};
const next_lesson = { id: 'mpc-m3-cost', title: '代价：想要什么', minutes: 30, thumb: thumb('mpc-m3-cost'), crop: CROPS['mpc-m3-cost'] };
Object.assign(lesson, { next: next_lesson });
fs.writeFileSync('docs/design/ui-2026-11/data.js', `// Generated by make_data.mjs - the real courses, with a made-up learner.\nwindow.MN = ${JSON.stringify({ courses, lesson }, null, 1)};\n`);
console.log(courses.map((c) => `${c.id}: ${c.units.length} units, ${c.lessonCount} lessons, ${c.minutes} min`).join('\n'));
