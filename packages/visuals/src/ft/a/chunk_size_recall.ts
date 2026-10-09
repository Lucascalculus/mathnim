// Chunk size under a fixed context budget, on real retrieval runs.
// The corpus (16 Wikipedia articles about planets and similar bodies) is cut
// into chunks of a given size; multilingual-e5-small ranks every chunk for 12
// questions (apps/mathnim/tools/ft-data/chunk_recall.py). The prompt can hold
// k = ⌊budget / chunk size⌋ chunks. A question is answered when a chunk that
// contains its whole answer sentence is among those k.
// Small chunks cut answer sentences apart; big chunks leave room for few of
// them and rank worse; overlap re-joins cut sentences.
// The strip shows the selected question's article: its chunks (the ones in the
// prompt are blue), and the answer sentence (gold).
// Explore: chunk size, budget, overlap (discrete), and which question to inspect.
import { FadeIn, MathTex, Rectangle, Scene, VGroup, ValueTracker } from 'manim-web';
import { constrain } from 'manim-web/ext/interact';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, label, LANG_SPEC, live, pick, resolve_lang, seg, type Lang } from '../f/kit';
import { CHUNK_DATA } from './data/chunk_recall';

export const SIZES = [64, 128, 256, 512, 1024];
export const BUDGETS = [512, 1024, 2048, 4096];
export const OVERLAPS = [0, 10, 20];
export type Status = 'hit' | 'rank' | 'split' | 'nofit';

/** Rank of the best chunk holding the whole answer sentence (0 = the sentence is always cut). */
export function best_rank(lang: Lang, size: number, overlap: number, q: number): number {
  return CHUNK_DATA[lang].configs[`${size}/${overlap}`].q[q].best;
}
export function status(lang: Lang, size: number, budget: number, overlap: number, q: number): Status {
  const k = Math.floor(budget / size);
  if (k === 0) return 'nofit';
  const b = best_rank(lang, size, overlap, q);
  return b === 0 ? 'split' : b <= k ? 'hit' : 'rank';
}
export function hits(lang: Lang, size: number, budget: number, overlap: number): number {
  let n = 0;
  for (let q = 0; q < 12; q++) if (status(lang, size, budget, overlap, q) === 'hit') n++;
  return n;
}
/** The chunk sizes with the most answered questions (ties: all of them). */
export function best_sizes(lang: Lang, budget: number, overlap: number): number[] {
  const h = SIZES.map((s) => hits(lang, s, budget, overlap));
  const m = Math.max(...h);
  return SIZES.filter((_, i) => h[i] === m);
}

export interface ChunkSizeParams extends Record<string, unknown> {
  size: string;
  budget: string;
  overlap: string;
  question: number;
  show_budget: boolean;
  lang: string;
}

const STRIP = { x0: -6.7, x1: 6.7, y: 2.95 };
const CELL = { x0: -6.6, w: 1.0, gap: 0.1, y: 1.5 };
const cell_x = (q: number) => CELL.x0 + CELL.w / 2 + q * (CELL.w + CELL.gap);
const SX = -3.4; // sliders' centre
const CHART = { x0: 1.3, x1: 6.6, y0: -3.0, y1: -1.35 };

export const chunk_size_recall = define_visual<ChunkSizeParams>({
  name: 'chunk_size_recall',
  summary: 'RAG chunk size under a fixed context budget, on real retrieval runs (multilingual-e5-small, 16 Wikipedia articles, 12 questions): k = budget / chunk size chunks fit; small chunks cut answer sentences apart, large ones rank worse and leave room for few; overlap re-joins cut sentences. Strip = one article with its chunks and the answer sentence; cells = every question. Student moves chunk size, budget, overlap and the inspected question.',
  topics: ['rag', 'chunking', 'retrieval', 'embeddings', 'context budget', 'fine-tuning'],
  params: {
    size: { type: 'enum', values: SIZES.map(String), default: '512', doc: 'chunk size in tokens at the start' },
    budget: { type: 'enum', values: BUDGETS.map(String), default: '512', doc: 'context budget for retrieved chunks, in tokens' },
    overlap: { type: 'enum', values: OVERLAPS.map(String), default: '0', doc: 'overlap between neighbouring chunks, percent' },
    question: { type: 'integer', min: 0, max: 11, default: 2, doc: 'question to inspect (0-11)' },
    show_budget: { type: 'boolean', default: true, doc: 'show the budget slider (off: the budget is fixed)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { size: '64', question: 1, lang: 'zh', show_budget: false }, { size: '128', budget: '2048', overlap: '20', question: 8 }, { size: '1024', budget: '512', lang: 'zh' }],
  ids: ['strip', 'cells', 'legend', 'controls', 'formula', 'chart'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const D = CHUNK_DATA[lang];
    class ChunkSize extends Scene {
      si = ValueTracker(SIZES.indexOf(+p.size));
      bi = ValueTracker(BUDGETS.indexOf(+p.budget));
      oi = ValueTracker(OVERLAPS.indexOf(+p.overlap));
      qi = ValueTracker(p.question);
      /** Visited chunk sizes, one 5-bit mask per (budget, overlap). */
      seen = BUDGETS.map(() => OVERLAPS.map(() => ValueTracker(0)));
      /** The size index the learner locked in, or -1. */
      locked = ValueTracker(-1);
      ss!: any;
      sb!: any;
      so!: any;
      lang = lang;
      show_budget = p.show_budget;
      size = () => SIZES[Math.round(this.si.get_value())];
      budget = () => BUDGETS[Math.round(this.bi.get_value())];
      overlap = () => OVERLAPS[Math.round(this.oi.get_value())];
      q = () => Math.round(this.qi.get_value());
      k = () => Math.floor(this.budget() / this.size());
      status = (q: number) => status(lang, this.size(), this.budget(), this.overlap(), q);
      hits = () => hits(lang, this.size(), this.budget(), this.overlap());
      best = () => best_sizes(lang, this.budget(), this.overlap());
      lock = () => {
        this.locked.set_value(Math.round(this.si.get_value()));
        return this.size();
      };
      mark_seen = () => {
        const t = this.seen[Math.round(this.bi.get_value())][Math.round(this.oi.get_value())];
        const bit = 1 << Math.round(this.si.get_value());
        if (!(t.get_value() & bit)) t.set_value(t.get_value() | bit);
      };
      override construct() {
        const c = palette();
        this.track(this.si, this.bi, this.oi, this.qi, this.locked, ...this.seen.flat());
        this.mark_seen();
        this.add_updater(() => this.mark_seen());
        const S_COL: Record<Status, string> = { hit: c.good, rank: c.gold, split: c.coral, nofit: c.muted };
        const key = () => `${this.size()}|${this.budget()}|${this.overlap()}|${this.q()}`;

        // ---- the strip: one article, its chunks, the answer sentence
        const head = live(() => `${this.q()}`, () => {
          const q = this.q(), g = D.gold[q];
          return fit(label(`${L('Q', '问题 ')}${q + 1}${L(': ', '：')}${D.questions[q]}   (${D.docs[g.doc]})`, 24, c.ink), 13.4).move_to([0, 3.62, 0]);
        });
        const strip = live(key, () => {
          const q = this.q(), cfg = D.configs[`${this.size()}/${this.overlap()}`].q[q], g = D.gold[q], k = this.k();
          const X = (t: number) => STRIP.x0 + t * (STRIP.x1 - STRIP.x0);
          const ms: any[] = [Rectangle({ width: STRIP.x1 - STRIP.x0, height: 0.44, stroke_width: 0, fill_color: c.faint, fill_opacity: 0.6 }).move_to([0, STRIP.y, 0])];
          (cfg.strip as number[][]).forEach(([a, b, rank], j) => {
            const inside = rank <= k;
            const r = Rectangle({ width: Math.max(0.02, X(b) - X(a) - 0.02), height: 0.18, stroke_color: c.muted, stroke_width: 1.5, fill_color: inside ? c.accent : c.bg, fill_opacity: inside ? 0.75 : 1 });
            ms.push(r.move_to([(X(a) + X(b)) / 2, STRIP.y + (j % 2 ? -0.1 : 0.1), 0]));
          });
          ms.push(Rectangle({ width: Math.max(0.06, X(g.to) - X(g.from)), height: 0.1, stroke_width: 0, fill_color: c.gold, fill_opacity: 1 }).move_to([(X(g.from) + X(g.to)) / 2, STRIP.y - 0.33, 0]));
          const tag = label(L('answer sentence', '答案句'), 22, c.gold);
          tag.move_to([Math.min(STRIP.x1 - tag.width / 2, Math.max(STRIP.x0 + tag.width / 2, (X(g.from) + X(g.to)) / 2)), STRIP.y - 0.6, 0]);
          ms.push(tag);
          return VGroup(...ms);
        });
        strip.name = 'strip';

        // ---- one cell per question: answered (rank shown), ranked too low, cut apart, does not fit
        const cells = live(key, () => VGroup(...Array.from({ length: 12 }, (_, q) => {
          const st = this.status(q), b = best_rank(lang, this.size(), this.overlap(), q);
          const txt = st === 'split' ? '\\times' : st === 'nofit' ? '-' : st === 'hit' ? `${b}` : `\\#${b}`;
          const sel = q === this.q();
          return VGroup(
            box(cell_x(q), CELL.y, CELL.w, 0.56, { stroke: sel ? c.ink : S_COL[st], width: sel ? 4 : 2, fill: S_COL[st], fill_opacity: 0.22, radius: 0.08 }),
            MathTex(txt, { font_size: 30, color: c.ink }).move_to([cell_x(q), CELL.y, 0]),
            label(`${q + 1}`, 22, c.muted).move_to([cell_x(q), CELL.y + 0.48, 0]),
          );
        })));
        cells.name = 'cells';
        const selector = live(() => `${this.q()}`, () => VGroup(
          seg([cell_x(0), CELL.y - 0.42], [cell_x(11), CELL.y - 0.42], c.faint, 3),
          Rectangle({ width: 0.3, height: 0.16, stroke_width: 0, fill_color: c.ink, fill_opacity: 1 }).move_to([cell_x(this.q()), CELL.y - 0.42, 0]),
        ));
        const chip = (color: string, text: string) => VGroup(Rectangle({ width: 0.32, height: 0.24, stroke_width: 0, fill_color: color, fill_opacity: 0.5 }), label(text, 22, c.ink)).arrange([1, 0, 0], { buff: 0.12 });
        const legend = VGroup(
          chip(c.good, L('in the prompt (its rank)', '进了提示（显示排名）')),
          chip(c.gold, L('ranked below k', '排名在 k 之后')),
          chip(c.coral, L('answer sentence cut apart', '答案句被切断')),
          chip(c.muted, L("chunk doesn't fit", '一块都放不下')),
        ).arrange([1, 0, 0], { buff: 0.45 });
        fit(legend as any, 13.4);
        legend.move_to([0, 0.62, 0]);
        legend.name = 'legend';

        // ---- controls: three discrete sliders and the question selector
        const look = { length: 4.2, color: c.accent, track_color: c.faint, stroke_width: 8, knob_radius: 0.15, label: null, show_value: false };
        this.ss = new Slider(this.si, { ...look, x_range: [0, 4] }).move_to([SX, -0.55, 0]);
        this.sb = new Slider(this.bi, { ...look, x_range: [0, 3] }).move_to([SX, -1.75, 0]);
        this.so = new Slider(this.oi, { ...look, x_range: [0, 2] }).move_to([SX, -2.95, 0]);
        const ticks = (s: any, values: string[]) => VGroup(...values.map((v, i) => label(v, 22, c.muted).move_to([s.point_of(i)[0], s.point_of(i)[1] - 0.32, 0])));
        const cap = (y: number, en: string, zh: string) => label(L(en, zh), 24, c.ink).move_to([0, y + 0.4, 0]).align_to([SX - 2.1, 0, 0], [-1, 0, 0]);
        const controls = VGroup(
          this.ss, ticks(this.ss, SIZES.map(String)), cap(-0.55, 'chunk size (tokens)', '块大小（token）'),
          ...(p.show_budget ? [this.sb, ticks(this.sb, BUDGETS.map(String)), cap(-1.75, 'context budget B (tokens)', '上下文预算 B（token）')] : [label(L(`context budget B = ${p.budget} tokens (fixed)`, `上下文预算 B = ${p.budget} token（固定）`), 24, c.ink).move_to([0, -1.5, 0]).align_to([SX - 2.1, 0, 0], [-1, 0, 0])]),
          this.so, ticks(this.so, OVERLAPS.map((o) => `${o}%`)), cap(-2.95, 'overlap', '块重叠'),
        );
        controls.name = 'controls';

        // ---- k and the score, then answered questions per chunk size (only the sizes tried so far)
        const formula = live(key, () => MathTex(`k = \\left\\lfloor \\frac{B}{\\text{size}} \\right\\rfloor = \\left\\lfloor \\frac{${this.budget()}}{${this.size()}} \\right\\rfloor = ${this.k()}`, { font_size: 30, color: c.ink }).move_to([0, -0.05, 0]).align_to([CHART.x0 - 0.3, 0, 0], [-1, 0, 0]));
        formula.name = 'formula';
        const score = live(key, () => VGroup(label(L('answered', '答到'), 26, c.ink), MathTex(`${this.hits()}\\,/\\,12`, { font_size: 38, color: c.good })).arrange([1, 0, 0], { buff: 0.15 }).move_to([0, -0.7, 0]).align_to([CHART.x0 - 0.3, 0, 0], [-1, 0, 0]));
        const chart = live(() => `${key()}|${this.seen.flat().map((t) => t.get_value()).join(',')}|${this.locked.get_value()}`, () => {
          const mask = this.seen[Math.round(this.bi.get_value())][Math.round(this.oi.get_value())].get_value();
          const bw = (CHART.x1 - CHART.x0) / SIZES.length;
          const ms: any[] = [seg([CHART.x0, CHART.y0], [CHART.x1, CHART.y0], c.muted, 2)];
          SIZES.forEach((s, i) => {
            const x = CHART.x0 + bw * (i + 0.5), seen = !!(mask & (1 << i)), h = hits(lang, s, this.budget(), this.overlap());
            const cur = i === Math.round(this.si.get_value());
            const hh = Math.max(0.02, ((CHART.y1 - CHART.y0) * h) / 12);
            const bar = Rectangle({ width: bw * 0.6, height: seen ? hh : CHART.y1 - CHART.y0, stroke_color: cur ? c.ink : c.muted, stroke_width: cur ? 3 : 1.5, fill_color: c.good, fill_opacity: seen ? 0.6 : 0 });
            bar.move_to([x, CHART.y0 + (seen ? hh : CHART.y1 - CHART.y0) / 2, 0]);
            if (!seen) bar.set_stroke({ opacity: 0.35 });
            ms.push(bar, label(seen ? `${h}` : '?', 22, seen ? c.ink : c.muted).move_to([x, (seen ? CHART.y0 + hh : CHART.y1) + 0.22, 0]), label(`${s}`, 22, c.muted).move_to([x, CHART.y0 - 0.26, 0]));
          });
          const lk = Math.round(this.locked.get_value());
          const pin = label(L('your pick', '你的选择'), 22, c.accent).move_to([CHART.x0 + bw * (Math.max(0, lk) + 0.5), CHART.y0 - 0.6, 0]);
          if (lk < 0) pin.set_opacity(0);
          ms.push(pin);
          return VGroup(...ms);
        });
        chart.name = 'chart';
        const honest = fit(label(L(
          'real runs: multilingual-e5-small over 16 Wikipedia articles (CC BY-SA 4.0), computed offline; "answered" = the whole answer sentence is in a chunk that fits',
          '真实数据：multilingual-e5-small 检索 16 篇维基百科天体条目（CC BY-SA 4.0），离线算好；"答到" = 完整的答案句落在放得进提示的块里',
        ), 22, c.muted), 13.6).move_to([0, -3.72, 0]);

        // ---- the story: what each part of the screen is
        this.play(FadeIn(head), FadeIn(strip), { run_time: 1.4 });
        this.wait(0.8);
        this.play(FadeIn(cells), FadeIn(selector), { run_time: 1.2 });
        this.play(FadeIn(legend), { run_time: 1 });
        this.play(FadeIn(controls), FadeIn(formula), FadeIn(score), { run_time: 1.2 });
        this.play(FadeIn(chart), FadeIn(honest), { run_time: 1.2 });
        this.wait(2.5);
      }
    }
    return new ChunkSize();
  },
  explore: (scene: any, ui) => {
    scene.ss.attach(ui, { snap: 1, step: 1, label: 'chunk size' });
    if (scene.show_budget) scene.sb.attach(ui, { snap: 1, step: 1, label: 'context budget' });
    scene.so.attach(ui, { snap: 1, step: 1, label: 'overlap' });
    // the question to inspect: a knob under the cells (click a cell, or drag, or use the arrow keys)
    ui.add_handle({
      tracker: scene.qi,
      from_value: (q: number) => [cell_x(q), CELL.y - 0.42, 0],
      to_value: (pt: number[]) => Math.max(0, Math.min(11, Math.round((pt[0] - CELL.x0 - CELL.w / 2) / (CELL.w + CELL.gap)))),
      constraint: constrain.on_segment([cell_x(0), CELL.y - 0.42, 0], [cell_x(11), CELL.y - 0.42, 0]),
      step: 1,
      radius: 0.35,
      label: 'question to inspect',
    });
    ui.on_click?.((pt: number[]) => {
      if (Math.abs(pt[1] - CELL.y) > 0.45) return;
      const q = Math.round((pt[0] - CELL.x0 - CELL.w / 2) / (CELL.w + CELL.gap));
      if (q >= 0 && q < 12) {
        scene.qi.set_value(q);
        ui.notify?.();
      }
    });
  },
});
