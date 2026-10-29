// The DeepSeek-R1 recipe (E2), built up as a scene: first R1-Zero (pure RL
// with rule rewards on V3-Base, AIME 2024 pass@1 15.6% -> 71.0%, but hard to
// read and mixing languages), then R1's four stages, each with its data, its
// reward and the problem it solves. Numbers: DeepSeek-R1 v1 (arXiv
// 2501.12948, sections 2.2-2.3); see research-reasoning.md.
import { Create, FadeIn, GrowArrow, Indicate, LaggedStart, Scene, VGroup } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { arrow, dashed } from '../../linalg/kit';
import { LANG_SPEC, label, label_at, pick, resolve_lang, textbox, type Lang } from './kit';

export interface R1PipelineParams extends Record<string, unknown> {
  stage: string;
  highlight: string;
  lang: string;
}

const ROW = { y: -1.15, w: 3.2, h: 2.6, xs: [-5.3, -1.77, 1.77, 5.3] };
const ZERO_Y = 3.0;

export const r1_pipeline = define_visual<R1PipelineParams>({
  name: 'r1_pipeline',
  summary: "DeepSeek-R1's training recipe built up step by step: R1-Zero (pure RL with rule rewards: AIME pass@1 15.6% -> 71.0%, but unreadable, mixed languages), then R1's four stages - cold-start SFT, reasoning RL, rejection sampling + SFT (~800k samples, retrained from V3-Base), RL for all scenarios - each with its data, reward and the problem it fixes. A figure, no handles.",
  topics: ['deepseek-r1', 'reasoning', 'rlvr', 'grpo', 'cold start', 'rejection sampling', 'training recipe', 'fine-tuning'],
  params: {
    stage: { type: 'enum', values: ['zero', 'all'], default: 'all', doc: "'zero': only R1-Zero; 'all': R1-Zero, then R1's four stages" },
    highlight: { type: 'enum', values: ['none', '1', '2', '3', '4'], default: 'none', doc: 'stage of R1 to point at at the end' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { stage: 'zero', lang: 'zh' }, { highlight: '3', lang: 'zh' }, { highlight: '1' }],
  ids: ['zero_row', 'stages', 'arrows'],
  scene: (p) => build(p),
});

function build(p: R1PipelineParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  const L = (en: string, zh: string) => pick(lang, en, zh);
  class R1Pipeline extends Scene {
    override construct() {
      const c = palette();
      // ---- R1-Zero
      const zx = [-5.55, -1.3, 2.6];
      const base = textbox(zx[0], ZERO_Y, 2.7, 1.0, [{ t: 'DeepSeek-V3-Base', size: 24, bold: true }, { t: L('pretrained only', '只做过预训练'), size: 20, color: c.muted }]);
      const rl = textbox(zx[1], ZERO_Y, 4.1, 1.0, [{ t: L('RL (GRPO), rule rewards only', '强化学习（GRPO），只用规则奖励'), size: 23, bold: true }, { t: L('answer correct? <think> format?', '答案对不对？<think> 格式对不对？'), size: 20, color: c.muted }], { stroke: c.accent });
      const zero = textbox(zx[2], ZERO_Y, 2.2, 1.0, [{ t: 'R1-Zero', size: 28, bold: true }], { stroke: c.gold });
      const za = VGroup(arrow([zx[0] + 1.37, ZERO_Y], [zx[1] - 2.07, ZERO_Y], c.muted, 4, 0.18), arrow([zx[1] + 2.07, ZERO_Y], [zx[2] - 1.12, ZERO_Y], c.muted, 4, 0.18));
      const zres = VGroup(
        label_at(L('AIME 2024 pass@1: 15.6% → 71.0%', 'AIME 2024 pass@1：15.6% → 71.0%'), zx[2] - 1.1, ZERO_Y - 0.72, 20, c.good),
        label_at(L('but: hard to read, mixes languages', '但：难读，中英混杂'), zx[2] - 1.1, ZERO_Y - 1.08, 20, c.coral),
      );
      const zero_row = VGroup(base, rl, zero, za, zres);
      zero_row.name = 'zero_row';
      this.play(FadeIn(base), { run_time: 0.6 });
      if (p.stage === 'zero') this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
      this.play(GrowArrow(za.submobjects[0] as any), FadeIn(rl), { run_time: 0.8 });
      this.play(GrowArrow(za.submobjects[1] as any), FadeIn(zero), { run_time: 0.8 });
      if (p.stage === 'zero') this.next_section();
      this.play(FadeIn(zres.submobjects[0]), { run_time: 0.6 });
      if (p.stage === 'zero') this.next_section();
      this.play(FadeIn(zres.submobjects[1]), { run_time: 0.6 });
      this.wait(p.stage === 'zero' ? 1.5 : 0.8);
      if (p.stage === 'zero') {
        this.add(zero_row);
        const stages = VGroup();
        stages.name = 'stages';
        const arrows = VGroup();
        arrows.name = 'arrows';
        this.add(stages, arrows);
        this.wait(4);
        return;
      }
      // ---- R1: four stages
      const head = label_at(L('DeepSeek-R1: four stages', 'DeepSeek-R1：四个阶段'), -6.9, 1.05, 24, c.ink, 'BOLD');
      const S = [
        [L('1  Cold-start SFT', '1  冷启动 SFT'), L('thousands of readable', '几千条可读的'), L('long chains of thought', '长思维链'), L('fixes: readability,', '解决：可读性，'), L('a steadier start for RL', '让 RL 起步更稳')],
        [L('2  Reasoning RL', '2  推理能力的 RL'), L('GRPO; rewards: accuracy', 'GRPO；奖励：准确率'), L('+ format + language', '+ 格式 + 语言一致性'), L('fixes: reasoning,', '解决：推理能力，'), L('fewer mixed languages', '减少中英混杂')],
        [L('3  Rejection sampling', '3  拒绝采样 + SFT'), L('sample stage 2, keep correct', '从第 2 步采样，只留对的：'), L('~600k reasoning + ~200k other', '约 60 万推理 + 20 万通用'), L('SFT from V3-Base, 2 epochs', '从 V3-Base 重训 2 轮'), L('fixes: general skills too', '解决：通用能力也要有')],
        [L('4  RL, all scenarios', '4  全场景 RL'), L('rule rewards for reasoning,', '推理题用规则奖励，'), L('reward models for', '有用性、无害性'), L('helpful + harmless', '用奖励模型'), L('fixes: human preferences', '解决：对齐人的偏好')],
      ];
      const boxes = S.map((lines, i) => textbox(ROW.xs[i], ROW.y, ROW.w, ROW.h, [
        { t: lines[0], size: 25, bold: true },
        { t: lines[1], size: 21 }, { t: lines[2], size: 21 },
        { t: lines[3], size: 21, color: c.good }, { t: lines[4], size: 21, color: c.good },
      ], { stroke: i === 1 || i === 3 ? c.accent : c.purple, width: 2.5, gap: 0.17 }));
      const stages = VGroup(...boxes);
      stages.name = 'stages';
      const arrows = VGroup(...[0, 1, 2].map((i) => arrow([ROW.xs[i] + ROW.w / 2 + 0.02, ROW.y], [ROW.xs[i + 1] - ROW.w / 2 - 0.02, ROW.y], c.muted, 4, 0.16)));
      // stage 3 samples from stage 2's model and retrains from V3-Base
      const samp = VGroup(
        dashed([ROW.xs[1], ROW.y - ROW.h / 2 - 0.05], [ROW.xs[1], -3.05], c.purple, 3),
        dashed([ROW.xs[1], -3.05], [ROW.xs[2], -3.05], c.purple, 3),
        arrow([ROW.xs[2], -3.05], [ROW.xs[2], ROW.y - ROW.h / 2 - 0.05], c.purple, 3, 0.14),
        label(L('sample its answers', '用它的模型采样'), 18, c.purple).move_to([(ROW.xs[1] + ROW.xs[2]) / 2, -3.3, 0]),
      );
      arrows.add(samp);
      arrows.name = 'arrows';
      const legend = VGroup(
        label_at(L('blue: RL stages · purple: SFT stages', '蓝框：RL 阶段 · 紫框：SFT 阶段'), -6.9, -3.65, 18, c.muted),
        label_at(L('source: DeepSeek-R1 (2501.12948) §2.3', '出处：DeepSeek-R1（2501.12948）§2.3'), 1.6, -3.65, 18, c.muted),
      );
      this.play(FadeIn(head), { run_time: 0.5 });
      for (let i = 0; i < 4; i++) {
        this.next_section(); // (a stage per beat, §, of the narration)
        if (i > 0) this.play(GrowArrow(arrows.submobjects[i - 1] as any), { run_time: 0.4 });
        this.play(FadeIn(boxes[i], { shift: [0, 0.2, 0] }), { run_time: 0.8 });
        this.wait(i === 2 ? 0.4 : 1);
        if (i === 2) {
          this.play(LaggedStart(...samp.submobjects.map((m) => Create(m as any)), { lag_ratio: 0.3 }), { run_time: 1.2 });
          this.wait(1);
        }
      }
      this.play(FadeIn(legend), { run_time: 0.5 });
      this.add(zero_row, stages, arrows);
      if (p.highlight !== 'none') this.play(Indicate(boxes[+p.highlight - 1], { color: c.gold, scale_factor: 1.04 }), { run_time: 1 });
      this.wait(1.5);
    }
  }
  return new R1Pipeline();
}
