// "Who pays the loss": a real chat sample (Qwen2.5 template) scored by
// Qwen2.5-0.5B. Every token is a bar whose height is its loss -log p(token);
// the solid part is what it adds to the loss sum, w·ℓ, with w = 1 for trained
// tokens and w = λ (the prompt-loss weight) for masked ones. The sample's parts
// (template tokens, system, user, answer, the answer's closing <|im_end|>,
// tool call, tool result) are cards in two rows - "trained" and "masked" - and
// a stacked bar shows how much of the loss sum the answer carries:
//   share = Σ_{t∈A} w_t ℓ_t / Σ_t w_t ℓ_t,  A = the assistant's tokens.
// Explore: move a card up or down to the other row (each card is a handle);
// drag λ. Lessons read scene.mask / scene.lam and call attach_cards(ui, on_move).
import { DecimalNumber, FadeIn, GrowFromEdge, Indicate, LaggedStart, MathTex, Scene, VGroup, VMobject, ValueTracker, DOWN, RIGHT } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, label } from '../f/kit';
import { LANG_SPEC, clamp, pick, resolve_lang, slider, type Lang } from './kit';
import { TOKEN_SAMPLES, type TokenRow } from './token_data';
import { aside } from '../../aside';

export interface TokenLossMaskParams extends Record<string, unknown> {
  sample: string;
  start: string;
  prompt_weight: number;
  lang: string;
}

/** A part of the sample: consecutive tokens of one kind (template tokens are one part wherever they are). */
export interface Part {
  id: string;
  kind: 'T' | 'S' | 'U' | 'A' | 'E' | 'C' | 'R';
  /** Turn number for user / answer / end parts (1-based), 0 otherwise. */
  turn: number;
  tokens: number[];
  en: string;
  zh: string;
}

/** Split a sample into parts. A = answer text, E = the <|im_end|> closing an assistant turn, C = a tool call (an assistant turn that calls a tool). */
export function parts_of(rows: TokenRow[]): Part[] {
  const template: Part = { id: 'template', kind: 'T', turn: 0, tokens: [], en: 'template', zh: '模板 token' };
  const out: Part[] = [template];
  let turn_u = 0, turn_a = 0;
  let cur: Part | null = null;
  rows.forEach((r, i) => {
    if (r.r === 'T') {
      template.tokens.push(i);
      cur = null;
      return;
    }
    if (r.r === 'A' && r.s === '<|im_end|>') {
      out.push({ id: `end${turn_a}`, kind: 'E', turn: turn_a, tokens: [i], en: '<|im_end|>', zh: '<|im_end|>' });
      cur = null;
      return;
    }
    const kind: Part['kind'] = r.r === 'A' ? (cur && (cur.kind === 'A' || cur.kind === 'C') ? cur.kind : r.s.includes('<tool_call>') ? 'C' : 'A') : r.r;
    if (cur && cur.kind === kind) {
      cur.tokens.push(i);
      return;
    }
    if (kind === 'S') cur = { id: 'system', kind, turn: 0, tokens: [i], en: 'system', zh: '系统提示' };
    else if (kind === 'U') {
      turn_u++;
      cur = { id: `user${turn_u}`, kind, turn: turn_u, tokens: [i], en: 'user', zh: '用户' };
    } else if (kind === 'R') cur = { id: 'tool_result', kind, turn: 0, tokens: [i], en: 'tool result', zh: '工具返回' };
    else {
      turn_a++;
      cur = kind === 'C'
        ? { id: `call${turn_a}`, kind, turn: turn_a, tokens: [i], en: 'tool call', zh: '工具调用' }
        : { id: `answer${turn_a}`, kind, turn: turn_a, tokens: [i], en: 'answer', zh: '回答' };
    }
    out.push(cur);
  });
  // number the turns ("user 1", "answer 2") only when there are several
  const many = (k: Part['kind']) => out.filter((q) => q.kind === k).length > 1;
  for (const q of out) {
    if ((q.kind === 'U' || q.kind === 'A' || q.kind === 'E' || q.kind === 'C') && (many(q.kind) || (q.kind !== 'U' && many('E')))) {
      q.en += ` ${q.turn}`;
      q.zh += ` ${q.turn}`;
    }
  }
  return out.filter((q) => q.tokens.length > 0);
}

/** Loss sums for a mask (part id -> trained?) and prompt weight λ: total, the assistant's part, and tokens counted. */
export function loss_share(rows: TokenRow[], parts: Part[], trained: (p: Part) => boolean, lam: number): { total: number; answer: number; share: number; counted: number } {
  let total = 0, answer = 0, counted = 0;
  for (const p of parts) {
    const w = trained(p) ? 1 : lam;
    if (w === 0) continue;
    for (const i of p.tokens) {
      const l = rows[i].l;
      if (l === null) continue;
      total += w * l;
      counted++;
      if (p.kind === 'A' || p.kind === 'E' || p.kind === 'C') answer += w * l;
    }
  }
  return { total, answer, share: total > 0 ? answer / total : 0, counted };
}

/** Is a mask the assistant-only one (the assistant's tokens trained, everything else masked)? `last_only` accepts training only the last turn. */
export function is_assistant_only(parts: Part[], trained: (p: Part) => boolean): boolean {
  const asst = (p: Part) => p.kind === 'A' || p.kind === 'E' || p.kind === 'C';
  const all = parts.every((p) => trained(p) === asst(p));
  const last = Math.max(0, ...parts.filter(asst).map((p) => p.turn));
  const last_only = parts.every((p) => trained(p) === (asst(p) && p.turn === last));
  return all || last_only;
}

const MAX_L = 8; // nats shown at full height (higher losses are capped and marked)
const SKY = { x0: -6.85, x1: 6.85, y0: 1.7, h: 1.65 };
const ROW_X0 = -6.85, ROW_X1 = 6.85, CARD_W = 1.5, CARD_H = 0.78, CARD_GAP = 0.12;
const ROW_Y = { trained: -0.12, masked: -1.86 };

export const token_loss_mask = define_visual<TokenLossMaskParams>({
  name: 'token_loss_mask',
  summary: 'Who pays the SFT loss: a real chat sample (Qwen2.5 template, losses from Qwen2.5-0.5B) as a skyline of per-token losses; its parts (template, system, user, answer, the closing <|im_end|>, tool call, tool result) sit in a "trained" or a "masked" row; masked tokens weigh λ (prompt-loss weight). A bar shows the answer\'s share of the loss sum. Move a card between the rows; drag λ.',
  topics: ['fine-tuning', 'sft', 'loss mask', 'chat template', 'prompt loss weight', 'eos', 'tool calling'],
  params: {
    sample: { type: 'enum', values: ['single', 'multiturn', 'tool_call'], default: 'single', doc: "which real sample: 'single' (long system prompt, one question, short answer), 'multiturn' (two turns), 'tool_call' (a tool call and its result)" },
    start: { type: 'enum', values: ['all', 'assistant'], default: 'all', doc: "where the cards start: 'all' trained (no mask, the plain LM-dataset default) or 'assistant' (assistant-only loss)" },
    prompt_weight: { type: 'number', min: 0, max: 1, default: 0, doc: 'λ, the weight of masked tokens in the loss (0 = fully masked; 0.01-0.5 is the range studied by Huerta-Enochian 2024)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { sample: 'multiturn', lang: 'zh' }, { sample: 'tool_call', start: 'assistant', prompt_weight: 0.1 }, { sample: 'tool_call', lang: 'zh' }, { start: 'assistant', prompt_weight: 1, lang: 'zh' }],
  ids: ['skyline', 'rows', 'cards', 'share_bar', 'share_readout', 'formula', 'lambda_slider', 'data_note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const rows = TOKEN_SAMPLES[p.sample as keyof typeof TOKEN_SAMPLES] ?? TOKEN_SAMPLES.single;
    const parts = parts_of(rows);
    return new TokenLossMaskScene(rows, parts, lang, p);
  },
  explore: (scene: any, ui) => {
    scene.attach_cards(ui);
    scene.attach_lambda(ui);
  },
});

export class TokenLossMaskScene extends Scene {
  rows: TokenRow[];
  parts: Part[];
  lang: Lang;
  p: TokenLossMaskParams;
  /** One tracker per part: 1 = trained, 0 = masked. */
  mask: ValueTracker[];
  /** Prompt-loss weight λ (weight of masked tokens). */
  lam = ValueTracker(0);
  cards: VMobject[] = [];
  card_ids: string[] = [];
  /** Row boxes (drop-zone regions for lessons). */
  row_boxes!: { trained: VMobject; masked: VMobject };
  slider_ctl: any;
  constructor(rows: TokenRow[], parts: Part[], lang: Lang, p: TokenLossMaskParams) {
    super();
    this.rows = rows;
    this.parts = parts;
    this.lang = lang;
    this.p = p;
    this.mask = parts.map(() => ValueTracker(1));
    this.card_ids = parts.map((q) => q.id);
  }
  trained(k: number): boolean {
    return this.mask[k].get_value() >= 0.5;
  }
  /** Loss sums and the answer's share for the current mask and λ. */
  stats() {
    return loss_share(this.rows, this.parts, (q) => this.trained(this.parts.indexOf(q)), clamp(this.lam.get_value(), 0, 1));
  }
  assistant_only(): boolean {
    return is_assistant_only(this.parts, (q) => this.trained(this.parts.indexOf(q)));
  }
  /** Centre of slot i in a row. */
  slot(row: 'trained' | 'masked', i: number): [number, number, number] {
    return [ROW_X0 + 0.15 + CARD_W / 2 + i * (CARD_W + CARD_GAP), ROW_Y[row] - 0.08, 0];
  }
  /** Target positions of every card for the current mask (cards keep the sample's order in each row). */
  targets(): [number, number, number][] {
    let nt = 0, nm = 0;
    return this.parts.map((_, k) => (this.trained(k) ? this.slot('trained', nt++) : this.slot('masked', nm++)));
  }
  layout(): void {
    const t = this.targets();
    this.cards.forEach((c, k) => c.move_to(t[k]));
  }
  set_mask(k: number, on: boolean): void {
    this.mask[k].set_value(on ? 1 : 0);
  }
  toggle(k: number): void {
    this.set_mask(k, !this.trained(k));
    this.layout();
  }
  /** Index of the card under a scene point, or -1. */
  card_at(pt: readonly number[]): number {
    return this.cards.findIndex((c) => {
      const ctr = c.get_center();
      return Math.abs(pt[0] - ctr[0]) <= c.width / 2 && Math.abs(pt[1] - ctr[1]) <= c.height / 2;
    });
  }
  /** Set the cards from a predicate (part -> trained) and lay them out. */
  apply(trained: (q: Part) => boolean): void {
    this.parts.forEach((q, k) => this.set_mask(k, trained(q)));
    this.layout();
  }
  attach_lambda(ui: any): void {
    this.slider_ctl.attach(ui);
  }
  /**
   * Make every card a handle that moves between the two rows (drag it up or
   * down, or Tab to it and press an arrow key): moving a card is flipping that
   * part's mask bit. `on_move(k, trained)` is called after each change.
   */
  attach_cards(ui: any, on_move?: (k: number, trained: boolean) => void): void {
    const mid = (ROW_Y.trained + ROW_Y.masked) / 2 - 0.08;
    this.cards.forEach((card, k) => {
      ui.add_handle({
        get: () => card.get_center(),
        set: (pt: number[]) => {
          const on = pt[1] > mid;
          if (on !== this.trained(k)) {
            this.set_mask(k, on);
            this.layout();
            on_move?.(k, on);
          }
        },
        step: ROW_Y.trained - ROW_Y.masked,
        radius: 0.55,
        highlight: false,
        label: `${pick(this.lang, this.parts[k].en, this.parts[k].zh)}: ${pick(this.lang, 'up = trained, down = masked', '上 = 训练，下 = 掩掉')}`,
      });
    });
  }

  override construct() {
    const c = palette();
    const { rows, parts, lang } = this;
    this.track(this.lam, ...this.mask);
    this.lam.name = 'prompt_weight';
    const color_of = (q: Part) => ({ T: c.muted, S: c.purple, U: c.teal, A: c.accent, E: c.gold, C: c.accent, R: c.coral })[q.kind];
    const part_of = new Array(rows.length).fill(0);
    parts.forEach((q, k) => q.tokens.forEach((i) => (part_of[i] = k)));

    // ---- skyline: one bar per token; faint = its loss, solid = what it adds (w·ℓ)
    const n = rows.length, bw = (SKY.x1 - SKY.x0) / n;
    const base = VMobject({ stroke_color: c.muted, stroke_width: 2, fill_opacity: 0 });
    base.set_points_as_corners([[SKY.x0, SKY.y0, 0], [SKY.x1, SKY.y0, 0]]);
    const ghosts: VMobject[] = [], solids: VMobject[] = [];
    const H = (l: number | null) => (l === null ? 0 : (Math.min(l, MAX_L) / MAX_L) * SKY.h);
    rows.forEach((r, i) => {
      const x0 = SKY.x0 + i * bw + bw * 0.12, x1 = SKY.x0 + (i + 1) * bw - bw * 0.12;
      const col = color_of(parts[part_of[i]]);
      const g = VMobject({ fill_color: col, fill_opacity: 0.16, stroke_width: 0 });
      g.set_points_as_corners([[x0, SKY.y0, 0], [x1, SKY.y0, 0], [x1, SKY.y0 + Math.max(0.01, H(r.l)), 0], [x0, SKY.y0 + Math.max(0.01, H(r.l)), 0], [x0, SKY.y0, 0]]);
      ghosts.push(g);
      const s = VMobject({ fill_color: col, fill_opacity: 0.95, stroke_width: 0 });
      (s as any)._h = -1;
      solids.push(s);
    });
    const set_solid = (i: number) => {
      const k = part_of[i], w = this.trained(k) ? 1 : clamp(this.lam.get_value(), 0, 1);
      const h = Math.max(0.0005, H(rows[i].l) * w);
      const s: any = solids[i];
      if (Math.abs(s._h - h) < 1e-4) return;
      s._h = h;
      const x0 = SKY.x0 + i * bw + bw * 0.12, x1 = SKY.x0 + (i + 1) * bw - bw * 0.12;
      s.set_points_as_corners([[x0, SKY.y0, 0], [x1, SKY.y0, 0], [x1, SKY.y0 + h, 0], [x0, SKY.y0 + h, 0], [x0, SKY.y0, 0]]);
      s.set_fill({ opacity: h < 0.002 ? 0 : 0.95 });
    };
    const bars = VGroup(...solids);
    rows.forEach((_, i) => set_solid(i));
    bars.add_updater(() => rows.forEach((_, i) => set_solid(i)));
    const ylab = fit(label(pick(lang, 'loss per token  −log p', '每个 token 的 loss  −log p'), 22, c.muted), 6, 0.4);
    ylab.move_to([SKY.x0 + ylab.width / 2, SKY.y0 + SKY.h + 0.22, 0]);
    const skyline = VGroup(base, VGroup(...ghosts), bars, ylab);
    skyline.name = 'skyline';

    // ---- rows (drop zones) and cards
    const row = (key: 'trained' | 'masked', title: string, stroke: string) => {
      const b = box((ROW_X0 + ROW_X1) / 2, ROW_Y[key] - 0.08, ROW_X1 - ROW_X0, CARD_H + 0.24, { stroke, width: 2, fill: stroke, fill_opacity: 0.05, radius: 0.14 });
      const t = fit(label(title, 22, stroke), 8, 0.4);
      t.move_to([ROW_X0 + t.width / 2 + 0.05, ROW_Y[key] + CARD_H / 2 + 0.3, 0]);
      return { b, t };
    };
    const tr = row('trained', pick(lang, 'trained: counts in the loss (w = 1)', '训练：计入 loss（w = 1）'), c.good);
    const ms = row('masked', pick(lang, 'masked: label −100 (w = λ)', '掩掉：label 设为 −100（w = λ）'), c.muted);
    this.row_boxes = { trained: tr.b, masked: ms.b };
    const rows_g = VGroup(tr.b, tr.t, ms.b, ms.t);
    rows_g.name = 'rows';
    this.cards = parts.map((q) => {
      const col = color_of(q);
      const b = box(0, 0, CARD_W, CARD_H, { stroke: col, width: 3, fill: col, fill_opacity: 0.14, radius: 0.1 });
      const t1 = fit(label(pick(lang, q.en, q.zh), 22, c.ink), CARD_W - 0.16, 0.34);
      const t2 = fit(label(pick(lang, `${q.tokens.length} token${q.tokens.length === 1 ? '' : 's'}`, `${q.tokens.length} 个 token`), 20, c.muted), CARD_W - 0.16, 0.3);
      t1.move_to([0, 0.15, 0]);
      t2.move_to([0, -0.2, 0]);
      const g = VGroup(b, t1, t2) as unknown as VMobject;
      g.name = `card_${q.id}`;
      return g;
    });
    const cards = VGroup(...this.cards);
    cards.name = 'cards';

    // ---- the answer's share of the loss sum
    const BAR = { x0: -6.85, x1: 1.4, y: 1.18, h: 0.34 };
    const track = VMobject({ stroke_width: 0, fill_color: c.faint, fill_opacity: 1 });
    track.set_points_as_corners([[BAR.x0, BAR.y - BAR.h / 2, 0], [BAR.x1, BAR.y - BAR.h / 2, 0], [BAR.x1, BAR.y + BAR.h / 2, 0], [BAR.x0, BAR.y + BAR.h / 2, 0], [BAR.x0, BAR.y - BAR.h / 2, 0]]);
    const share_bar = VGroup(track, VMobject({ stroke_width: 0, fill_color: c.accent, fill_opacity: 0.9 }));
    const fillbar: any = share_bar.submobjects[1];
    fillbar._s = -1;
    const upd_bar = () => {
      const s = this.stats().share;
      if (Math.abs(fillbar._s - s) < 1e-4) return;
      fillbar._s = s;
      const x = BAR.x0 + Math.max(0.005, s) * (BAR.x1 - BAR.x0);
      fillbar.set_points_as_corners([[BAR.x0, BAR.y - BAR.h / 2, 0], [x, BAR.y - BAR.h / 2, 0], [x, BAR.y + BAR.h / 2, 0], [BAR.x0, BAR.y + BAR.h / 2, 0], [BAR.x0, BAR.y - BAR.h / 2, 0]]);
    };
    upd_bar();
    share_bar.add_updater(upd_bar);
    share_bar.name = 'share_bar';
    const share_lab = fit(label(pick(lang, "answer's share of the loss sum", '回答在 loss 总和中的占比'), 22, c.ink), 4.4, 0.4);
    const pct: any = DecimalNumber(0, { num_decimal_places: 0, font_size: 40, color: c.accent, unit: '\\%' });
    pct._v = NaN;
    const upd_pct = () => {
      const v = this.stats().share * 100, k = Math.round(v);
      if (pct._v !== k) {
        pct.set_value(v);
        pct._v = k;
      }
      pct.move_to([6.85 - pct.width / 2, BAR.y, 0]);
    };
    upd_pct();
    pct.add_updater(upd_pct);
    const pct_holder = pct;
    const share_readout = VGroup(share_lab, pct_holder);
    share_readout.name = 'share_readout';
    // keep the label clear of the number
    share_lab.move_to([6.85 - 1.25 - share_lab.width / 2, BAR.y, 0]);

    // ---- the formula and λ
    const formula = (MathTex as any)('S_A = \\frac{\\sum_{t\\in A} w_t\\,\\ell_t}{\\sum_{t} w_t\\,\\ell_t}', '\\qquad w_t \\in \\{1,\\ ', '\\lambda', '\\}', { font_size: 30, color: c.ink });
    formula.submobjects[2]?.set_color(c.gold);
    formula.move_to([-6.85 + formula.width / 2, -3.0, 0]);
    formula.name = 'formula';
    // ℓ is not in the text font: the definition is drawn in TeX next to the words
    const legend_words = label(pick(lang, 'A = the assistant\'s tokens ·', 'A = 助手的 token ·'), 22, c.muted);
    const legend_tex = (MathTex as any)('\\ell_t = -\\log p_t', { font_size: 26, color: c.muted });
    const legend_row = VGroup(legend_words, legend_tex);
    legend_row.arrange(RIGHT, { buff: 0.12 });
    const legend = fit(legend_row, 6.3, 0.42);
    legend.move_to([-6.85 + legend.width / 2, -3.62, 0]);
    this.slider_ctl = slider(this.lam, { x: 2.3, y: -3.0, width: 3.0, min: 0.001, max: 1, log: true, zero: true, title: pick(lang, 'λ', 'λ'), label: pick(lang, 'the prompt-loss weight λ', '提示损失权重 λ'), decimals: 3, color: c.gold });
    this.slider_ctl.group.name = 'lambda_slider';
    const note = aside(this, fit(label(pick(lang, 'real data: Qwen2.5-0.5B, Qwen2.5 chat template', '真实数据：Qwen2.5-0.5B，Qwen2.5 聊天模板'), 20, c.muted), 6.2, 0.36));
    note.move_to([6.85 - note.width / 2, -3.62, 0]);
    note.name = 'data_note';

    // ---- story
    const start_assistant = this.p.start === 'assistant';
    this.apply(() => true);
    this.lam.set_value(0);
    this.play(FadeIn(base), FadeIn(ylab), LaggedStart(...ghosts.map((g) => FadeIn(g)), { lag_ratio: 0.6 / Math.max(1, ghosts.length) }), { run_time: 1.2 });
    this.add(bars);
    this.play(GrowFromEdge(bars, DOWN), { run_time: 1.2 });
    this.play(FadeIn(rows_g), LaggedStart(...this.cards.map((m) => FadeIn(m, { shift: [0, 0.2, 0] })), { lag_ratio: 0.15 }), { run_time: 1.4 });
    share_bar.update(0);
    share_readout.update(0);
    pct.update(0);
    this.play(FadeIn(share_bar), FadeIn(share_readout), { run_time: 0.8 });
    this.play(FadeIn(formula), FadeIn(legend), FadeIn(note), { run_time: 0.8 });
    this.wait(1);
    // move everything that is not the assistant's to the masked row
    const asst = (q: Part) => q.kind === 'A' || q.kind === 'E' || q.kind === 'C';
    this.parts.forEach((q, k) => this.set_mask(k, asst(q)));
    const t = this.targets();
    this.play(...this.cards.map((m, k) => m.animate.move_to(t[k])), { run_time: 1.6 });
    this.play(Indicate(pct_holder, { color: c.accent, scale_factor: 1.15 }), { run_time: 0.8 });
    this.wait(0.6);
    // a little prompt weight brings the prompt back, scaled by λ
    this.play(this.lam.animate.set_value(0.1), { run_time: 1.6 });
    this.play(Indicate(formula.submobjects[2], { color: c.gold, scale_factor: 1.4 }), { run_time: 0.8 });
    this.add(this.slider_ctl.group);
    this.wait(0.8);
    // end in the requested start state
    const lam0 = clamp(this.p.prompt_weight, 0, 1);
    this.parts.forEach((q, k) => this.set_mask(k, start_assistant ? asst(q) : true));
    const t2 = this.targets();
    this.play(...this.cards.map((m, k) => m.animate.move_to(t2[k])), this.lam.animate.set_value(lam0), { run_time: 1.2 });
    this.add(skyline, rows_g, cards, share_bar, share_readout, formula, legend, note);
    this.wait(1);
  }
}
