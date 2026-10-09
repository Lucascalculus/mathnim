// "Will it fit?" as a real budget: the VRAM estimate of C1 (D1-D6) as one
// stacked bar - frozen weights, trainable weights, gradients, optimizer
// states, activations, logits and overhead - against the capacity of a card
// (16 / 24 / 48 / 80 GB). Every block is a term of the estimate and has its
// ledger row with the value; over capacity, the part above the card's line is
// drawn hollow and dashed and the ledger says by how much.
// Story: the configuration appears, then the bar is built block by block.
// With `hidden`, the bar and the numbers stay hidden until the lesson calls
// scene.reveal() (after the learner's prediction).
// Explore: switch model, method, sequence length, micro-batch, LoRA rank,
// activation recomputation, fused cross-entropy and the card.
import { FadeIn, Indicate, Scene, VGroup, ValueTracker, linear } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { LANG_SPEC, pick, resolve_lang, type Lang } from '../f/kit';
import { at_left, at_right, caption, txt, Choice, clamp, dashes, emit, fmt_gb, line, listen, live_label, rect, type Listener, type UiLike } from './kit';
import { METHODS, MODELS, OPTIMS, PARTS, TARGETS, vram_estimate, type Part, type VramConfig, type VramEstimate } from './vram';

export interface VramCalculatorParams extends Record<string, unknown> {
  model: string;
  method: string;
  optim: string;
  rank: number;
  targets: string;
  seq: number;
  batch: number;
  ckpt: boolean;
  fused_ce: boolean;
  gpus: number;
  zero3: boolean;
  act_const: number;
  gpu_gb: number;
  hidden: boolean;
  lang: string;
}

const CARDS = [16, 24, 48, 80];
const SEQS = [512, 1024, 2048, 4096, 8192, 16384, 32768];
const BATCHES = [1, 2, 4, 8, 16, 32];
const RANKS = [1, 4, 8, 16, 32, 64, 128, 256];
/** Geometry: controls on the left, the bar in the middle, the ledger on the right. */
const CTRL = { x0: -6.85, x1: -2.05 };
const BAR = { x0: -0.95, x1: 0.3, y0: -3.3, y1: 2.85, axis: -1.15 };
const LEDGER = { x0: 0.95, swatch: 1.12, name: 1.42, value: 6.9 };
const ROW_Y = (k: number) => 2.75 - 0.55 * k; // k = 0 is the top row (overhead)

const nearest = (xs: number[], v: number) => xs.reduce((b, x) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(b / v)) ? x : b), xs[0]);

export const vram_calculator = define_visual<VramCalculatorParams>({
  name: 'vram_calculator',
  summary: 'Will fine-tuning fit on this GPU? A stacked bar of the C1 VRAM estimate (frozen weights, trainable weights, gradients, optimizer states, activations, logits, overhead) against 16/24/48/80 GB cards, with a ledger of values. Student switches model, method (full/LoRA/QLoRA), sequence length, micro-batch, LoRA rank, activation recomputation, fused cross-entropy and the card. An estimate from formulas, not a measurement.',
  topics: ['fine-tuning', 'llm', 'vram', 'gpu memory', 'lora', 'qlora', 'activations', 'optimizer states'],
  params: {
    model: { type: 'enum', values: MODELS.map((m) => m.id), default: 'llama3.1-8b', doc: 'model preset (exact architecture from config.json): llama3.2-1b, llama3.2-3b, llama3.1-8b, qwen2.5-7b, qwen2.5-14b, qwen2.5-32b, llama3.1-70b' },
    method: { type: 'enum', values: [...METHODS], default: 'full', doc: "'full' (all weights trained, AdamW 16 bytes/param), 'lora' (frozen bf16 base + fp32 adapters), 'qlora' (frozen NF4 base with double quantisation + adapters)" },
    optim: { type: 'enum', values: [...OPTIMS], default: 'adamw', doc: "'adamw' mixed precision (16 bytes/param), 'adamw8bit' (10), 'bf16' pure bf16 (8)" },
    rank: { type: 'integer', min: 1, max: 256, default: 16, doc: 'LoRA rank r (LoRA and QLoRA only); 8B all-linear r = 16 is 41.9M parameters' },
    targets: { type: 'enum', values: [...TARGETS], default: 'all-linear', doc: "where LoRA is attached: 'all-linear' (7 linear layers per block) or 'attn' (q, k, v, o only)" },
    seq: { type: 'integer', min: 512, max: 32768, default: 4096, doc: 'sequence length s in tokens (512-32768); activations and logits grow with s·b' },
    batch: { type: 'integer', min: 1, max: 32, default: 1, doc: 'micro-batch b per GPU (1-32)' },
    ckpt: { type: 'boolean', default: true, doc: 'activation recomputation ("gradient checkpointing"): keep only each layer input, about 1.6 GB instead of 18 GB for 8B at 4k, +33% compute' },
    fused_ce: { type: 'boolean', default: false, doc: 'chunked / fused cross-entropy: the b·s·V fp32 logits and their gradient are never stored whole (≈ 0 instead of 4.2 GB for 8B at 4k). TRL SFTTrainer computes log-probs in chunks by default; plain PyTorch / Trainer stores them (false)' },
    gpus: { type: 'integer', min: 1, max: 8, default: 1, doc: 'number of GPUs; only matters with zero3 (sharding), otherwise each GPU holds everything' },
    zero3: { type: 'boolean', default: false, doc: 'ZeRO-3 / FSDP: weights, gradients and optimizer states are split over the GPUs (activations are not)' },
    act_const: { type: 'integer', min: 34, max: 41, default: 34, doc: 'bytes per s·b·h per layer kept for backward: 34 (Korthikanti, default) or 41 (rough Llama estimate)' },
    gpu_gb: { type: 'integer', min: 16, max: 80, default: 24, doc: 'the card the bar is compared with: 16, 24, 48 or 80 GB (other values snap to the nearest)' },
    hidden: { type: 'boolean', default: false, doc: 'start with the bar and numbers hidden (for a prediction first); the lesson reveals them with scene.reveal()' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { method: 'lora', fused_ce: true },
    { method: 'qlora', fused_ce: true, batch: 16, lang: 'zh' },
    { model: 'qwen2.5-7b', method: 'lora', seq: 8192, gpu_gb: 24, ckpt: false },
    { model: 'llama3.1-70b', method: 'full', ckpt: false, seq: 32768, batch: 32, gpu_gb: 80 },
    { model: 'llama3.2-1b', method: 'qlora', seq: 512, fused_ce: true, gpu_gb: 16, lang: 'zh' },
    { hidden: true },
    { gpus: 4, zero3: true, optim: 'adamw8bit', gpu_gb: 80, lang: 'zh' },
  ],
  ids: ['bar', 'axis', 'row_frozen', 'row_weights', 'row_grads', 'row_optim', 'row_acts', 'row_logits', 'row_overhead', 'capacity_lines', 'ledger', 'total', 'status', 'controls', 'model_control', 'method_control', 'seq_control', 'batch_control', 'rank_control', 'ckpt_control', 'fused_control', 'card_control', 'honesty_note'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class VramCalculator extends Scene {
      /** Model preset index into MODELS (0 Llama-3.2-1B ... 6 Llama-3.1-70B). */
      model = ValueTracker(Math.max(0, MODELS.findIndex((m) => m.id === p.model)));
      /** 0 full, 1 LoRA, 2 QLoRA. */
      method = ValueTracker(Math.max(0, METHODS.indexOf(p.method as any)));
      /** 0 AdamW mixed precision, 1 8-bit AdamW, 2 pure bf16. */
      optim = ValueTracker(Math.max(0, OPTIMS.indexOf(p.optim as any)));
      rank = ValueTracker(p.rank);
      /** 0 all-linear, 1 attention only. */
      targets = ValueTracker(Math.max(0, TARGETS.indexOf(p.targets as any)));
      seq = ValueTracker(p.seq);
      batch = ValueTracker(p.batch);
      /** Activation recomputation: 0 off, 1 on. */
      ckpt = ValueTracker(p.ckpt ? 1 : 0);
      /** Fused cross-entropy: 0 off, 1 on. */
      fused = ValueTracker(p.fused_ce ? 1 : 0);
      gpus = ValueTracker(p.gpus);
      zero3 = ValueTracker(p.zero3 ? 1 : 0);
      act_const = ValueTracker(p.act_const);
      /** Card capacity in GB (16, 24, 48, 80). */
      gpu = ValueTracker(nearest(CARDS, p.gpu_gb));
      /** How many blocks of the bar are shown (0..7, fractional while growing); 7 = everything revealed. */
      grow = ValueTracker(0);
      controls: Choice[] = [];
      /** The current configuration. */
      config(): VramConfig {
        const ix = (t: ValueTracker, n: number) => clamp(Math.round(t.get_value()), 0, n - 1);
        return {
          model: MODELS[ix(this.model, MODELS.length)], method: METHODS[ix(this.method, 3)], optim: OPTIMS[ix(this.optim, 3)],
          rank: Math.round(this.rank.get_value()), targets: TARGETS[ix(this.targets, 2)], seq: Math.round(this.seq.get_value()),
          batch: Math.round(this.batch.get_value()), ckpt: this.ckpt.get_value() > 0.5, fused_ce: this.fused.get_value() > 0.5,
          gpus: Math.round(this.gpus.get_value()), zero3: this.zero3.get_value() > 0.5, act_const: this.act_const.get_value(),
        };
      }
      /** The estimate for the current configuration (GB per GPU). */
      estimate(): VramEstimate {
        return vram_estimate(this.config());
      }
      /** Does the estimate fit the chosen card? */
      fits(): boolean {
        return this.estimate().total <= this.gpu.get_value();
      }
      /** Is the bar shown (after the story or reveal())? */
      revealed(): boolean {
        return this.grow.get_value() >= PARTS.length - 1e-6;
      }
      /** Show the bar and the numbers at once. */
      reveal(): void {
        this.grow.set_value(PARTS.length);
      }
      /** Hide them again (before a new prediction). */
      hide(): void {
        this.grow.set_value(0);
      }
      /** The bar built block by block (for player.play_now after a prediction). */
      reveal_animation(run_time = 4) {
        return this.grow.animate({ run_time, rate_func: linear }).set_value(PARTS.length);
      }
      /** Set part of the configuration (method 'lora', seq 16384, ckpt true, gpu 24 ...). */
      set_config(c: Partial<Omit<VramConfig, 'model'>> & { model?: string; gpu?: number }): void {
        if (c.model !== undefined) this.model.set_value(Math.max(0, MODELS.findIndex((m) => m.id === c.model)));
        if (c.method !== undefined) this.method.set_value(METHODS.indexOf(c.method));
        if (c.optim !== undefined) this.optim.set_value(OPTIMS.indexOf(c.optim));
        if (c.targets !== undefined) this.targets.set_value(TARGETS.indexOf(c.targets));
        for (const k of ['rank', 'seq', 'batch', 'gpus', 'act_const', 'gpu'] as const) if (c[k] !== undefined) (this as any)[k].set_value(c[k]);
        if (c.ckpt !== undefined) this.ckpt.set_value(c.ckpt ? 1 : 0);
        if (c.fused_ce !== undefined) this.fused.set_value(c.fused_ce ? 1 : 0);
        if (c.zero3 !== undefined) this.zero3.set_value(c.zero3 ? 1 : 0);
      }
      /** Subscribe to the learner's changes: f('control', { name, value }) when a switch is released. */
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { grow } = this;
        this.track(this.model, this.method, this.optim, this.rank, this.targets, this.seq, this.batch, this.ckpt, this.fused, this.gpus, this.zero3, this.act_const, this.gpu, grow);
        const est = () => this.estimate();
        const colour: Record<Part, [string, number]> = {
          frozen: [c.accent, 0.32], weights: [c.accent, 0.9], grads: [c.teal, 0.85], optim: [c.purple, 0.8], acts: [c.gold, 0.8], logits: [c.coral, 0.8], overhead: [c.muted, 0.45],
        };
        const H = BAR.y1 - BAR.y0;
        // visible amount of part k (0..1) while the bar grows
        const shown = (k: number) => clamp(grow.get_value() - k, 0, 1);
        const visible_total = (e: VramEstimate) => PARTS.reduce((s, k, i) => s + e.parts[k] * shown(i), 0);
        const ymax = (e: VramEstimate) => Math.max(this.gpu.get_value() * 1.25, visible_total(e) * 1.1);
        const Y = (v: number, ym: number) => BAR.y0 + (v / ym) * H;

        // ---- axis and capacity lines (rebuilt when the scale or the card changes)
        const axis_line = line([BAR.axis, BAR.y0], [BAR.axis, BAR.y1 + 0.1], c.muted, 2);
        const gb_label = at_right(txt('GB', 24, c.muted), BAR.axis - 0.12, BAR.y1 + 0.32);
        const ticks = VGroup();
        const upd_ticks = (m: any) => {
          const e = est(), ym = ymax(e), card = this.gpu.get_value();
          const key = `${ym.toFixed(3)}|${card}`;
          if (m._key === key) return;
          m._key = key;
          const raw = ym / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw)!;
          const cands: [number, number][] = [[card, 0], [0, 1], ...CARDS.filter((x) => x !== card).map((x) => [x, 2] as [number, number])];
          for (let v = step; v <= ym; v += step) cands.push([v, 3]);
          const placed: number[] = [], kids: Mobject[] = [];
          for (const [v, prio] of cands.sort((a, b) => a[1] - b[1])) {
            if (v > ym) continue;
            const y = Y(v, ym);
            if (placed.some((q) => Math.abs(q - y) < 0.34)) continue;
            placed.push(y);
            const col = prio === 0 ? c.ink : c.muted;
            kids.push(at_right(txt(v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${Math.round(v)}`, 24, col, { weight: prio === 0 ? 'BOLD' : 'NORMAL' }), BAR.axis - 0.12, y), line([BAR.axis - 0.08, y], [BAR.axis, y], c.muted, 2));
          }
          // capacity lines: the chosen card solid, the others dashed and faint
          for (const cap of CARDS) {
            if (cap > ym) continue;
            const y = Y(cap, ym);
            kids.push(cap === card ? line([BAR.axis, y], [BAR.x1 + 0.35, y], c.ink, 3.5) : dashes([BAR.axis, y], [BAR.x1 + 0.35, y], c.muted, 1.6, 0.1, 0.08, 0.8));
          }
          m.submobjects = kids;
        };
        upd_ticks(ticks);
        ticks.add_updater(upd_ticks);
        const axis = VGroup(axis_line, gb_label, ticks);
        axis.name = 'axis';
        ticks.name = 'capacity_lines';

        // ---- the bar (rebuilt when a value, the scale or the growth changes)
        const bar = VGroup();
        bar.name = 'bar';
        const tops: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
        const upd_bar = (m: any) => {
          const e = est(), ym = ymax(e), card = this.gpu.get_value();
          const key = `${PARTS.map((k) => e.parts[k].toFixed(4)).join(',')}|${grow.get_value().toFixed(4)}|${ym.toFixed(4)}|${card}`;
          if (m._key === key) return;
          m._key = key;
          const kids: Mobject[] = [];
          const yc = Y(card, ym);
          let v = 0;
          PARTS.forEach((k, i) => {
            const a = Y(v, ym);
            v += e.parts[k] * shown(i);
            const b = Y(v, ym);
            tops[i] = (a + b) / 2;
            if (b - a < 1e-4) return;
            const [col, op] = colour[k];
            if (a < yc) kids.push(rect(BAR.x0, a, BAR.x1, Math.min(b, yc), col, op));
            if (b > yc) kids.push(rect(BAR.x0, Math.max(a, yc), BAR.x1, b, col, op * 0.4));
          });
          const top = Y(v, ym);
          if (top > yc + 0.02) {
            // over capacity: the part above the card's line is hollow, with a dashed outline
            kids.push(dashes([BAR.x0, yc], [BAR.x0, top], c.coral, 3), dashes([BAR.x0, top], [BAR.x1, top], c.coral, 3), dashes([BAR.x1, top], [BAR.x1, yc], c.coral, 3));
          }
          m.submobjects = kids;
          m._tops = tops.slice();
        };
        upd_bar(bar);
        bar.add_updater(upd_bar);

        // ---- the ledger: one row per block, top row = top block
        const names: Record<Part, () => string> = {
          frozen: () => (this.config().method === 'qlora' ? L('frozen base (NF4, emb. bf16)', '冻结的基座（NF4，嵌入 bf16）') : L('frozen base weights (bf16)', '冻结的基座权重（bf16）')),
          weights: () => (this.config().method === 'full' ? L('trainable weights (bf16)', '可训练权重（bf16）') : L('adapter weights', '适配器权重')),
          grads: () => L('gradients', '梯度'),
          optim: () => L('optimizer states', '优化器状态'),
          acts: () => L('activations', '激活值'),
          logits: () => L('logits + their gradient', 'logits 及其梯度'),
          overhead: () => L('overhead (1 GB, rule of thumb)', '开销（按 1 GB 计，经验值）'),
        };
        const rows = PARTS.map((k, i) => {
          const y = ROW_Y(PARTS.length - 1 - i);
          const [col, op] = colour[k];
          const sw = rect(LEDGER.swatch, y - 0.13, LEDGER.swatch + 0.26, y + 0.13, col, op);
          const zero = () => this.estimate().parts[k] < 5e-4;
          const name = live_label(names[k], 24, () => (zero() ? c.muted : c.ink), (t) => at_left(t, LEDGER.name, y), { max_width: 3.85 });
          const value = live_label(() => (shown(i) < 1 ? '?' : zero() ? '0 GB' : `${fmt_gb(this.estimate().parts[k])} GB`), 24, () => (zero() || shown(i) < 1 ? c.muted : c.ink), (t) => at_right(t, LEDGER.value, y));
          const g = VGroup(sw, name, value);
          g.name = `row_${k}`;
          return g;
        });
        // connectors from each block to its row
        const connectors = VGroup();
        const upd_conn = (m: any) => {
          const e = est(), t = (bar as any)._tops as number[];
          const key = `${t.map((x) => x.toFixed(3)).join(',')}|${PARTS.map((k, i) => (e.parts[k] * shown(i) > 1e-4 ? 1 : 0)).join('')}`;
          if (m._key === key) return;
          m._key = key;
          m.submobjects = PARTS.flatMap((k, i) => (e.parts[k] * shown(i) > 1e-4 ? [line([BAR.x1 + 0.04, t[i]], [LEDGER.swatch - 0.06, ROW_Y(PARTS.length - 1 - i)], c.muted, 1.5, 0.8)] : []));
        };
        upd_conn(connectors);
        connectors.add_updater(upd_conn);
        // the largest block, highlighted once everything is shown
        const largest = VGroup();
        const upd_largest = (m: any) => {
          const e = est(), on = this.revealed();
          const key = `${on ? e.largest : '-'}`;
          if (m._key === key) return;
          m._key = key;
          const y = ROW_Y(PARTS.length - 1 - PARTS.indexOf(e.largest));
          m.submobjects = on ? [rect(LEDGER.x0, y - 0.25, LEDGER.value + 0.05, y + 0.25, c.faint, 0.9)] : [];
        };
        upd_largest(largest);
        largest.add_updater(upd_largest);
        const ledger = VGroup(largest, ...rows);
        ledger.name = 'ledger';

        // ---- total, status, configuration and the honesty note
        const ty = ROW_Y(6) - 0.62;
        const rule = line([LEDGER.x0, ty + 0.32], [LEDGER.value, ty + 0.32], c.muted, 1.5);
        const total = VGroup(
          at_left(txt(L('total per GPU', '每张卡合计'), 28, c.ink, { weight: 'BOLD' }), LEDGER.name, ty),
          live_label(() => (this.revealed() ? `${fmt_gb(this.estimate().total)} GB` : '? GB'), 28, c.ink, (t) => at_right(t, LEDGER.value, ty), { weight: 'BOLD' }),
        );
        total.name = 'total';
        const status = live_label(() => {
          if (!this.revealed()) return '';
          const e = this.estimate(), card = this.gpu.get_value(), d = card - e.total;
          return d >= 0 ? L(`fits a ${card} GB card: ${fmt_gb(d)} GB free`, `${card} GB 的卡放得下，还剩 ${fmt_gb(d)} GB`) : L(`over a ${card} GB card by ${fmt_gb(-d)} GB`, `超出 ${card} GB 的卡 ${fmt_gb(-d)} GB`);
        }, 26, () => (this.fits() ? c.good : c.coral), (t) => at_left(t, LEDGER.name, ty - 0.55), { max_width: 5.4 });
        status.name = 'status';
        const conf = live_label(() => {
          const k = this.config();
          const opt = { adamw: L('AdamW, mixed precision', '混合精度 AdamW'), adamw8bit: L('8-bit AdamW', '8-bit AdamW'), bf16: L('pure-bf16 Adam', '纯 bf16 Adam') }[k.optim];
          const tg = k.method === 'full' ? '' : k.targets === 'attn' ? L(' · LoRA: attention only', ' · LoRA：只挂注意力层') : L(' · LoRA: all linear', ' · LoRA：所有线性层');
          const g = k.zero3 && k.gpus > 1 ? L(` · ${k.gpus} GPUs, ZeRO-3`, ` · ${k.gpus} 张卡 ZeRO-3`) : k.gpus > 1 ? L(` · ${k.gpus} GPUs (no sharding)`, ` · ${k.gpus} 张卡（不分片）`) : '';
          return `${opt}${tg}${g}`;
        }, 24, c.muted, (t) => at_left(t, LEDGER.name, ty - 1.12), { max_width: 5.45 });
        const note = VGroup(
          at_left(txt(L('estimate from formulas, not measured', '按公式估算，不是实测'), 24, c.muted), LEDGER.name, ty - 1.62),
        );
        if (note.width > 5.45) note.scale(5.45 / note.width).align_to([LEDGER.name, 0, 0], [-1, 0, 0]);
        note.name = 'honesty_note';
        const title = at_left(txt(L('VRAM per GPU (estimate)', '每张卡的显存（估算）'), 30, c.ink, { weight: 'BOLD' }), LEDGER.x0, 3.45);

        // ---- controls
        const cfg_now = () => this.config();
        const cap_live = (f: () => string, x: number, y: number) => live_label(f, 24, c.muted, (t) => at_left(t, x, y), { max_width: CTRL.x1 - CTRL.x0 });
        const mk = (tracker: ValueTracker, labels: string[], y: number, o: { values?: number[]; log?: boolean; x0?: number; enabled?: () => boolean; label_colors?: (string | undefined)[]; dividers?: number[] } = {}) => {
          const ch = new Choice({ tracker, labels, values: o.values, log: o.log, x0: o.x0 ?? CTRL.x0, x1: CTRL.x1, y, enabled: o.enabled, label_colors: o.label_colors, dividers: o.dividers });
          this.controls.push(ch);
          return ch;
        };
        const ks = (v: number) => (v >= 1024 ? `${v / 1024}k` : `${v}`);
        const model_c = mk(this.model, MODELS.map((m) => m.short), 3.12, { label_colors: MODELS.map((m) => (m.family === 'Qwen' ? c.teal : undefined)), dividers: [MODELS.findIndex((m) => m.family === 'Qwen')] });
        const method_c = mk(this.method, [L('full', '全量'), 'LoRA', 'QLoRA'], 2.17);
        const seq_c = mk(this.seq, SEQS.map(ks), 1.22, { values: SEQS, log: true });
        const batch_c = mk(this.batch, BATCHES.map(String), 0.27, { values: BATCHES, log: true });
        const rank_c = mk(this.rank, RANKS.map(String), -0.68, { values: RANKS, log: true, enabled: () => cfg_now().method !== 'full' });
        const ckpt_c = mk(this.ckpt, [L('off', '关'), L('on', '开')], -1.5, { x0: -3.1 });
        const fused_c = mk(this.fused, [L('off', '关'), L('on', '开')], -2.2, { x0: -3.1 });
        const card_c = mk(this.gpu, CARDS.map((v) => `${v} GB`), -3.3, { values: CARDS, log: true });
        const fit_w = (m: Mobject, w: number) => {
          if (m.width > w) m.scale(w / m.width).align_to([CTRL.x0, 0, 0], [-1, 0, 0]);
          return m;
        };
        const caps = VGroup(
          cap_live(() => { const e = this.estimate(); return L(`model: ${e.arch.name} (${(e.n_total / 1e9).toFixed(2)}B params)`, `模型：${e.arch.name}（${(e.n_total / 1e9).toFixed(2)}B 参数）`); }, CTRL.x0, 3.56),
          caption(L('method', '方法'), CTRL.x0, 2.61),
          cap_live(() => L(`sequence length s = ${cfg_now().seq}`, `序列长度 s = ${cfg_now().seq}`), CTRL.x0, 1.66),
          cap_live(() => L(`micro-batch b = ${cfg_now().batch}`, `微批 b = ${cfg_now().batch}`), CTRL.x0, 0.71),
          cap_live(() => (cfg_now().method === 'full' ? L('LoRA rank r (not used by full)', 'LoRA 秩 r（全量不用）') : L(`LoRA rank r = ${cfg_now().rank} · ${(this.estimate().n_lora / 1e6).toFixed(1)}M params`, `LoRA 秩 r = ${cfg_now().rank} · ${(this.estimate().n_lora / 1e6).toFixed(1)}M 参数`)), CTRL.x0, -0.24),
          fit_w(caption(L('activation recomputation', '激活重算'), CTRL.x0, -1.5), 3.65),
          fit_w(caption(L('chunked CE (TRL default)', '分块交叉熵（TRL 默认）'), CTRL.x0, -2.2), 3.65),
          caption(L('GPU memory (card)', '显卡显存'), CTRL.x0, -2.86),
        );
        const names_c = ['model_control', 'method_control', 'seq_control', 'batch_control', 'rank_control', 'ckpt_control', 'fused_control', 'card_control'];
        [model_c, method_c, seq_c, batch_c, rank_c, ckpt_c, fused_c, card_c].forEach((ch, i) => (ch.name = names_c[i]));
        const controls = VGroup(...this.controls, caps);
        controls.name = 'controls';

        // ---- the story
        this.play(FadeIn(controls), FadeIn(title), { run_time: 1.2 });
        this.play(FadeIn(axis), FadeIn(ledger), FadeIn(rule), FadeIn(total), FadeIn(conf), FadeIn(note), { run_time: 1.2 });
        this.add(bar, connectors, status);
        this.wait(0.8);
        if (!p.hidden) {
          this.play(grow.animate.set_value(PARTS.length), { run_time: 6, rate_func: linear });
          const e = this.estimate();
          this.play(Indicate(rows[PARTS.indexOf(e.largest)].submobjects[0], { scale_factor: 1.4 }), { run_time: 1 });
          this.wait(1.5);
        } else this.wait(5);
        this.add(controls, axis, ledger);
      }
    }
    return new VramCalculator();
  },
  explore: (scene: any, ui) => {
    const u = ui as unknown as UiLike;
    const said = (name: string) => (value: number) => emit(scene, 'control', { name, value });
    const labels = ['the model preset', 'the fine-tuning method (full, LoRA, QLoRA)', 'the sequence length', 'the micro-batch size', 'the LoRA rank', 'activation recomputation on or off', 'chunked (fused) cross-entropy on or off', 'the GPU memory of the card'];
    const keys = ['model', 'method', 'seq', 'batch', 'rank', 'ckpt', 'fused_ce', 'gpu'];
    (scene.controls as Choice[]).forEach((ch, i) => ch.attach(u, labels[i], said(keys[i])));
  },
});
