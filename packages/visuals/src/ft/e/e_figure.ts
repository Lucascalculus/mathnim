// Static diagrams for part E (no handles), drawn in the learner's language:
//   grpo_loop        - one GRPO step, and what PPO vs GRPO keep in memory (E1)
//   rollout_timeline - synchronous vs asynchronous rollouts, and the
//                      rollout/trainer probability mismatch (E2)
//   agentic          - an agentic RL trajectory: which tokens are trained (E2)
//   mopd             - multi-teacher on-policy distillation (E3)
//   task_vectors     - adding task vectors: harmless along the other task's
//                      flat direction, harmful along its steep one (E3)
import { Create, Ellipse, FadeIn, GrowArrow, LaggedStart, Scene, VGroup } from 'manim-web';
import { Dot } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { arrow, dashed, tex } from '../../linalg/kit';
import { LANG_SPEC, label, label_at, mixed, pick, polyline, rect, resolve_lang, rrect, textbox, type Lang } from './kit';

export interface EFigureParams extends Record<string, unknown> {
  which: string;
  lang: string;
}
const WHICH = ['grpo_loop', 'rollout_timeline', 'agentic', 'mopd', 'task_vectors', 'zero_var', 'r1_zero_curves', 'qwen3_distill_rl'];

export const e_figure = define_visual<EFigureParams>({
  name: 'e_figure',
  summary: "Diagrams for the reasoning/distillation lessons: 'grpo_loop' (sample a group, verify, group baseline, update; PPO's four models vs GRPO's), 'rollout_timeline' (sync vs async rollouts, rollout/trainer mismatch), 'agentic' (which tokens of a tool-using trajectory are trained), 'mopd' (multi-teacher on-policy distillation), 'task_vectors' (why adding task vectors sometimes interferes); data charts 'zero_var' (p^G + (1-p)^G), 'r1_zero_curves' (R1-Zero AIME accuracy and length during RL, approximate readings of the paper's figures), 'qwen3_distill_rl' (Qwen3-8B: RL vs on-policy distillation, Table 21). Figures, no handles.",
  topics: ['grpo', 'rlvr', 'ppo', 'async rl', 'agentic rl', 'distillation', 'on-policy distillation', 'model merging', 'task vectors', 'fine-tuning'],
  params: {
    which: { type: 'enum', values: WHICH, default: 'grpo_loop', doc: 'which diagram' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, ...WHICH.slice(1).flatMap((w) => [{ which: w }, { which: w, lang: 'zh' }])],
  ids: ['figure'],
  scene: (p) => build(p),
});

const seg2 = (a: number[], b: number[], col?: string) => {
  const c = palette();
  return polyline([a, b], col ?? c.muted, 2);
};
const polyline2 = (pts: number[][], col: string, w: number) => polyline(pts, col, w);

function build(p: EFigureParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  const L = (en: string, zh: string) => pick(lang, en, zh);
  class EFigure extends Scene {
    override construct() {
      const c = palette();
      const fig = VGroup();
      fig.name = 'figure';
      const show = (...ms: any[]) => {
        fig.add(...ms);
        this.play(LaggedStart(...ms.map((m) => FadeIn(m, { shift: [0, 0.12, 0] })), { lag_ratio: 0.25 }), { run_time: 0.6 + 0.25 * ms.length });
      };
      const W = p.which;
      if (W === 'grpo_loop') {
        const y = 2.45;
        const q = textbox(-5.9, y, 1.7, 1.2, [{ t: L('question', '题目'), size: 24, bold: true }, { t: 'q', size: 24 }]);
        const pol = textbox(-2.85, y, 3.2, 1.2, [{ t: '', parts: [{ t: L('policy', '策略') }, { m: '\\pi_\\theta' }], size: 24, bold: true }, { t: L('samples G answers', '采样 G 个回答'), size: 21 }], { stroke: c.accent });
        const ver = textbox(0.65, y, 2.9, 1.2, [{ t: L('verifier', '验证器'), size: 24, bold: true }, { t: '', parts: [{ m: 'r_i = 1' }, { t: L('or', '或') }, { m: '0' }], size: 21 }], { stroke: c.good });
        const adv = textbox(4.65, y, 3.9, 1.2, [{ t: L('group baseline', '组内基线'), size: 24, bold: true }, { t: '', parts: [{ m: '\\hat A_i = (r_i - \\bar r)/\\sigma' }], size: 21 }], { stroke: c.gold });
        const upd = textbox(4.65, 0.55, 3.9, 1.1, [{ t: '', parts: [{ t: L('update', '更新') }, { m: '\\pi_\\theta' }], size: 24, bold: true }, { t: L('clipped ratio; KL optional', '截断比率；KL 可选'), size: 21 }], { stroke: c.accent });
        const a1 = arrow([-5.0, y], [-4.5, y], c.muted, 4, 0.16), a2 = arrow([-1.2, y], [-0.85, y], c.muted, 4, 0.16), a3 = arrow([2.15, y], [2.65, y], c.muted, 4, 0.16);
        const a4 = arrow([4.65, y - 0.62], [4.65, 1.12], c.muted, 4, 0.16);
        const back = VGroup(dashed([2.68, 0.55], [-2.85, 0.55], c.accent, 3), arrow([-2.85, 0.55], [-2.85, y - 0.63], c.accent, 3, 0.16));
        const loop_lab = label(L('repeat with the next batch of questions', '换一批题目，重复'), 20, c.accent).move_to([-0.1, 0.25, 0]);
        show(q, a1, pol);
        show(a2, ver, a3, adv);
        show(a4, upd, back, loop_lab);
        // memory comparison
        const y2 = -1.45, y3 = -2.75;
        const lab2 = label_at(L('PPO keeps 4 models:', 'PPO 要放 4 个模型：'), -6.9, y2, 22, c.ink, 'BOLD');
        const lab3 = label_at(L('GRPO keeps:', 'GRPO 要放：'), -6.9, y3, 22, c.ink, 'BOLD');
        const xs = [-2.45, 0.1, 2.65, 5.2];
        const ppo = [L('policy', '策略'), L('reference', '参考模型'), L('reward model', '奖励模型'), L('value model', '价值模型')].map((t, i) => textbox(xs[i], y2, 2.3, 0.7, [{ t, size: 21 }], { stroke: i === 3 ? c.coral : c.muted }));
        const grpo = [
          textbox(xs[0], y3, 2.3, 0.7, [{ t: L('policy', '策略'), size: 21 }]),
          textbox(xs[1], y3, 2.4, 0.7, [{ t: L('reference if β > 0', '参考模型（β>0 时）'), size: 20 }], { stroke: c.faint }),
          textbox(xs[2], y3, 2.4, 0.7, [{ t: L('verifier: code', '验证器：一段程序'), size: 20 }], { stroke: c.good }),
          label(L('no value model', '没有价值模型'), 21, c.coral).move_to([xs[3], y3, 0]),
        ];
        show(lab2, ...ppo);
        show(lab3, ...grpo);
        show(label_at(L("The group's mean reward is the baseline that PPO's value model used to estimate.", '同一题一组回答的平均分，代替了 PPO 里价值模型要估计的基线。'), -6.9, -3.6, 21, c.muted));
      } else if (W === 'rollout_timeline') {
        const T0 = -5.2, T1 = 1.6, U = (T1 - T0) / 10;
        const lane = (y: number, t: string) => label_at(t, -6.95, y, 20, c.ink);
        const block = (t0: number, t1: number, y: number, col: string, txt = '') => {
          const g = VGroup(rect(T0 + t0 * U + 0.02, y - 0.22, T0 + t1 * U - 0.02, y + 0.22, col, 0.75));
          if (txt) g.add(label(txt, 18, c.bg).move_to([T0 + ((t0 + t1) / 2) * U, y, 0]));
          return g;
        };
        const G = L('generate', '生成'), Tn = L('train', '训练');
        const h1 = label_at(L('synchronous', '同步'), -6.95, 3.35, 24, c.ink, 'BOLD');
        const s1 = VGroup(lane(2.75, L('rollout GPU', '生成卡')), lane(2.15, L('train GPU', '训练卡')),
          block(0, 3, 2.75, c.accent, G), block(5, 8, 2.75, c.accent, G), block(3, 5, 2.15, c.purple, Tn), block(8, 10, 2.15, c.purple, Tn));
        const idle = label_at(L('each side waits for the other', '两边轮流空等'), T0, 1.62, 20, c.muted);
        const h2 = label_at(L('asynchronous', '异步'), -6.95, 0.95, 24, c.ink, 'BOLD');
        const s2 = VGroup(lane(0.35, L('rollout GPU', '生成卡')), lane(-0.25, L('train GPU', '训练卡')),
          ...[0, 1, 2, 3].map((k) => block(k * 2.5, k * 2.5 + 2.5, 0.35, c.accent, G)),
          ...[0, 1, 2].map((k) => block(2.5 + k * 2.5, 4.5 + k * 2.5, -0.25, c.purple, Tn)));
        const late = VGroup(arrow([T0 + 4.5 * U, -0.47], [T0 + 7.5 * U, 0.12], c.coral, 3, 0.14), label_at(L('new weights arrive late', '新权重晚到'), T0 + 5.3 * U, -0.75, 18, c.coral));
        const note = VGroup(
          label_at(L('samples come from weights k steps old:', '采样用的是落后 k 步的权重：'), T0, -1.35, 21, c.ink),
          label_at(L('off-policy, so correct with the clipped ratio (E1)', '样本是离线（异策略）的，要靠截断比率来校正（E1）'), T0, -1.8, 21, c.ink),
        );
        show(h1, s1);
        show(idle);
        show(h2, s2);
        show(late, note);
        const box = textbox(4.6, -0.2, 4.4, 4.2, [
          { t: L('even with the same weights', '就算权重相同'), size: 22, bold: true },
          { t: '', parts: [{ t: L('rollout engine:', '推理引擎算出') }, { m: '\\pi_{rollout}(o_t)' }], size: 20 },
          { t: '', parts: [{ t: L('trainer:', '训练框架算出') }, { m: '\\pi_{train}(o_t)' }], size: 20 },
          { t: L('different kernels, different numbers', '算子和精度不同，数也不同'), size: 20, color: c.coral },
          { t: L('fix: weight each token by', '办法：每个 token 乘上'), size: 20 },
          { t: '', parts: [{ m: 'w = \\min(\\pi_{train}/\\pi_{rollout},\\,C)' }], size: 19, color: c.accent },
          { t: L('or FP16, FP32 LM head', '或改用 FP16、FP32 的 LM head'), size: 20 },
        ], { stroke: c.coral, gap: 0.16 });
        show(box);
        show(label_at(L('sources: ScaleRL (2510.13786), verl docs, FP16 (2510.26788)', '出处：ScaleRL（2510.13786）、verl 文档、FP16（2510.26788）'), -6.95, -3.6, 18, c.muted));
      } else if (W === 'agentic') {
        const segs: [string, 'model' | 'env' | 'task'][] = [
          [L('task: fix the failing test', '任务：修好这个失败的测试'), 'task'],
          [L('model: think, call run_tests()', '模型：思考，调用 run_tests()'), 'model'],
          [L('env: 3 failed, traceback…', '环境：3 个失败，报错信息…'), 'env'],
          [L('model: edit file, call run_tests()', '模型：改文件，再调用 run_tests()'), 'model'],
          [L('env: all passed', '环境：全部通过'), 'env'],
          [L('model: final answer', '模型：给出结论'), 'model'],
        ];
        const col = (k: string) => (k === 'model' ? c.accent : k === 'env' ? c.muted : c.ink);
        // a transcript: environment turns on the left, model turns on the right
        const boxes = segs.map(([t, k], i) => {
          const x = k === 'model' ? 0.3 : -3.3, y = 3.1 - i * 0.92;
          return textbox(x, y, 5.2, 0.72, [{ t, size: 21, color: k === 'env' ? c.muted : c.ink }], { stroke: col(k), fill: k === 'model' ? c.accent : k === 'env' ? c.faint : c.bg, fill_opacity: k === 'model' ? 0.1 : k === 'env' ? 0.6 : 1, width: 2.5 });
        });
        const reward = textbox(4.75, -1.5, 4.0, 1.1, [{ t: L('environment checks:', '环境判定：'), size: 21, bold: true }, { t: L('tests pass → r = 1', '测试通过 → r = 1'), size: 21, color: c.good }], { stroke: c.good, width: 3 });
        show(boxes[0]);
        for (let i = 1; i < segs.length; i++) show(boxes[i]);
        show(arrow([2.95, boxes[5].get_center()[1]], [4.75, -0.92], c.good, 3, 0.16), reward);
        show(
          VGroup(rect(-6.9, -3.0, -6.6, -2.75, c.accent, 0.3), label_at(L('model tokens: trained', '模型生成的 token：计入损失'), -6.5, -2.88, 20, c.ink)),
          VGroup(rect(-6.9, -3.55, -6.6, -3.3, c.faint, 1), label_at(L('environment tokens: masked out of the loss', '环境返回的 token：从损失里掩掉'), -6.5, -3.43, 20, c.ink)),
        );
      } else if (W === 'mopd') {
        const base = textbox(-5.6, 0, 2.3, 1.0, [{ t: L('base model', '基座模型'), size: 22, bold: true }]);
        const tnames = [L('math expert', '数学专家'), L('code expert', '代码专家'), L('agent expert', '智能体专家')];
        const ty = [2.0, 0, -2.0];
        const teachers = tnames.map((t, i) => textbox(-1.9, ty[i], 2.8, 1.0, [{ t, size: 22, bold: true }, { t: L('RL on its domain', '在本领域做强化学习'), size: 18, color: c.muted }], { stroke: c.purple }));
        const ta = ty.map((y) => arrow([-4.42, 0], [-3.35, y], c.muted, 3, 0.14));
        const student = textbox(4.4, 0, 4.4, 2.6, [
          { t: L('one student', '一个学生模型'), size: 24, bold: true },
          { t: L('writes its own answer', '对混合领域的题目'), size: 20 },
          { t: L('to prompts from all domains;', '自己写回答；'), size: 20 },
          { t: L("each token is scored by that", '每个 token 由该题所属领域的'), size: 20 },
          { t: L("domain's teacher (reverse KL)", '老师打分（反向 KL）'), size: 20, color: c.accent },
        ], { stroke: c.accent, width: 3, gap: 0.14 });
        const sa = ty.map((y) => arrow([-0.45, y], [2.15, y * 0.35], c.accent, 3, 0.14));
        show(base);
        show(...ta, ...teachers);
        show(...sa, student);
        show(
          label_at(L('used by DeepSeek V4, Nemotron 3 Ultra (>10 teachers), MiMo Flash v2 — as reported by Interconnects', '使用者：DeepSeek V4、Nemotron 3 Ultra（10 个以上老师）、MiMo Flash v2（据 Interconnects 访谈整理）'), -6.9, -3.25, 18, c.muted),
          label_at(L('replaces merging specialists by weight averaging', '取代了"把专家的权重平均起来"的合并做法'), -6.9, -3.65, 18, c.muted),
        );
      } else if (W === 'zero_var') {
        const B = { x0: -5.6, x1: 1.6, y0: -2.6, y1: 2.4 };
        const X = (v: number) => B.x0 + v * (B.x1 - B.x0), Y = (v: number) => B.y0 + v * (B.y1 - B.y0);
        const axes = VGroup(seg2([B.x0, B.y0], [B.x1 + 0.1, B.y0]), seg2([B.x0, B.y0], [B.x0, B.y1 + 0.1]),
          ...[0, 0.5, 1].map((v) => tex(`${v}`, 24, c.muted).move_to([X(v), B.y0 - 0.3, 0])),
          ...[0.5, 1].map((v) => tex(`${v}`, 24, c.muted).move_to([B.x0 - 0.3, Y(v), 0])),
          label(L("p: this question's success rate", 'p：这道题的正确率'), 22, c.muted).move_to([(B.x0 + B.x1) / 2, B.y0 - 0.72, 0]),
          mixed([{ t: L('chance the group is all right or all wrong', '一组全对或全错的概率') }], 22, c.ink).move_to([B.x0 + 2.55, B.y1 + 0.42, 0]));
        const cols = [c.muted, c.accent, c.purple];
        const curves = [4, 8, 16].map((G, j) => {
          const pts = Array.from({ length: 101 }, (_, i) => { const q = i / 100; return [X(q), Y(q ** G + (1 - q) ** G)]; });
          return VGroup(polyline2(pts, cols[j], j === 1 ? 5 : 3.5), tex(`G = ${G}`, 26, cols[j]).move_to([X(0.12) + 0.75, Y(0.88 ** G + 0.12 ** G) + 0.05, 0]));
        });
        const mark = VGroup(Dot([X(0.9), Y(0.9 ** 8 + 0.1 ** 8), 0], { radius: 0.1, color: c.gold }),
          tex('p = 0.9,\\ G = 8:\\ 0.43', 28, c.gold).move_to([X(0.9) - 1.95, Y(0.43) + 0.55, 0]));
        const formula = tex('P_0(p) = p^G + (1-p)^G', 38).move_to([4.5, 1.6, 0]);
        const note = VGroup(
          label_at(L('very easy (p near 1) and', '太容易（p 接近 1）'), 2.3, 0.6, 21, c.ink),
          label_at(L('very hard (p near 0) questions', '和太难（p 接近 0）的题，'), 2.3, 0.18, 21, c.ink),
          label_at(L('mostly give no signal', '大多拿不到学习信号'), 2.3, -0.24, 21, c.ink),
          label_at(L('a bigger G helps, but costs', '加大 G 有用，'), 2.3, -0.9, 21, c.muted),
          label_at(L('G samples per question', '但每道题要采 G 个回答'), 2.3, -1.32, 21, c.muted),
        );
        show(axes);
        show(...curves);
        show(mark, formula);
        show(note);
      } else if (W === 'r1_zero_curves') {
        // approximate readings of DeepSeek-R1 (v1) Fig. 2 (pass@1) and Fig. 3 (mean length)
        const acc = [[0, 0.156], [400, 0.22], [800, 0.29], [1200, 0.37], [1600, 0.38], [2000, 0.38], [2400, 0.49], [2800, 0.53], [3200, 0.51], [3600, 0.58], [4000, 0.6], [4400, 0.56], [4800, 0.57], [5200, 0.63], [5600, 0.59], [6000, 0.64], [6400, 0.69], [6800, 0.66], [7200, 0.68], [7600, 0.67], [8000, 0.69], [8400, 0.71]];
        const len = [[0, 500], [1000, 1400], [2000, 2200], [3000, 3000], [4000, 4100], [5000, 5000], [6000, 6000], [7000, 7300], [8000, 9000], [8400, 9500]];
        const panel = (x0: number, title: string, data: number[][], ymax: number, yt: number[], fmt: (v: number) => string, col: string) => {
          const B = { x0, x1: x0 + 5.2, y0: -2.3, y1: 2.0 };
          const X = (v: number) => B.x0 + (v / 8400) * (B.x1 - B.x0), Y = (v: number) => B.y0 + (v / ymax) * (B.y1 - B.y0);
          return VGroup(
            seg2([B.x0, B.y0], [B.x1, B.y0]), seg2([B.x0, B.y0], [B.x0, B.y1]),
            ...[0, 4000, 8000].map((v) => tex(`${v}`, 22, c.muted).move_to([X(v), B.y0 - 0.3, 0])),
            ...yt.map((v) => tex(fmt(v), 22, c.muted).move_to([B.x0 - 0.45, Y(v), 0])),
            label(L('RL steps', 'RL 步数'), 20, c.muted).move_to([(B.x0 + B.x1) / 2, B.y0 - 0.68, 0]),
            label(title, 22, c.ink).move_to([(B.x0 + B.x1) / 2, B.y1 + 0.45, 0]),
            polyline2(data.map(([s1, v]) => [X(s1), Y(v)]), col, 4.5),
            ...data.map(([s1, v]) => Dot([X(s1), Y(v), 0], { radius: 0.05, color: col })),
          );
        };
        const left = panel(-6.0, L('AIME 2024 pass@1', 'AIME 2024 pass@1'), acc, 0.8, [0.2, 0.4, 0.6, 0.8], (v) => v.toFixed(1), c.accent);
        const right = panel(1.3, L('average answer length (tokens)', '平均回答长度（token）'), len, 10000, [2000, 6000, 10000], (v) => `${v}`, c.purple);
        show(left);
        show(right);
        show(label_at(L('redrawn from DeepSeek-R1 v1 (2501.12948), Fig. 2 and 3; approximate readings', '按 DeepSeek-R1 v1（2501.12948）图 2、图 3 重绘；读数是近似值'), -6.9, -3.55, 18, c.muted));
      } else if (W === 'qwen3_distill_rl') {
        const B = { x0: -5.8, x1: 0.8, y0: -2.4, y1: 2.2 };
        const Y = (v: number) => B.y0 + (v / 100) * (B.y1 - B.y0);
        const groups: [string, number[]][] = [['pass@1', [55.0, 67.6, 74.4]], ['pass@64', [90.0, 90.0, 93.3]]];
        const cols = [c.muted, c.coral, c.accent];
        const bars = groups.flatMap(([g, vs], gi) => vs.map((v, i) => {
          const x = B.x0 + 0.6 + gi * 3.3 + i * 0.85;
          return VGroup(rect(x - 0.33, B.y0, x + 0.33, Y(v), cols[i], 0.85), tex(v.toFixed(1), 22, cols[i]).move_to([x, Y(v) + 0.25, 0]));
        }));
        const glab = groups.map(([g], gi) => tex(`\\text{${g}}`, 26, c.ink).move_to([B.x0 + 0.6 + gi * 3.3 + 0.85, B.y0 - 0.32, 0]));
        const axis = VGroup(seg2([B.x0, B.y0], [B.x1, B.y0]), ...[50, 100].map((v) => VGroup(seg2([B.x0, Y(v)], [B.x1, Y(v)], c.faint), tex(`${v}`, 22, c.muted).move_to([B.x0 - 0.3, Y(v), 0]))));
        const legend = VGroup(...[L('start: off-policy distilled', '起点：离线蒸馏后的检查点'), L('+ RL', '+ 强化学习'), L('+ on-policy distillation', '+ 在线蒸馏')].map((t, i) => VGroup(rect(1.8, 1.75 - i * 0.55, 2.08, 2.03 - i * 0.55, cols[i], 0.85), label_at(t, 2.2, 1.89 - i * 0.55, 21, c.ink))));
        const hours = VGroup(
          label_at(L('GPU hours', 'GPU 小时'), 1.8, -0.2, 22, c.ink, 'BOLD'),
          label_at(L('RL: 17,920', '强化学习：17,920'), 1.8, -0.7, 22, c.coral),
          label_at(L('on-policy distillation: 1,800', '在线蒸馏：1,800'), 1.8, -1.15, 22, c.accent),
        );
        show(axis, ...glab, label_at(L('Qwen3-8B, AIME 2024', 'Qwen3-8B，AIME 2024'), B.x0, 2.85, 22, c.ink, 'BOLD'));
        show(...bars);
        show(legend, hours);
        show(label_at(L('RL did not raise pass@64; distillation did. Source: Qwen3 Technical Report (2505.09388), Table 21', '强化学习没有提高 pass@64，蒸馏提高了。出处：Qwen3 技术报告（2505.09388）表 21'), -6.9, -3.55, 18, c.muted));
      } else {
        // task vectors: same τ_B, two directions relative to task A's valley
        const panel = (cx: number, steep: boolean) => {
          const S = 1.25;
          const P = (x: number, y: number) => [cx + x * S, -0.9 + y * S, 0];
          const thA = [1.7, 0.7], tB = steep ? [-0.3, 1.45] : [1.45, 0.0];
          // task A's loss: an elongated valley around θ_A, flat along the x direction
          const ells = [0.55, 1.05, 1.55].map((k) => {
            const e = Ellipse({ width: 2 * 1.35 * k * S, height: 2 * 0.3 * k * S, color: c.coral, stroke_width: 2, stroke_opacity: 0.6 } as any) as any;
            e.move_to(P(thA[0], thA[1]));
            return e;
          });
          const o = Dot(P(0, 0) as any, { radius: 0.08, color: c.ink });
          const ol = tex('\\theta_0', 32).move_to([P(0, 0)[0] - 0.1, P(0, 0)[1] - 0.38, 0]);
          const aA = arrow(P(0, 0), P(thA[0], thA[1]), c.coral, 5, 0.2);
          const lA = tex('\\tau_A', 32, c.coral).move_to([P(thA[0] / 2, thA[1] / 2)[0] + 0.2, P(thA[0] / 2, thA[1] / 2)[1] - 0.35, 0]);
          const m = [thA[0] + tB[0], thA[1] + tB[1]];
          const aB = arrow(P(thA[0], thA[1]), P(m[0], m[1]), c.accent, 5, 0.2);
          const mid = P(thA[0] + tB[0] / 2, thA[1] + tB[1] / 2);
          const lB = tex('\\tau_B', 32, c.accent).move_to(steep ? [mid[0] - 0.42, mid[1], 0] : [mid[0], mid[1] - 0.36, 0]);
          const md = Dot(P(m[0], m[1]) as any, { radius: 0.1, color: c.gold });
          const ml = tex('\\theta_0+\\tau_A+\\tau_B', 28, c.gold).move_to(steep ? [P(m[0], m[1])[0] + 0.2, P(m[0], m[1])[1] + 0.4, 0] : [P(m[0], m[1])[0] - 0.3, P(m[0], m[1])[1] + 0.68, 0]);
          const cap = label(steep ? L("along A's steep direction: A's loss rises", '沿 A 的陡峭方向：A 的损失变大') : L("along A's flat direction: A barely changes", '沿 A 的平坦方向：A 几乎不受影响'), 21, steep ? c.coral : c.good).move_to([cx + 2.6, -2.95, 0]);
          return [VGroup(...ells), o, ol, aA, lA, aB, lB, md, ml, cap];
        };
        const head = mixed([{ t: L("red ellipses: task A's loss; its valley is at", '红色椭圆：任务 A 的损失等高线，谷底在') }, { m: '\\theta_A = \\theta_0 + \\tau_A' }], 21);
        head.move_to([-6.9 + head.width / 2, 3.4, 0]);
        const left = panel(-6.3, false), right = panel(0.9, true);
        show(head);
        show(...left.slice(0, 5));
        show(...left.slice(5));
        show(...right.slice(0, 5));
        show(...right.slice(5));
        show(label_at(L('toy 2-D picture; real models have billions of coordinates', '二维示意；真实模型有数十亿个坐标'), -6.9, -3.6, 18, c.muted));
      }
      this.add(fig);
      this.wait(['zero_var', 'r1_zero_curves', 'qwen3_distill_rl'].includes(W) ? 5.5 : 2.5);
      void Create;
      void GrowArrow;
      void rrect;
    }
  }
  return new EFigure();
}
