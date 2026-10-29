// How much of a real weight update ΔW does rank r keep? ΔW = (rank-r part) +
// (residual), shown as three heatmaps of the same 48 x 48 crop on one colour
// scale, above the singular-value spectra of three matrices of the same layer:
// the official post-training ΔW (Qwen2.5-0.5B -> Instruct), the same ΔW cut
// to rank 16 (what any r = 16 LoRA update is), and a random matrix with the
// same norm (illustration). Moving the cut line r keeps the σᵢ left of it and
// drops the rest (Eckart-Young: the best rank-r approximation); the readouts
// give the energy kept Σ_{i≤r}σᵢ²/Σσᵢ², the relative error and r(d+k) vs dk.
// Story: ΔW and the spectra appear, r sweeps from 1 to 64, then settles.
// Explore: drag the cut line; switch the matrix and the layer.
import { Create, Dot, FadeIn, Group, Scene, VGroup, VMobject, ValueTracker, Write, linear, smooth, RIGHT } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { LANG_SPEC, pick, resolve_lang, type Lang } from '../f/kit';
import { tex } from '../../linalg/kit';
import { at_left, at_right, caption, Choice, clamp, diverging, emit, heatmap, line, listen, live_label, rect, txt, type Listener, type P3, type UiLike } from './kit';
import { energy_kept, lora_params, rank_for, reconstruct, rel_error } from './lowrank';
import { LOWRANK_SOURCES, type LowrankSource } from './lowrank_data';
import { aside } from '../../aside';

export interface LowrankUpdateParams extends Record<string, unknown> {
  source: string;
  layer: string;
  r: number;
  lang: string;
}

const SOURCES = ['full_ft', 'rank16', 'random'] as const;
const LAYERS = ['q_proj', 'down_proj'] as const;
const R_MAX = 64;
/** Geometry. */
const HM = { size: 2.5, y: 2.05, xs: [-5.45, -2.2, 1.05] };
const PLOT = { x0: -6.0, x1: 2.25, y0: -3.05, y1: -0.6 };
const PX = 2.85; // right panel, left edge
const PX1 = 6.92;

const fit = <T extends Mobject>(m: T, w: number): T => {
  if (m.width > w) m.scale(w / m.width);
  return m;
};
const num = (x: number) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** a×10^b in TeX. */
function tex_sci(x: number, digits = 2): string {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x))), m = x / 10 ** e;
  return `${m.toFixed(digits - 1)}\\times 10^{${e}}`;
}
export const source_of = (id: string, layer: string): LowrankSource => LOWRANK_SOURCES.find((s) => s.id === id && s.layer === layer) ?? LOWRANK_SOURCES[0];

export const lowrank_update = define_visual<LowrankUpdateParams>({
  name: 'lowrank_update',
  summary: "How much of a real fine-tuning update ΔW does rank r keep? Heatmaps ΔW = rank-r part + residual (one 48x48 crop), the singular-value spectra (log-log) of the official post-training ΔW of Qwen2.5-0.5B, the same ΔW cut to rank 16, and a random matrix of the same norm, with a cut line at r; readouts energy kept Σσᵢ²(i≤r)/Σσᵢ², relative error, LoRA params r(d+k) vs dk. Student drags r and switches matrix and layer.",
  topics: ['lora', 'low rank', 'svd', 'singular values', 'eckart-young', 'fine-tuning', 'pca'],
  params: {
    source: { type: 'enum', values: [...SOURCES], default: 'full_ft', doc: "'full_ft' the official post-training ΔW (Qwen2.5-0.5B -> Instruct, includes RL), 'rank16' the same ΔW truncated to rank 16 (exactly 100% energy at r = 16), 'random' a Gaussian matrix with the same shape and norm (illustration: no low-rank structure)" },
    layer: { type: 'enum', values: [...LAYERS], default: 'q_proj', doc: "'q_proj' (896 x 896) or 'down_proj' (896 x 4864) of the same block" },
    r: { type: 'integer', min: 1, max: R_MAX, default: 4, doc: 'the rank kept (1-64): the top r singular values' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { source: 'rank16', r: 16, lang: 'zh' },
    { source: 'random', r: 64 },
    { source: 'full_ft', layer: 'down_proj', r: 1, lang: 'zh' },
    { source: 'rank16', layer: 'down_proj', r: 15 },
  ],
  ids: ['heatmap_dW', 'heatmap_rank_r', 'heatmap_residual', 'colour_scale', 'spectrum', 'cut_line', 'source_control', 'layer_control', 'provenance', 'r_readout', 'energy_bar', 'error_readout', 'params_readout'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class LowrankUpdate extends Scene {
      /** The rank kept (1..64). */
      r = ValueTracker(p.r);
      /** 0 official post-training ΔW, 1 the same cut to rank 16, 2 random (illustration). */
      source = ValueTracker(Math.max(0, SOURCES.indexOf(p.source as any)));
      /** 0 q_proj, 1 down_proj. */
      layer = ValueTracker(Math.max(0, LAYERS.indexOf(p.layer as any)));
      controls: Choice[] = [];
      /** The matrix shown. */
      src(): LowrankSource {
        const ix = (t: ValueTracker, n: number) => clamp(Math.round(t.get_value()), 0, n - 1);
        return source_of(SOURCES[ix(this.source, 3)], LAYERS[ix(this.layer, 2)]);
      }
      rank(): number {
        return clamp(Math.round(this.r.get_value()), 1, R_MAX);
      }
      /** Energy kept at rank r (default: the current r), over all singular values of the whole matrix. */
      energy(r = this.rank()): number {
        return energy_kept(this.src().sigma, r);
      }
      /** ‖ΔW − rank-r part‖ / ‖ΔW‖ for the whole matrix. */
      rel_error(r = this.rank()): number {
        return rel_error(this.src().sigma, r);
      }
      /** Smallest r keeping `frac` of the energy (may exceed 64, the largest r the cut line reaches). */
      r_for(frac = 0.9): number {
        return rank_for(this.src().sigma, frac);
      }
      /** LoRA parameters at rank r against the full layer. */
      params(r = this.rank()) {
        const s = this.src();
        return lora_params(s.d, s.k, r);
      }
      /** Subscribe to the learner's changes: f('r' | 'source' | 'layer', { value }) when a drag or click ends. */
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { r } = this;
        this.track(r, this.source, this.layer);
        // the story starts at r = 1 (set before the live parts are built, so nothing rebuilds mid-animation)
        r.set_value(1);
        const key = () => `${Math.round(this.source.get_value())}|${Math.round(this.layer.get_value())}`;

        // ---- the three heatmaps: ΔW = rank-r part + residual (same colour scale)
        const maps = HM.xs.map((x) => heatmap(48, 48, x, HM.y, HM.size, HM.size));
        const [h_dw, h_r, h_res] = maps;
        h_dw.name = 'heatmap_dW';
        h_r.name = 'heatmap_rank_r';
        h_res.name = 'heatmap_residual';
        const frames = HM.xs.map((x) => {
          const f = VMobject({ stroke_color: c.muted, stroke_width: 1.5, fill_opacity: 0 });
          const s = HM.size / 2 + 0.02;
          f.set_points_as_corners([[x - s, HM.y - s, 0], [x + s, HM.y - s, 0], [x + s, HM.y + s, 0], [x - s, HM.y + s, 0], [x - s, HM.y - s, 0]]);
          return f;
        });
        const scale_of = (s: LowrankSource) => Math.max(1e-12, ...s.crop.map((row) => Math.max(...row.map(Math.abs))));
        const colour = (m: number) => (v: number) => diverging(v, m, c.bg, c.coral, c.accent);
        const paint = (mob: any) => {
          const k = `${key()}|${this.rank()}`;
          if (mob._key === k) return;
          mob._key = k;
          const s = this.src(), m = scale_of(s);
          const R = reconstruct(s.sigma, s.U, s.V, this.rank());
          h_dw.paint(s.crop, colour(m));
          h_r.paint(R, colour(m));
          h_res.paint(s.crop.map((row, a) => row.map((v, b) => v - R[a][b])), colour(m));
        };
        const heat = VGroup(...frames);
        paint(heat);
        heat.add_updater(paint);
        const eq = tex('=', 48).move_to([(HM.xs[0] + HM.xs[1]) / 2, HM.y, 0]);
        const plus = tex('+', 48).move_to([(HM.xs[1] + HM.xs[2]) / 2, HM.y, 0]);
        const ty = HM.y + HM.size / 2 + 0.3;
        const t_dw = fit(txt(L('ΔW (48 × 48 crop)', 'ΔW（48 × 48 局部）'), 26, c.ink), HM.size + 0.2).move_to([HM.xs[0], ty, 0]);
        const t_r = live_label(() => L(`rank-${this.rank()} part`, `秩 ${this.rank()} 的部分`), 26, c.accent, (t) => t.move_to([HM.xs[1], ty, 0]));
        const t_res = fit(txt(L('residual E (dropped)', '残差 E（被截掉的）'), 26, c.ink), HM.size + 0.2).move_to([HM.xs[2], ty, 0]);
        // colour scale, shared by all three
        const cy = HM.y - HM.size / 2 - 0.33;
        const bar_w = 2.2, bar = heatmap(1, 64, HM.xs[1], cy, bar_w, 0.16);
        const bar_vals = [Array.from({ length: 64 }, (_, i) => -1 + (2 * i + 1) / 64)];
        bar.paint(bar_vals, colour(1));
        const scale_labels = VGroup();
        const upd_scale = (g: any) => {
          const k = key();
          if (g._key === k) return;
          g._key = k;
          const m = scale_of(this.src());
          g.submobjects = [
            at_right(tex(`-${tex_sci(m)}`, 26, c.accent), HM.xs[1] - bar_w / 2 - 0.12, cy),
            at_left(tex(`+${tex_sci(m)}`, 26, c.coral), HM.xs[1] + bar_w / 2 + 0.12, cy),
          ];
        };
        upd_scale(scale_labels);
        scale_labels.add_updater(upd_scale);
        const colour_scale = Group(bar, scale_labels);
        colour_scale.name = 'colour_scale';

        // ---- the spectra (log-log), same axes for the three matrices of a layer
        const lsrc = (j: number) => source_of(SOURCES[j], LAYERS[clamp(Math.round(this.layer.get_value()), 0, 1)]);
        // singular values below 1e-6 of the largest are numerically 0 (e.g. the rank-16 cut beyond 16): drawn on the floor
        const tiny = () => 1e-6 * Math.max(...[0, 1, 2].map((j) => lsrc(j).sigma[0]));
        const range = () => {
          const t = tiny(), all = [0, 1, 2].flatMap((j) => lsrc(j).sigma.filter((x) => x > t));
          // at most 1.6 decades: the few very small last values would squash the body of the spectra (smaller ones sit on the floor)
          const hi = Math.log10(Math.max(...all)) + 0.1;
          return [Math.max(Math.log10(Math.min(...all)) - 0.15, hi - 1.7), hi];
        };
        const n_of = () => lsrc(0).sigma.length;
        const X = (i: number) => PLOT.x0 + (Math.log(i) / Math.log(n_of())) * (PLOT.x1 - PLOT.x0);
        const Y = (s: number, rg: number[]) => (s <= tiny() ? PLOT.y0 : PLOT.y0 + 0.12 + Math.max(0, (Math.log10(s) - rg[0]) / (rg[1] - rg[0])) * (PLOT.y1 - PLOT.y0 - 0.12));
        const poly = (pts: number[][], color: string, width: number, opacity = 1) => {
          const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
          if (pts.length >= 2) vm.set_points_as_corners(pts.map((q) => [q[0], q[1], 0]));
          return vm;
        };
        const spectra = VGroup();
        const upd_spectra = (g: any) => {
          const sel = Math.round(this.source.get_value()), k = `${key()}|${sel === 0 || sel === 1 || sel === 2 ? this.rank() : 0}`;
          if (g._key === k) return;
          g._key = k;
          const rg = range(), kids: Mobject[] = [];
          for (const j of [0, 1, 2]) {
            const sg = lsrc(j).sigma;
            const pts = (from: number, to: number) => {
              const out: number[][] = [];
              for (let i = from; i <= to; i++) {
                // thin out the long tail (log x): about 200 points per curve
                if (i > 64 && i < to && i % Math.ceil(i / 64) !== 0) continue;
                out.push([X(i), Y(sg[i - 1], rg)]);
              }
              return out;
            };
            if (j !== sel) kids.push(poly(pts(1, sg.length), c.muted, 2.5, 0.55));
          }
          const sg = lsrc(sel).sigma, rr = this.rank();
          const all: number[][] = [];
          for (let i = 1; i <= sg.length; i++) if (i <= 64 || i === sg.length || i % Math.ceil(i / 64) === 0) all.push([X(i), Y(sg[i - 1], rg), i]);
          kids.push(poly(all.filter((q) => q[2] >= rr), c.muted, 5));
          kids.push(poly(all.filter((q) => q[2] <= rr), c.accent, 6));
          // tick labels on the y axis (powers of ten)
          // ticks at 1, 2, 5 × 10^e (plain decimals), at least 0.3 apart
          let last = -Infinity;
          for (let e = Math.floor(rg[0]); e <= Math.ceil(rg[1]); e++) {
            for (const m of [1, 2, 5]) {
              const v = m * 10 ** e, lg = Math.log10(v);
              if (lg < rg[0] || lg > rg[1]) continue;
              const y = Y(v, rg);
              if (y - last < 0.3) continue;
              last = y;
              kids.push(line([PLOT.x0 - 0.08, y], [PLOT.x0, y], c.muted, 2), at_right(txt(String(+v.toPrecision(1)), 24, c.muted), PLOT.x0 - 0.12, y));
            }
          }
          g.submobjects = kids;
        };
        upd_spectra(spectra);
        spectra.add_updater(upd_spectra);
        // names of the three curves, at a fixed index where they are apart
        const curve_names = VGroup();
        const upd_names = (g: any) => {
          const k = key();
          if (g._key === k) return;
          g._key = k;
          const rg = range(), names = [L('full FT', '全量'), L('rank 16', '秩 16'), L('random', '随机')], sel = Math.round(this.source.get_value());
          const items = [0, 1, 2].map((j) => {
            const sg = lsrc(j).sigma, i = j === 1 ? 16 : Math.round(sg.length * 0.55);
            const t = txt(names[j], 24, j === sel ? c.accent : c.muted);
            const y = Y(sg[i - 1], rg);
            return at_left(t, X(i) + 0.08, Math.min(PLOT.y1 - 0.1, y + 0.22));
          });
          // keep them apart vertically
          items.sort((a, b) => a.get_center()[1] - b.get_center()[1]);
          for (let q = 1; q < items.length; q++) {
            const a = items[q - 1], b = items[q];
            const ax = [a.get_center()[0] - a.width / 2, a.get_center()[0] + a.width / 2], bx = [b.get_center()[0] - b.width / 2, b.get_center()[0] + b.width / 2];
            const overlap_x = ax[0] < bx[1] && bx[0] < ax[1];
            const gap = b.get_center()[1] - a.get_center()[1];
            if (overlap_x && gap < 0.34) b.shift([0, 0.34 - gap, 0]);
          }
          g.submobjects = items;
        };
        upd_names(curve_names);
        curve_names.add_updater(upd_names);
        const axes = VGroup(line([PLOT.x0, PLOT.y0], [PLOT.x1, PLOT.y0], c.muted, 2), line([PLOT.x0, PLOT.y0], [PLOT.x0, PLOT.y1 + 0.1], c.muted, 2));
        const xticks = VGroup();
        const upd_xt = (g: any) => {
          const n = n_of();
          if (g._key === n) return;
          g._key = n;
          g.submobjects = [1, 10, 100, n].flatMap((i) => [line([X(i), PLOT.y0], [X(i), PLOT.y0 - 0.08], c.muted, 2), txt(String(i), 24, c.muted).move_to([X(i), PLOT.y0 - 0.3, 0])]);
        };
        upd_xt(xticks);
        xticks.add_updater(upd_xt);
        const x_title = txt(L('i  (singular value index, log scale)', 'i（奇异值的序号，对数刻度）'), 24, c.muted).move_to([(X(10) + X(100)) / 2 + 0.6, PLOT.y0 - 0.66, 0]);
        const y_title = at_left(txt(L('singular values σ (log scale)', '奇异值 σ（对数刻度）'), 24, c.muted), PLOT.x0 - 0.05, PLOT.y1 + 0.38);
        const spectrum = VGroup(axes, xticks, spectra, curve_names, x_title, y_title);
        spectrum.name = 'spectrum';
        // the cut at r: σᵢ left of it are kept
        const cut = VGroup();
        const upd_cut = (g: any) => {
          const k = `${n_of()}|${this.rank()}`;
          if (g._key === k) return;
          g._key = k;
          const x = X(this.rank());
          g.submobjects = [line([x, PLOT.y0], [x, PLOT.y1 + 0.05], c.gold, 4), Dot([x, PLOT.y1 + 0.05, 0], { radius: 0.13, color: c.gold })];
        };
        upd_cut(cut);
        cut.add_updater(upd_cut);
        cut.name = 'cut_line';
        (this as any).cut_x = (rr: number) => X(rr);
        (this as any).cut_y = PLOT.y1 + 0.05;

        // ---- panel: which matrix, which layer, the numbers
        const mk = (tracker: ValueTracker, labels: string[], y: number) => {
          const ch = new Choice({ tracker, labels, x0: PX, x1: PX1, y });
          this.controls.push(ch);
          return ch;
        };
        const src_c = mk(this.source, [L('full FT', '全量微调'), L('rank 16', '秩 16'), L('random', '随机')], 3.1);
        src_c.name = 'source_control';
        const src_cap = caption(L('ΔW of', 'ΔW 来自'), PX, 3.55);
        const prov = live_label(() => [
          L('Qwen2.5-0.5B → Instruct:|official post-training (incl. RL)', 'Qwen2.5-0.5B → Instruct：|官方后训练（含 RL）'),
          L('the same ΔW cut to rank 16:|what any r = 16 LoRA update is', '同一个 ΔW 截到秩 16：|r = 16 的 LoRA 改动就是这样'),
          L('random matrix, same shape|and norm (illustration)', '随机矩阵，形状和范数相同|（示意）'),
        ][clamp(Math.round(this.source.get_value()), 0, 2)].replace('|', '\n'), 24, c.muted, (t) => at_left(t, PX, 2.38), { max_width: PX1 - PX });
        prov.name = 'provenance';
        const layer_c = mk(this.layer, ['q_proj', 'down_proj'], 1.2);
        layer_c.name = 'layer_control';
        const layer_cap = live_label(() => {
          const s = this.src();
          return L(`layer: ${s.d} × ${s.k} (out × in)`, `层：${s.d} × ${s.k}（输出 × 输入）`);
        }, 24, c.muted, (t) => at_left(t, PX, 1.65), { max_width: PX1 - PX });
        const r_ro = live_label(() => L(`kept rank r = ${this.rank()}`, `保留的秩 r = ${this.rank()}`), 28, c.gold, (t) => at_left(t, PX, 0.45), { weight: 'BOLD' });
        r_ro.name = 'r_readout';
        // energy kept: a bar from 0 to 100% with the 90% mark
        const EB = { x0: PX, x1: PX1 - 0.05, y: -0.6, h: 0.3 };
        const e_cap = VGroup(txt(L('energy kept', '保留的能量'), 24, c.muted), tex('\\textstyle\\sum_{i\\le r}\\sigma_i^2 \\,/\\, \\sum_i \\sigma_i^2', 30, c.muted)).arrange(RIGHT, { buff: 0.25 });
        at_left(fit(e_cap, PX1 - PX), PX, -0.13);
        const e_bar = VGroup();
        const upd_ebar = (g: any) => {
          const e = this.energy(), k = e.toFixed(4);
          if (g._key === k) return;
          g._key = k;
          const xe = EB.x0 + (EB.x1 - EB.x0) * e, x9 = EB.x0 + (EB.x1 - EB.x0) * 0.9;
          g.submobjects = [
            rect(EB.x0, EB.y - EB.h / 2, EB.x1, EB.y + EB.h / 2, c.faint, 1),
            rect(EB.x0, EB.y - EB.h / 2, Math.max(EB.x0 + 0.01, xe), EB.y + EB.h / 2, c.accent, 0.85),
            line([x9, EB.y - EB.h / 2 - 0.08], [x9, EB.y + EB.h / 2 + 0.08], c.ink, 2.5),
          ];
        };
        upd_ebar(e_bar);
        e_bar.add_updater(upd_ebar);
        const e_val = live_label(() => `${(100 * this.energy()).toFixed(1)}%`, 28, c.accent, (t) => at_left(t, EB.x0, EB.y - 0.48), { weight: 'BOLD' });
        const e_90 = txt('90%', 24, c.ink).move_to([EB.x0 + (EB.x1 - EB.x0) * 0.9, EB.y - 0.42, 0]);
        const energy_bar = VGroup(e_bar, e_val, e_90, e_cap);
        energy_bar.name = 'energy_bar';
        const err = live_label(() => L(`relative error ‖E‖ / ‖ΔW‖ = ${this.rel_error().toFixed(2)}`, `相对误差 ‖E‖ / ‖ΔW‖ = ${this.rel_error().toFixed(2)}`), 26, c.ink, (t) => at_left(t, PX, -1.62), { max_width: PX1 - PX });
        err.name = 'error_readout';
        const prm = VGroup(
          live_label(() => L(`LoRA params r(d + k) = ${num(this.params().lora)}`, `LoRA 参数 r(d + k) = ${num(this.params().lora)}`), 24, c.ink, (t) => at_left(t, PX, -2.62), { max_width: PX1 - PX }),
          live_label(() => {
            const q = this.params();
            return L(`full layer dk = ${num(q.full)} · ${(100 * q.ratio).toFixed(2)}%`, `整层 dk = ${num(q.full)} · ${(100 * q.ratio).toFixed(2)}%`);
          }, 24, c.ink, (t) => at_left(t, PX, -3.05), { max_width: PX1 - PX }),
        );
        prm.name = 'params_readout';
        const note = aside(this, txt(L('energy and error: whole matrix', '能量和误差按整个矩阵计算'), 24, c.muted));
        at_left(fit(note, PX1 - PX), PX, -2.05);

        // ---- the story
        this.play(FadeIn(h_dw), FadeIn(frames[0]), FadeIn(t_dw), FadeIn(src_c), FadeIn(src_cap), FadeIn(prov), { run_time: 1.4 });
        this.play(Create(axes), FadeIn(xticks), FadeIn(spectra), FadeIn(curve_names), FadeIn(x_title), FadeIn(y_title), FadeIn(layer_c), FadeIn(layer_cap), { run_time: 1.5 });
        this.add(heat);
        this.play(FadeIn(cut), FadeIn(h_r), FadeIn(h_res), FadeIn(frames[1]), FadeIn(frames[2]), Write(eq), Write(plus), FadeIn(t_r), FadeIn(t_res), FadeIn(colour_scale), { run_time: 1.3 });
        this.play(FadeIn(r_ro), FadeIn(energy_bar), FadeIn(err), FadeIn(prm), FadeIn(note), { run_time: 1 });
        // keep more and more singular values: the residual fades, the energy climbs
        this.play(r.animate.set_value(R_MAX), { run_time: 6, rate_func: linear });
        this.play(r.animate.set_value(p.r), { run_time: 1.5, rate_func: smooth });
        this.add(Group(h_dw, h_r, h_res), heat, spectrum, cut, VGroup(...this.controls), r_ro, energy_bar, err, prm);
        this.wait(1.5);
      }
    }
    return new LowrankUpdate();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const u = ui as unknown as UiLike;
    ui.add_handle({
      tracker: scene.r,
      from_value: (v: number): P3 => [scene.cut_x(clamp(Math.round(v), 1, R_MAX)), scene.cut_y, 0],
      to_value: (pt: P3) => {
        // nearest integer r to the pointer on the log axis
        let best = 1, bd = Infinity;
        for (let k = 1; k <= R_MAX; k++) {
          const d = Math.abs(scene.cut_x(k) - pt[0]);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        return best;
      },
      constraint: (pt: P3): P3 => [clamp(pt[0], scene.cut_x(1), scene.cut_x(R_MAX)), scene.cut_y, 0],
      step: 1,
      radius: 0.4,
      label: L('the cut at rank r: singular values left of it are kept', '秩 r 的截断线：左边的奇异值保留'),
      on_end: () => emit(scene, 'r', { value: scene.rank() }),
    });
    const [src, layer] = scene.controls as Choice[];
    src.attach(u, L('which ΔW: official post-training, its rank-16 cut, or random', '哪个 ΔW：官方后训练、它的秩 16 截断，或随机矩阵'), (v) => emit(scene, 'source', { value: v }));
    layer.attach(u, L('the layer: q_proj or down_proj', '哪一层：q_proj 或 down_proj'), (v) => emit(scene, 'layer', { value: v }));
  },
});
