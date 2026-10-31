// M5's world: be the active-set solver. The plan plane of M4 at one sample of
// the two-move MPC's own closed loop; the learner chooses the working set W,
// the limits held with equality (tap a chip in the table, or Tab + Enter).
// The candidate plan z_W is the cheapest plan on all held lines (one small
// linear system, KKT with W as equalities). The table shows, per limit, its
// multiplier λ if it is held (how hard it pushes the plan back; negative =
// it is pulling, so let it go) or whether z_W keeps or breaks it if it is not.
// W is optimal when z_W keeps every limit and every λ ≥ 0: then the dot fills.
// "Next sample" (a world action) moves the cart one sample along the closed
// loop and KEEPS W, which is what a warm-started active-set solver does.
import { Circle, FadeIn, RoundedRectangle, Scene, VGroup, VMobject, ValueTracker } from 'manim-web';
import type { Mobject } from 'manim-web';
import type { AffordanceCtx, InteractiveItem } from 'manim-web/ext/interact';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { PlanPlane, family_color, live_tex, type QpView } from './qp_plane';
import { ROWS, feasible_polygon, ids_of, radius, slack_of, unconstrained, working_set_point } from './qp2d';
import { active_set_path, changes_of, loop_states } from './solvers2d';
import { LANG_SPEC, emit, listen, live_label, live_vm, pick, polys_points, resolve_lang, tex, visible_when, words, type Listener, type P3, type XY } from './kit';
import { row_segment } from './qp2d';
import { aside } from '../aside';

export interface ActiveSetParams extends Record<string, unknown> {
  start: number;
  W: string;
  lang: string;
}

/** The closed-loop states the world steps through (samples 0..40). */
const STATES = loop_states(41);
const TOL = 1.0000613e-7; // (the odd last digits are on purpose: docs/FINGERPRINTS.md)

/** What the table and the plane show for a working set at a state (pure). */
export interface WsView {
  x0: [number, number];
  W: number[];
  /** null when W has no unique point (parallel rows). */
  z: [number, number] | null;
  /** λ per row (NaN when not held). */
  lambda: number[];
  /** Per row: true when z_W breaks it (only for rows not held). */
  broken: boolean[];
  optimal: boolean;
}
export function ws_view(x0: [number, number], W: number[]): WsView {
  const s = working_set_point(x0, W);
  const lambda = ROWS.map(() => NaN), broken = ROWS.map(() => false);
  if (!s) return { x0, W, z: null, lambda, broken, optimal: false };
  W.forEach((i, k) => (lambda[i] = s.lambda[k]));
  ROWS.forEach((_, i) => (broken[i] = !W.includes(i) && slack_of(i, s.z, x0) > TOL));
  const optimal = !broken.some((b) => b) && W.every((i) => lambda[i] >= -TOL);
  return { x0, W, z: [s.z[0], s.z[1]], lambda, broken, optimal };
}
/** Working-set changes a cold-started solver needs at sample k (from W = ∅). */
export const cold_changes = (k: number): number => changes_of(active_set_path(STATES[k]));
/** The optimal working set at sample k (sorted row indices). */
export const optimal_W = (k: number): number[] => active_set_path(STATES[k]).at(-1)!.W.slice().sort((a, b) => a - b);
export const state_at = (k: number): [number, number] => STATES[k];

const mask_of = (W: number[]) => W.reduce((m, i) => m | (1 << i), 0);
const W_of = (mask: number) => ROWS.map((_, i) => i).filter((i) => (Math.round(mask) >> i) & 1);

// table geometry (right panel)
const TX = 0.4, CHIP_W = 2.55, CHIP_H = 0.4, ROW_Y0 = 2.45, ROW_DY = 0.47;
const row_y = (i: number) => ROW_Y0 - i * ROW_DY;

export const mpc_active_set = define_visual<ActiveSetParams>({
  name: 'mpc_active_set',
  summary: "Be the active-set solver on M4's two-move cart QP, sample by sample along the MPC's own closed loop: choose which limits are held with equality (the working set W, chips in a table); the candidate plan z_W is the cheapest plan on all held lines; the table shows each held limit's multiplier λ (negative: it pulls, let it go) and whether z_W keeps or breaks each other limit. Optimal when nothing is broken and every λ ≥ 0. 'Next sample' moves one sample on and keeps W (warm start); counters compare the changes made with a from-scratch solve. Exact arithmetic on the toy cart.",
  topics: ['mpc', 'quadratic program', 'active set', 'kkt', 'lagrange multiplier', 'warm start', 'solver', 'control'],
  params: {
    start: { type: 'integer', min: 0, max: 35, default: 18, doc: 'the sample of the closed loop from (4 m, 0) the world starts at (18: optimal W = {v(1 s) ≤ 2, v(2 s) ≤ 2}; 22 drops one, 23 adds the wall)' },
    W: { type: 'text', max_length: 40, default: '', doc: "initial working set, row ids separated by commas (e.g. 'v1+,v2+'); '' = nothing held" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { start: 22, W: 'v1+,v2+' }, { start: 22, W: 'v1+,v2+', lang: 'zh' }, { start: 23, W: 'v1+,p2' }, { start: 18, W: 'a1+' }],
  ids: ['plane', 'candidate', 'broken_lines', 'table', 'chips', 'status', 'header', 'counters', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const W0 = String(p.W).split(',').map((s) => s.trim()).filter(Boolean).map((id) => ROWS.findIndex((r) => r.id === id)).filter((i) => i >= 0).slice(0, 2);
    class ActiveSet extends Scene {
      k = ValueTracker(p.start);
      mask = ValueTracker(mask_of(W0));
      /** Changes at this sample, changes since the start sample, and what cold starts would have needed since. */
      changes = ValueTracker(0);
      warm = ValueTracker(0);
      cold = ValueTracker(0);
      start = p.start;
      private cache = new Map<string, WsView>();
      listen(f: Listener): void {
        listen(this, f);
      }
      sample(): number {
        return Math.round(this.k.get_value());
      }
      W(): number[] {
        return W_of(this.mask.get_value());
      }
      view(): WsView {
        const key = `${this.sample()}|${Math.round(this.mask.get_value())}`;
        let v = this.cache.get(key);
        if (!v) {
          v = ws_view(STATES[this.sample()], this.W());
          if (this.cache.size > 300) this.cache.clear();
          this.cache.set(key, v);
        }
        return v;
      }
      optimal(): boolean {
        return this.view().optimal;
      }
      /** Hold row i, or let it go (refused when two are held already: in 2D two lines fix a point). */
      toggle(i: number): void {
        const before = this.view(), W = this.W();
        const held = W.includes(i);
        if (!held && W.length >= 2) {
          emit(this, 'third', { row: ROWS[i].id });
          return;
        }
        const nW = held ? W.filter((j) => j !== i) : [...W, i].sort((a, b) => a - b);
        // two parallel rows have no common point: refused too
        if (!held && nW.length === 2 && !working_set_point(STATES[this.sample()], nW)) {
          emit(this, 'parallel', { row: ROWS[i].id });
          return;
        }
        this.mask.set_value(mask_of(nW));
        this.changes.set_value(this.changes.get_value() + 1);
        if (this.sample() > this.start) this.warm.set_value(this.warm.get_value() + 1);
        const after = this.view();
        emit(this, 'toggle', {
          row: ROWS[i].id, held: !held, k: this.sample(),
          was_broken: before.broken[i], lambda: held ? before.lambda[i] : NaN,
          optimal: after.optimal, warm: this.warm.get_value(),
        });
      }
      /** One sample on along the closed loop, keeping W (only from an optimal W). */
      next_sample(): boolean {
        if (!this.optimal()) {
          emit(this, 'next_blocked', { k: this.sample() });
          return false;
        }
        if (this.sample() >= STATES.length - 1) return false;
        this.k.set_value(this.sample() + 1);
        this.changes.set_value(0);
        this.cold.set_value(this.cold.get_value() + cold_changes(this.sample()));
        emit(this, 'next', { k: this.sample(), optimal: this.optimal(), warm: this.warm.get_value() });
        return true;
      }
      /** Back to the start sample with nothing held. */
      restart(): void {
        this.k.set_value(this.start);
        this.mask.set_value(mask_of(W0));
        this.changes.set_value(0);
        this.warm.set_value(0);
        this.cold.set_value(0);
        emit(this, 'restart', {});
      }
      override construct() {
        const c = palette();
        const { k, mask, changes, warm, cold } = this;
        [k, mask, changes, warm, cold].forEach((t, i) => (t.name = ['sample', 'working_set', 'changes', 'warm_changes', 'cold_changes'][i]));
        this.track(k, mask, changes, warm, cold);
        const vkey = () => `${this.sample()}|${Math.round(mask.get_value())}`;
        // the plane, fed with the working set's candidate instead of the optimum
        const qv = (): QpView => {
          const v = this.view(), x0 = v.x0;
          const z = v.z ?? unconstrained(x0);
          return {
            x0, plan: { status: 'optimal', z, lambda: ROWS.map(() => 0), active: v.W }, ids: ids_of(v.W),
            center: unconstrained(x0) as [number, number], clip: [0, 0], poly: feasible_polygon(x0, -2, 2),
            r: v.z ? radius(z, x0) : 0, wall: false, speed: false, feasible: true, flip: false, J_best: NaN, J_clip: NaN,
          };
        };
        const pbox = { x0: -6.15, x1: -1.05, y0: -2.75, y1: 2.35 };
        const plane = new PlanPlane(pbox, qv, { clip: () => false, lang });
        plane.group.name = 'plane';
        const P = plane.parts;
        const S = (q: readonly number[]): XY => [plane.plot.X(q[0]), plane.plot.Y(q[1])];
        // broken limits: a wide coral glow under their lines
        const broken_lines = live_vm(VMobject({ stroke_color: c.coral, stroke_width: 14, stroke_opacity: 0.28, fill_opacity: 0 }), () => {
          const v = this.view();
          const segs: XY[][] = [];
          v.broken.forEach((b, i) => {
            if (!b) return;
            const s = row_segment(i, v.x0, -2, 2);
            if (s) segs.push([S(s[0]), S(s[1])]);
          });
          return polys_points(segs);
        }, vkey);
        broken_lines.name = 'broken_lines';
        // the candidate z_W: a ring, filled when optimal
        const cand: any = Circle({ radius: 0.13, fill_color: c.accent, fill_opacity: 0, stroke_color: c.accent, stroke_width: 4 });
        const place_cand = (m: any) => {
          const key = vkey();
          if (m._key === key) return;
          m._key = key;
          const v = this.view();
          if (!v.z) {
            m.set_opacity(0);
            return;
          }
          const inside = Math.abs(v.z[0]) <= 2 && Math.abs(v.z[1]) <= 2;
          m.set_stroke({ opacity: inside ? 1 : 0 });
          m.set_fill({ opacity: inside && v.optimal ? 1 : 0 });
          m.move_to([...S([Math.max(-2, Math.min(2, v.z[0])), Math.max(-2, Math.min(2, v.z[1]))]), 0]);
        };
        place_cand(cand);
        cand.add_updater(place_cand);
        cand.name = 'candidate';
        const cand_word = live_tex(() => (this.view().z ? 'z_W' : ''), 26, c.accent, (m) => {
          const v = this.view();
          if (!v.z) return;
          const q = S([Math.max(-2, Math.min(2, v.z[0])), Math.max(-2, Math.min(2, v.z[1]))]);
          m.move_to([Math.min(q[0] + 0.38, pbox.x1 - 0.2), q[1] + 0.3, 0]);
        });
        // header: which sample, which state
        const header = live_tex(() => {
          const v = this.view();
          return `k = ${this.sample()}:\\;\\; p_0 = ${v.x0[0].toFixed(2)}\\,\\mathrm{m},\\;\\; v_0 = ${v.x0[1].toFixed(2)}\\,\\mathrm{m/s}`;
        }, 26, c.ink, (m) => m.move_to([pbox.x0 + m.width / 2, 3.1, 0]));
        header.name = 'header';
        const plane_key = words(L('×: no limits   thick: held (W)   glow: broken by z_W', '×：不管限制   粗线：守住的（W）   光晕：被 z_W 打破'), 20, c.muted, pbox.x0, -3.72, { max_w: 6.1 });

        // ---- right: the table
        const head_l = words(L('limit (tap: hold / let go)', '限制（点：守住/放掉）'), 20, c.muted, TX, 3.1, { max_w: CHIP_W });
        const head_r = words(L('held: λ   not held: kept or broken', '守住的看 λ，其余看是否被打破'), 20, c.muted, TX + CHIP_W + 0.25, 3.1, { max_w: 3.7 });
        const chips: Mobject[] = [];
        const status_cells: Mobject[] = [];
        ROWS.forEach((r, i) => {
          const y = row_y(i), col = family_color(r.family);
          const box: any = RoundedRectangle({ width: CHIP_W, height: CHIP_H, corner_radius: 0.12, fill_color: col, fill_opacity: 0, stroke_color: col, stroke_width: 2 });
          box.move_to([TX + CHIP_W / 2, y, 0]);
          const t = tex(r.tex, 24, col);
          if (t.width > CHIP_W - 0.2) t.scale((CHIP_W - 0.2) / t.width);
          t.move_to([TX + CHIP_W / 2, y, 0]);
          const upd = (m: any) => {
            const on = this.W().includes(i), key = String(on);
            if (m._key === key) return;
            m._key = key;
            box.set_fill({ opacity: on ? 0.16 : 0 });
            box.set_stroke({ width: on ? 5 : 2 });
          };
          const g = VGroup(box, t);
          upd(g);
          g.add_updater(upd);
          chips.push(g);
          const cell = live_label(() => {
            const v = this.view();
            if (v.W.includes(i)) return Number.isFinite(v.lambda[i]) ? `λ = ${v.lambda[i].toFixed(2)}${v.lambda[i] < -TOL ? L('  pulls', '  在拉') : ''}` : '';
            if (!v.z) return '';
            return v.broken[i] ? L('broken', '被打破') : L('kept', '守住了');
          }, 22, () => {
            const v = this.view();
            if (v.W.includes(i)) return v.lambda[i] < -TOL ? c.coral : c.good;
            return v.broken[i] ? c.coral : c.muted;
          }, (m) => m.move_to([TX + CHIP_W + 0.25 + m.width / 2, y, 0]));
          status_cells.push(cell);
        });
        const chip_group = VGroup(...chips);
        chip_group.name = 'chips';
        const table = VGroup(head_l, head_r, ...status_cells);
        table.name = 'table';
        // status and counters
        const status = live_label(() => {
          const v = this.view();
          if (!v.z) return L('these two lines never meet', '这两条线不相交');
          if (v.optimal) return L('optimal: nothing broken, no λ below 0', '最优：没有被打破的限制，也没有负的 λ');
          const nb = v.broken.filter(Boolean).length, nn = v.W.filter((i) => v.lambda[i] < -TOL).length;
          const parts: string[] = [];
          if (nb) parts.push(L(`${nb} broken`, `${nb} 条被打破`));
          if (nn) parts.push(L(`${nn} pulling (λ below 0)`, `${nn} 条在拉（λ 为负）`));
          return L('not optimal: ', '还不是最优：') + parts.join(L(', ', '，'));
        }, 22, () => (this.view().optimal ? c.good : c.coral), (m) => m.move_to([TX + m.width / 2, -2.38, 0]), { max_width: 6.5 });
        status.name = 'status';
        const counters = live_label(() => {
          const n = Math.round(changes.get_value()), w = Math.round(warm.get_value()), cc = Math.round(cold.get_value());
          const here = L(`changes at this sample: ${n}`, `本采样改动：${n} 次`);
          if (this.sample() === this.start) return here;
          return here + L(`   since sample ${this.start}: ${w} (from scratch: ${cc})`, `   自第 ${this.start} 个采样起：${w} 次（每次从零开始：${cc} 次）`);
        }, 20, c.ink, (m) => m.move_to([TX + m.width / 2, -2.92, 0]), { max_width: 6.5 });
        counters.name = 'counters';
        const note = aside(this, words(L('toy two-move cart QP, exact', '玩具小车的两步 QP，精确计算'), 20, c.muted, TX, -3.72, { max_w: 6.5 }));
        note.name = 'note';

        this.add(P.poly, P.contours, P.best_contour, broken_lines, P.limit_lines, P.center, cand);
        [header, cand_word, status, counters, ...status_cells].forEach((m) => m.update(0));
        this.play(FadeIn(plane.group), FadeIn(header), FadeIn(cand_word), FadeIn(plane_key), FadeIn(chip_group), FadeIn(table), FadeIn(status), FadeIn(counters), FadeIn(note), { run_time: 1 });
        this.wait(0.4);
      }
    }
    return new ActiveSet();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    ROWS.forEach((r, i) => {
      const y = row_y(i), cx = TX + CHIP_W / 2;
      const name = pick(lang, `limit ${r.id}`, `限制 ${r.id}`);
      const item: InteractiveItem = {
        kind: 'chip',
        label: name,
        priority: 2,
        hit: (pt: P3 | number[], tol: number) => (Math.abs(pt[0] - cx) <= CHIP_W / 2 + tol && Math.abs(pt[1] - y) <= CHIP_H / 2 + tol ? 0 : null),
        cursor: () => 'pointer',
        down: () => {
          scene.toggle(i);
          ui.notify();
          return false;
        },
        key: (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return false;
          scene.toggle(i);
          ui.notify();
          return true;
        },
        describe: () => {
          const held = scene.W().includes(i);
          return pick(lang, `${r.id}: ${held ? 'held' : 'not held'}. Enter toggles.`, `${r.id}：${held ? '守住' : '未守住'}。按 Enter 切换。`);
        },
        anchor: () => [cx, y, 0],
        coach_path: () => ({ points: [[cx + 1.2, y - 0.8, 0], [cx, y, 0], [cx, y, 0]], ms: 1600 }),
        draw_affordance(x: AffordanceCtx) {
          if (this.focused || (x.fresh && x.lead)) {
            const [px, py] = x.px([cx, y, 0]);
            x.halo(px, py, (CHIP_H / 2) * x.ppu + 6, { pulse: x.fresh && !x.reduced_motion, focused: this.focused });
          }
        },
      };
      // the visuals checker's stand-in Interaction has no item registry
      (ui as any).add_item?.(item);
    });
  },
});
