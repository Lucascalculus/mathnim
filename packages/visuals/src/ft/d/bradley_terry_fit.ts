// Fitting Bradley–Terry rewards to a small league of pairwise comparisons
// (D1). Four responses A–D; A is pinned at 0 (only differences matter). Each
// matchup row compares the observed win rate (gold tick) with the predicted
// σ(r_i − r_j) (blue dot). Dragging a bar changes every row it appears in;
// "fit" runs gradient ascent on the log-likelihood. D has only beaten C
// (3:0), so its reward climbs without bound - until the data contains one
// loss for D. Exact computation on toy data.
import { Create, Dot, FadeIn, RoundedRectangle, Scene, VGroup, ValueTracker, always_redraw, linear, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { tex } from '../../linalg/kit';
import { BT_TOY, bt_loglik, bt_prob, sigmoid, type Matchup } from './math';
import { LANG_SPEC, clamp, label, label_at, live_number, pick, rect, resolve_lang, seg, type Lang, type P3 } from './kit';

export interface BradleyTerryFitParams extends Record<string, unknown> {
  story: string;
  lang: string;
}

const ITEMS = ['A', 'B', 'C', 'D'];
// bars: spaced so that the handle rings (and the hint pill of the cued one) stay apart at a 700 px canvas;
// the reward scale uses the panel's full height
const BX = [-6.05, -4.6, -3.15, -1.7];
const R_LO = -2.5, R_HI = 5.5;
const BY0 = -2.85, BY1 = 1.9;
/** The rewards a world starts from: a first guess (A is pinned at 0), so the bars are visible and wrong. */
export const BT_START = [0, 2.5, 1.5, 0.5];
const Yr = (r: number) => BY0 + ((clamp(r, R_LO, R_HI) - R_LO) / (R_HI - R_LO)) * (BY1 - BY0);
const RofY = (y: number) => R_LO + ((y - BY0) / (BY1 - BY0)) * (R_HI - R_LO);
// matchup rows
const TX0 = 1.75, TX1 = 5.05;
const Px = (p: number) => TX0 + p * (TX1 - TX0);
const ROW_Y = [2.6, 1.9, 1.2, 0.5];
/** The extra comparisons that can be added to the data: [winner, loser]. */
export const BT_CARDS: [number, number][] = [[2, 3], [3, 2], [0, 2]];
// tray, left to right: A ≻ C, D ≻ C, C ≻ D (the card that gives D a loss is not first)
const CARD_X = [4.5, 2.9, 1.3], CARD_Y = -2.45;
/** Where a card sits once it is in the data. */
const ADDED_Y = -1.0;

/** The league: base matchups plus the cards in the data (flags per card). */
export function league(cards: readonly number[]): Matchup[] {
  const g: Matchup[] = BT_TOY.map((m) => [...m] as Matchup);
  BT_CARDS.forEach(([w, l], k) => {
    if (!cards[k]) return;
    const row = g.find((m) => (m[0] === w && m[1] === l) || (m[0] === l && m[1] === w))!;
    if (row[0] === w) row[2] += 1;
    else row[3] += 1;
  });
  return g;
}
/** n steps of gradient ascent (lr 0.05, A pinned) from rewards r; returns every state. */
export function fit_from(r0: readonly number[], games: readonly Matchup[], n: number, lr = 0.05): number[][] {
  const r = [...r0];
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    const g = [0, 0, 0, 0];
    for (const [i, j, w, l] of games) {
      const d = r[i] - r[j];
      const gi = w * sigmoid(-d) - l * sigmoid(d);
      g[i] += gi;
      g[j] -= gi;
    }
    for (let k = 1; k < 4; k++) r[k] += lr * g[k];
    out.push([...r]);
  }
  return out;
}

export const bradley_terry_fit = define_visual<BradleyTerryFitParams>({
  name: 'bradley_terry_fit',
  summary: 'Bradley–Terry rewards fitted to a toy league of comparisons (A pinned at 0): each matchup shows the observed win rate and the predicted σ(r_i − r_j); dragging one reward moves every row it is in; fitting sends the reward of an undefeated response (D, 3:0 against C) up forever, until one loss is added. Drag the bars, drag comparison cards into the data.',
  topics: ['bradley-terry', 'reward model', 'preference', 'pairwise comparison', 'maximum likelihood', 'rlhf', 'fine-tuning'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full' plays the whole explanation (fit, runaway, one loss); 'setup' only builds the league at zero rewards (for a world)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', lang: 'zh' }],
  ids: ['formula', 'bars', 'rows', 'loglik', 'cards', 'steps', 'toy_label'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class BradleyTerryFit extends Scene {
      r = BT_START.map((v) => ValueTracker(v));
      steps = ValueTracker(0);
      /** Card k is in the data (1) or not (0). */
      cards = [ValueTracker(0), ValueTracker(0), ValueTracker(0)];
      card_mobs: any[] = [];
      lang: Lang = lang;
      /** Rewards still to show, one per frame (a running fit). */
      queue: number[][] = [];
      /** Make the comparison cards draggable into the data (a world calls this; see attach_bt_cards). */
      attach_cards(ui: any): void {
        attach_bt_cards(this, ui);
      }
      /** Set by a lesson to hear what happens ('fit', 'data'). */
      emit: (type: string, data?: Record<string, unknown>) => void = () => {};
      rewards(): number[] {
        return this.r.map((t) => t.get_value());
      }
      set_rewards(v: readonly number[]): void {
        v.forEach((x, k) => k > 0 && this.r[k].set_value(x));
      }
      games(): Matchup[] {
        return league(this.cards.map((t) => (t.get_value() > 0.5 ? 1 : 0)));
      }
      loglik(): number {
        return bt_loglik(this.rewards(), this.games());
      }
      /** Largest gap between a predicted and an observed win rate among the first three rows. */
      abc_error(): number {
        const r = this.rewards();
        return Math.max(...this.games().slice(0, 3).map(([i, j, w, l]) => Math.abs(bt_prob(r, i, j) - w / (w + l))));
      }
      /** Does D have a loss in the data? */
      d_lost(): boolean {
        return this.games()[3][3] > 0;
      }
      /** Run n fit steps from the current rewards (animated over about a second, or at once). */
      fit(n: number, instant = false): number[] {
        const start = this.queue.length ? this.queue[this.queue.length - 1] : this.rewards();
        const states = fit_from(start, this.games(), n);
        const last = states[states.length - 1];
        if (instant) {
          this.queue = [];
          this.set_rewards(last);
        } else {
          const k = Math.max(1, Math.floor(states.length / 50));
          for (let i = k - 1; i < states.length; i += k) this.queue.push(states[i]);
          if (this.queue[this.queue.length - 1] !== last) this.queue.push(last);
        }
        this.steps.set_value(this.steps.get_value() + n);
        return last;
      }
      override construct() {
        const c = palette();
        const COL = [c.accent, c.teal, c.purple, c.gold];
        this.r.forEach((t, k) => (t.name = `r_${ITEMS[k]}`));
        this.steps.name = 'steps';
        this.track(...this.r, this.steps, ...this.cards);
        // a running fit advances one state per frame
        this.add_updater(() => {
          const s = this.queue.shift();
          if (s) this.set_rewards(s);
        });

        // ---- left: rewards as bars
        const formula = tex('P(i \\succ j) = \\sigma(r_i - r_j)', 32, c.ink).move_to([-4.1, 3.45, 0]);
        formula.name = 'formula';
        const note = label(pick(lang, 'A is pinned at 0: only differences count', 'A 固定为 0：只有差值有意义'), 22, c.muted);
        note.move_to([-6.5 + note.width / 2, 2.9, 0]); // left-aligned: clear of D's value when D runs away
        const base = seg([-6.5, Yr(0)], [-1.25, Yr(0)], c.muted, 2);
        const zero = tex('0', 24, c.muted).move_to([-6.75, Yr(0), 0]);
        const bars = VGroup(...ITEMS.map((_, k) => always_redraw(() => {
          const r = this.r[k].get_value();
          const top = Yr(r);
          const b = rect(BX[k] - 0.3, Yr(0), BX[k] + 0.3, top, COL[k], k === 0 ? 0.35 : 0.8);
          const cap = seg([BX[k] - 0.34, top], [BX[k] + 0.34, top], COL[k], 6);
          const g = VGroup(b, cap);
          if (r > R_HI) g.add(tex('\\uparrow', 30, COL[k]).move_to([BX[k], top + 0.25, 0]));
          return g;
        })));
        bars.name = 'bars';
        const names = VGroup(...ITEMS.map((n, k) => tex(n, 34, COL[k]).move_to([BX[k], -3.62, 0])));
        const values = VGroup(...ITEMS.map((_, k) => {
          const v = live_number(() => this.r[k].get_value(), { decimals: 2, size: 24, color: c.ink });
          v.add_updater((m: any) => {
            const r = this.r[k].get_value();
            const y = r >= 0 ? Yr(r) + 0.28 + (r > R_HI ? 0.37 : 0) : Yr(r) - 0.28;
            m.move_to([BX[k], Math.min(y, 2.55), 0]); // below the note at 2.9
          });
          return v;
        }));

        // ---- right: the data, one row per matchup
        const toy = label(pick(lang, 'toy data', '玩具数据'), 22, c.muted);
        toy.move_to([6.85 - toy.width / 2, 3.45, 0]);
        toy.name = 'toy_label';
        const head = label(pick(lang, 'matchup', '对局'), 24, c.muted);
        head.move_to([-0.45 + head.width / 2, 3.45, 0]);
        const ll_cap = tex('\\log L =', 28, c.ink);
        ll_cap.move_to([1.75 + ll_cap.width / 2, 3.45, 0]);
        const ll = live_number(() => this.loglik(), { decimals: 2, size: 28 });
        ll.add_updater((m: any) => m.move_to([ll_cap.get_right()[0] + 0.12 + m.width / 2, 3.45, 0]));
        const loglik = VGroup(ll_cap, ll);
        loglik.name = 'loglik';
        const rows = VGroup(...ROW_Y.map((y, k) => {
          const name = always_redraw(() => {
            const [i, j, w, l] = this.games()[k];
            const t = tex(`${ITEMS[i]}\\text{:}${ITEMS[j]}\\;\\;${w}{:}${l}`, 28, c.ink);
            t.move_to([-0.45 + t.width / 2, y, 0]);
            return t;
          });
          const track = seg([TX0, y], [TX1, y], c.faint, 6);
          const ends = VGroup(seg([TX0, y - 0.12], [TX0, y + 0.12], c.muted, 2), seg([TX1, y - 0.12], [TX1, y + 0.12], c.muted, 2));
          const marks = always_redraw(() => {
            const [i, j, w, l] = this.games()[k];
            const r = this.rewards();
            const obs = w / (w + l), pred = bt_prob(r, i, j);
            const ok = Math.abs(pred - obs) < 0.03;
            const gap = seg([Px(obs), y], [Px(pred), y], ok ? c.good : c.coral, 4, 0.8);
            const tick = seg([Px(obs), y - 0.2], [Px(obs), y + 0.2], c.gold, 6);
            const dot = Dot([Px(pred), y, 0], { radius: 0.11, color: c.accent });
            return VGroup(gap, tick, dot);
          });
          const pred = live_number(() => {
            const [i, j] = this.games()[k];
            return bt_prob(this.rewards(), i, j);
          }, { decimals: 2, size: 24, color: c.accent });
          pred.move_to([5.45 + pred.width / 2, y, 0]);
          return VGroup(name, track, ends, marks, pred);
        }));
        rows.name = 'rows';
        const scale = VGroup(tex('0', 24, c.muted).move_to([TX0, 0.12, 0]), tex('1', 24, c.muted).move_to([TX1, 0.12, 0]));
        const lp = label(pick(lang, 'predicted', '预测'), 22, c.ink), lo = label(pick(lang, 'observed', '观测'), 22, c.ink);
        const lw = 0.3 + lp.width + 0.45 + 0.2 + lo.width, lx = (TX0 + TX1) / 2 - lw / 2;
        lp.move_to([lx + 0.3 + lp.width / 2, -0.4, 0]);
        lo.move_to([lx + 0.3 + lp.width + 0.65 + lo.width / 2, -0.4, 0]);
        const legend = VGroup(
          Dot([lx + 0.1, -0.4, 0], { radius: 0.1, color: c.accent }), lp,
          seg([lx + 0.3 + lp.width + 0.45, -0.57], [lx + 0.3 + lp.width + 0.45, -0.23], c.gold, 6), lo,
        );
        const added = label_at(pick(lang, 'added', '新增'), -0.45, ADDED_Y, 22, c.muted);
        // the cards: extra comparisons to drop into the data
        const tray_cap = label(pick(lang, 'more data: drag a card up into the table', '更多数据：把卡片拖进上面的表'), 22, c.muted);
        tray_cap.move_to([-0.45 + tray_cap.width / 2, -1.75, 0]);
        this.card_mobs = BT_CARDS.map(([w, l], k) => {
          const box = RoundedRectangle({ width: 1.45, height: 0.62, corner_radius: 0.12, stroke_color: c.muted, stroke_width: 2, fill_color: c.bg, fill_opacity: 1 });
          const t = tex(`${ITEMS[w]} \\succ ${ITEMS[l]}`, 30, c.ink);
          const g = VGroup(box, t).move_to([CARD_X[k], CARD_Y, 0]);
          g.name = `card_${ITEMS[w]}${ITEMS[l]}`;
          return g;
        });
        const cards = VGroup(...this.card_mobs);
        cards.name = 'cards';
        const steps_cap = label_at(pick(lang, 'fit steps', '拟合步数'), -0.45, -3.45, 24, c.ink);
        const steps_num = live_number(() => this.steps.get_value(), { decimals: 0, size: 26 });
        steps_num.add_updater((m: any) => m.move_to([steps_cap.get_right()[0] + 0.18 + m.width / 2, -3.45, 0]));
        const steps = VGroup(steps_cap, steps_num);
        steps.name = 'steps';

        // ---- the story
        this.play(FadeIn(formula), FadeIn(note), Create(base), FadeIn(zero), FadeIn(names), { run_time: 1 });
        this.play(FadeIn(head), FadeIn(toy), FadeIn(loglik), FadeIn(rows), FadeIn(scale), FadeIn(legend), FadeIn(added), { run_time: 1 });
        this.add(bars, values);
        this.play(FadeIn(tray_cap), FadeIn(cards), FadeIn(steps), { run_time: 0.8 });
        if (p.story === 'full') {
          // fit B and C by hand: the dots slide onto the ticks
          this.wait(0.6);
          this.play(this.r[1].animate.set_value(-0.89), this.r[2].animate.set_value(-1.33), { run_time: 2.5, rate_func: smooth });
          this.wait(0.8);
          // gradient ascent: D runs away (1, 10, 100, 1000, 10 000 steps)
          const traj = fit_from([0, -0.89, -1.33, BT_START[3]], BT_TOY, 10000);
          for (const n of [10, 100, 1000, 10000]) {
            const s = traj[n - 1];
            this.play(this.r[3].animate.set_value(s[3]), this.r[1].animate.set_value(s[1]), this.r[2].animate.set_value(s[2]), this.steps.animate.set_value(n), { run_time: 1.6, rate_func: linear });
            this.wait(0.4);
          }
          this.wait(0.8);
          // one loss for D: the card C ≻ D joins the data, the fit settles below A
          const card = this.card_mobs[0];
          this.play(card.animate.move_to([CARD_X[0], ADDED_Y, 0]), { run_time: 1 });
          this.cards[0].set_value(1);
          const back = fit_from(this.rewards(), this.games(), 20000);
          const end = back[back.length - 1];
          this.play(this.r[3].animate.set_value(end[3]), this.steps.animate.set_value(30000), { run_time: 2.5, rate_func: smooth });
          this.wait(2);
        } else {
          this.wait(0.5);
        }
      }
    }
    return new BradleyTerryFit();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    for (const k of [1, 2, 3]) {
      ui.add_handle({
        get: () => [BX[k], Yr(scene.r[k].get_value()), 0],
        set: (pt: P3) => {
          scene.queue = [];
          scene.r[k].set_value(Math.round(clamp(RofY(pt[1]), R_LO, R_HI) * 100) / 100);
        },
        constraint: (pt: P3) => [BX[k], clamp(pt[1], BY0, BY1), 0],
        step: (BY1 - BY0) / (R_HI - R_LO) * 0.05,
        radius: 0.35,
        label: pick(lang, `the reward of ${ITEMS[k]}`, `${ITEMS[k]} 的奖励`),
        on_end: () => scene.emit('dragged', { item: ITEMS[k], r: scene.r[k].get_value(), err: scene.abc_error() }),
      });
    }
  },
});

/**
 * Make the comparison cards draggable into the data table (a world's setup
 * calls this: drag and drop needs a full Interaction, the visual checker
 * only provides handles).
 */
export function attach_bt_cards(scene: any, ui: any): void {
  const lang: Lang = scene.lang ?? 'en';
  const table = { id: 'data', region: { box: [-0.7, 6.9, -1.4, 3.1] as [number, number, number, number] }, label: pick(lang, 'the data table', '数据表'), hint: pick(lang, 'Drop into the data', '放进数据'), snap_to: (d: any) => [CARD_X[BT_CARDS.findIndex((_, k) => scene.card_mobs[k] === d.mobject)], ADDED_Y, 0] as P3 };
    scene.card_mobs.forEach((m: any, k: number) => {
      ui.add_draggable(m, {
        zones: [table], return_if_missed: 'home',
        label: pick(lang, `the card ${ITEMS[BT_CARDS[k][0]]} beats ${ITEMS[BT_CARDS[k][1]]}`, `“${ITEMS[BT_CARDS[k][0]]} 胜 ${ITEMS[BT_CARDS[k][1]]}”这张卡片`),
        hint: pick(lang, 'Drag {label} into the table', '把{label}拖进上面的表'),
        on_drop: (zone: string | null) => {
          const v = zone ? 1 : 0;
          if ((scene.cards[k].get_value() > 0.5 ? 1 : 0) === v) return;
          scene.cards[k].set_value(v);
          scene.emit('data', { card: `${ITEMS[BT_CARDS[k][0]]}>${ITEMS[BT_CARDS[k][1]]}`, added: !!v, d_lost: scene.d_lost() });
        },
      });
    });
}
