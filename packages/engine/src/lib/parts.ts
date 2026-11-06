// An exploded formula (分解的公式; specimen gpu/int/explode.js). A formula is an assembly, and it can be drawn the way
// an engineer draws one: tap it and each named part lifts straight up on its own card, its meaning written over it,
// while the paper keeps the assembled formula (each part's shadow stays exactly where it sits). Tap again and the
// parts drop back into their shadows, glyph for glyph. At rest, assembled, a named part has a dotted line under it
// (something is folded there), as a term with a definition has.
//
// For a model to write: the parts are TeX pieces of the formula, each with what it means:
//   parts_figure('P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', [{ tex: 'P(A)', says: 'the prior' }, ...])
// (in a text: a ```parts fence, the formula on its first line, then `piece: meaning` lines).
import { look } from '@mathnim/look';
import type { TexGlyph } from 'manim-web/utils/tex/mathjax';
import type { Box } from '../kernel/geom';
import { Figure } from '../kernel/figure';
import { column, type Block, type LayoutEnv, type Size } from '../kernel/layout';
import { param, read, type Param } from '../kernel/state';
import { match_symbol, typeset_line, type TexLine, type Token } from './steps';
import { tex_scale } from '../kernel/tex';
import { break_lines, font_css, font_of, t, tr, type L10n, type Lang } from '../kernel/text';
import { Thing, type DrawEnv } from '../kernel/thing';
import { define_thing } from '../kernel/registry';

export interface FormulaPart { tex: string; says: string | L10n }

export class Parts extends Thing implements Block {
  kind = 'parts';
  readonly line: TexLine;
  /** 0 assembled, 1 exploded. */
  readonly open: Param<number>;
  readonly issues: string[] = [];
  /** Each part's tokens in the formula (null: not found), and what it means. */
  readonly found: { part: FormulaPart; tokens: Token[] | null }[];
  private paths = new Map<TexGlyph, Path2D>();
  private px_fit = 0;
  private lang: Lang = 'en';
  constructor(public tex: string, parts: FormulaPart[], o: { id?: string; size?: number } = {}) {
    super({ id: o.id ?? 'parts', role: 'text', z: 5 });
    this.line = typeset_line(tex);
    if (this.line.error) this.issues.push(`the formula does not typeset: ${this.line.error}`);
    const taken = new Set<Token>();
    this.found = parts.map((part) => {
      const tokens = this.line.error ? null : match_symbol(this.line, part.tex, taken);
      if (!tokens) this.issues.push(`the part ${part.tex} is not in the formula`);
      else tokens.forEach((t) => taken.add(t));
      return { part, tokens };
    });
    this.open = param(0, { name: `${this.id}.open`, range: [0, 1], tutor: true, doc: 'the formula taken apart (1) or assembled (0)' });
    this.size = o.size ?? null;
  }
  private size: number | null;
  private px(): number {
    return this.size ?? (this.px_fit || look().type.display.size);
  }
  private label_font() {
    return font_of('caption', { size: Math.round(Math.max(look().type.caption.size, this.px() * 0.42)) });
  }
  /**
   * Where the cards go when the formula is taken apart: every card above the whole formula, in rows; across, each part
   * keeps its x, and a card that would meet one already placed (its words included) goes a row higher.
   */
  private cards(): { i: number; cx: number; level: number; lines: string[] }[] & { rows: number; row_h: number } {
    const f = this.label_font(), k = tex_scale(this.px()), pad = this.px() * 0.22, lineh = f.size * look().type.caption.line;
    const items = this.found.map((fd, i) => {
      if (!fd.tokens) return null;
      const x0 = Math.min(...fd.tokens.map((t) => t.box[0])) * k, x1 = Math.max(...fd.tokens.map((t) => t.box[2])) * k;
      const maxw = Math.max(90, Math.min(200, (this.box.w || 600) / 3));
      const lines = break_lines(tr(fd.part.says, this.lang), f, maxw);
      const lw = Math.max(...lines.map((l) => l.width));
      return { i, cx: (x0 + x1) / 2, half: Math.max(x1 - x0 + 2 * pad, lw) / 2 + 8, lines: lines.map((l) => l.spans.map((s) => s.s).join('')) };
    }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.cx - b.cx);
    const rows: [number, number][][] = [];
    const out = items.map((it) => {
      let level = 0;
      while ((rows[level] ?? []).some(([a, b]) => it.cx - it.half < b && it.cx + it.half > a)) level++;
      (rows[level] ??= []).push([it.cx - it.half, it.cx + it.half]);
      return { i: it.i, cx: it.cx, level, lines: it.lines };
    }) as { i: number; cx: number; level: number; lines: string[] }[] & { rows: number; row_h: number };
    const card_h = Math.max(0, ...this.found.map((fd) => (fd.tokens ? (Math.max(...fd.tokens.map((t) => t.box[3])) - Math.min(...fd.tokens.map((t) => t.box[1]))) * k : 0))) + 2 * pad;
    const most = Math.max(1, ...out.map((o) => o.lines.length));
    out.rows = Math.max(1, rows.length);
    out.row_h = card_h + most * lineh + this.px() * 0.35;
    return out;
  }
  /** Room above the formula for the rows of cards and their words (px). */
  private room(): number {
    const c = this.cards();
    return c.rows * c.row_h + this.px() * 0.3;
  }
  measure(w: number, _env: LayoutEnv): Size {
    const k1 = tex_scale(1), W = this.line.view[2];
    this.px_fit = Math.max(look().type.label.size, Math.min(look().type.display.size * 1.15, (w - 16) / (W * k1)));
    const h = this.room() + this.line.view[3] * tex_scale(this.px()) + this.px() * 0.5;
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.lang = env.lang;
    const s = this.measure(b.w, env), k = tex_scale(this.px()), w = this.line.view[2] * k;
    this.box = { x: b.x, y: b.y, w: b.w, h: s.h };
    this.x0 = b.x + (b.w - w) / 2 - this.line.view[0] * k;
    this.y0 = b.y + this.room() - this.line.view[1] * k;
  }
  private x0 = 0;
  private y0 = 0;
  /**
   * Where the room for the cards ends (px from the figure's top): above it there is nothing while the formula is
   * assembled, so a page may show only what is below it and open the room as the formula comes apart.
   */
  room_end(): number {
    return Math.max(0, this.y0 + this.line.view[1] * tex_scale(this.px()) - this.px() * 0.3);
  }
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `parts '${this.id}' (${this.found.length})`;
  }
  override text(): string {
    return `${this.tex} — ${this.found.map((f) => `${f.part.tex}: ${tr(f.part.says, this.lang)}`).join('; ')}`;
  }
  override parts_of = (lang: Lang) => {
    const k = tex_scale(this.px()), out: { text: string; tex?: boolean; box: Box }[] = [{ text: this.tex, tex: true, box: { x: this.x0 + this.line.view[0] * k, y: this.y0 + this.line.view[1] * k, w: this.line.view[2] * k, h: this.line.view[3] * k } }];
    for (const f of this.found) if (f.tokens) out.push({ text: `${f.part.tex}: ${tr(f.part.says, lang)}`, box: this.span_box(f.tokens, 0) });
    return out;
  };
  /** A part's ink box (px), lifted by `lift` px. */
  private span_box(ts: Token[], lift: number): Box {
    const k = tex_scale(this.px()), x0 = Math.min(...ts.map((t) => t.box[0])), x1 = Math.max(...ts.map((t) => t.box[2])), y0 = Math.min(...ts.map((t) => t.box[1])), y1 = Math.max(...ts.map((t) => t.box[3]));
    return { x: this.x0 + x0 * k, y: this.y0 + y0 * k - lift, w: (x1 - x0) * k, h: (y1 - y0) * k };
  }
  private path(g: TexGlyph): Path2D {
    let p = this.paths.get(g);
    if (!p) { p = new (globalThis as { Path2D: typeof Path2D }).Path2D(g.d ?? ''); this.paths.set(g, p); }
    return p;
  }
  private glyphs(g: CanvasRenderingContext2D, ts: Token[], dy: number, color: string, alpha: number): void {
    const k = tex_scale(this.px());
    g.save();
    g.globalAlpha *= alpha;
    g.translate(this.x0, this.y0 - dy);
    g.scale(k, k);
    for (const t of ts) for (const gl of t.glyphs) {
      g.fillStyle = gl.fill ?? color;
      if (gl.text) { g.font = `${gl.font_size}px ${look().fonts.serif}`; g.fillText(gl.text, gl.at![0], gl.at![1]); }
      else if (gl.rect) g.fillRect(gl.rect[0], gl.rect[1], gl.rect[2], gl.rect[3]);
      else g.fill(this.path(gl));
    }
    g.restore();
  }
  draw(env: DrawEnv): void {
    const g = env.g as CanvasRenderingContext2D, a = Math.max(0, Math.min(1, read(this.open))), e = a * a * (3 - 2 * a);
    const color = this.text_color, ink2 = env.look.palette.ink2, k = tex_scale(this.px()), lh = this.line.view[3] * k;
    const named = new Set<Token>(this.found.flatMap((f) => f.tokens ?? []));
    // the formula's own ink that is no part: always where it is
    this.glyphs(g, this.line.tokens.filter((t) => !named.has(t)), 0, color, 1);
    const f = this.label_font(), cards = this.cards(), lineh = f.size * look().type.caption.line, pad = this.px() * 0.22;
    const top = this.y0 + this.line.view[1] * k;
    for (const o of cards) {
      const ts = this.found[o.i].tokens!, rest = this.span_box(ts, 0);
      // its shadow on the paper: the assembled formula stays readable
      if (e > 0.001) this.glyphs(g, ts, 0, color, 0.16 * e);
      if (e < 0.001) {
        // assembled: a dotted line under it (something is folded here)
        g.save();
        g.fillStyle = 'rgba(98,102,109,0.8)';
        for (let x = rest.x + 1; x < rest.x + rest.w - 1; x += 5) { g.beginPath(); g.arc(x, rest.y + rest.h + this.px() * 0.16, 0.95, 0, Math.PI * 2); g.fill(); }
        g.restore();
        this.glyphs(g, ts, 0, color, 1);
        continue;
      }
      // where its card rests: above the whole formula, in its row
      const bottom = top - this.px() * 0.3 - o.level * cards.row_h, glyph_top = bottom - pad - rest.h;
      const lift = (rest.y - glyph_top) * e, card = this.span_box(ts, lift);
      // the line it lifted along: from its shadow to its card
      g.save();
      g.strokeStyle = ink2;
      g.globalAlpha *= 0.45 * e;
      g.setLineDash([2, 3]);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(card.x + card.w / 2, rest.y - 2);
      g.lineTo(card.x + card.w / 2, card.y + card.h + pad);
      g.stroke();
      g.restore();
      // its card: paper, one shadow height
      g.save();
      g.shadowColor = 'rgba(26,27,31,0.2)';
      g.shadowBlur = 12 * e;
      g.shadowOffsetY = 5 * e;
      g.fillStyle = '#fffefb';
      g.beginPath();
      g.roundRect(card.x - pad, card.y - pad, card.w + pad * 2, card.h + pad * 2, 6);
      g.fill();
      g.shadowColor = 'transparent';
      g.lineWidth = 0.6;
      g.strokeStyle = 'rgba(26,27,31,0.16)';
      g.stroke();
      g.restore();
      this.glyphs(g, ts, lift, color, 1);
      // what it means, over its card
      g.save();
      g.globalAlpha *= smooth01((e - 0.45) / 0.45);
      g.font = font_css(f);
      g.fillStyle = ink2;
      g.textBaseline = 'alphabetic';
      const ly = card.y - pad - lineh * 0.35 - (o.lines.length - 1) * lineh;
      o.lines.forEach((l, j) => {
        const w = g.measureText(l).width, x = Math.max(this.box.x, Math.min(this.box.x + this.box.w - w, card.x + card.w / 2 - w / 2));
        g.fillText(l, x, ly + j * lineh);
      });
      g.restore();
    }
  }
}
const smooth01 = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

/** A figure of one exploded formula: tap it to take it apart, tap again to put it back. */
export function parts_figure(tex: string, parts: FormulaPart[], o: { lang?: Lang; size?: number; paper?: boolean } = {}): Figure & { formula: Parts } {
  const fig = new Figure({ lang: o.lang ?? 'en' }) as Figure & { formula: Parts };
  if (o.paper === false) fig.paper = 'clear';
  const p = new Parts(tex, parts, { id: 'parts', size: o.size });
  fig.formula = p;
  fig.params.set(p.open.name, p.open);
  fig.layout(column([p]), o.paper === false ? { pad: 2 } : {});
  fig.check('the formula typesets and every part is in it', () => (p.issues.length ? p.issues.join('; ') : null));
  return fig;
}

// ---------------------------------------------------------------- entry
define_thing({
  name: 'parts', says: t('an exploded formula: tapped, each part lifts on a card with what it means', '分解的公式：点一下，每一部分带着它的意思升起来'),
  zones: ['figure', 'text'], maturity: 'stable', since: '0.2.1', from: 'int/explode',
  syntax: "parts_figure(tex, [{ tex: 'P(A)', says: 'the prior' }, …], { lang })",
  rules: ['each piece as it is written in the formula', 'for a formula whose parts are the lesson'],
  accept: t('closed, every glyph is where it was typeset; open, no card meets another', '合上时每个字形都在排版位置；打开时卡片互不相碰'),
  demo: (lang) => parts_figure('P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', [{ tex: 'P(A\\mid B)', says: lang === 'zh' ? '看到 B 之后 A 的可能' : 'how likely A is, now that B is seen' }, { tex: 'P(A)', says: lang === 'zh' ? '证据之前 A 有多常见' : 'how common A is before any evidence' }], { lang }),
  source: 'packages/engine/src/lib/parts.ts',
});
