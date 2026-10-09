// Text pages: read (prose, formulas, code, figures, embedded visuals),
// derive (a derivation revealed line by line, with "why" notes and a fill-in
// line) and code (code next to its notes). The HTML is built as strings
// (blocks_html is pure, so it is tested without a DOM), then hydrate() binds
// the behaviour: copy buttons, code tabs, footnote links, embedded visuals.
// LessonView puts the article in its reading column and the outline or
// progress in the side panel.
import { tr, code_line_count, type Block, type CodeStep, type DeriveStep, type Grade, type L10n, type Lang, type ReadStep, type TextStep, expr } from '@mathnim/core';
import type { Scene } from 'manim-web';
import { AffordanceLayer } from 'manim-web/ext/affordance';
import { Interaction } from 'manim-web/ext/interact';
import { ScenePlayer, preload } from 'manim-web/ext/player';
import { highlight_lines, lang_label } from './highlight';
import { drag_hint, t } from './i18n';
import { display_math_html, esc, math_html } from './math';

/** A visual ready to embed: its scene, and the handles to add when it has played. */
export interface EmbeddedVisual {
  scene: () => Scene;
  explore?: (scene: Scene, ui: Interaction) => void;
}
/** Finds a visual by name with checked parameters (the app passes @mathnim/visuals); null when unknown. */
export type VisualResolver = (name: string, params?: Record<string, unknown>) => EmbeddedVisual | null;

export interface PageContext {
  lang: Lang;
  /** Lesson id (derivation progress is remembered per lesson and step during the session). */
  lesson: string;
  visuals?: VisualResolver;
  /** Theme for embedded visuals' players. */
  on_player?: (p: ScenePlayer) => void;
  /** Accent colour for the handles of explorable visuals. */
  accent?: string;
  /** Grade the fill-in line (the runtime logs it); without it the page grades locally. */
  submit_blank?: (text: string) => Grade;
  reveal_blank?: () => void;
  /** Something changed that the view shows elsewhere (derivation progress). */
  on_progress?: () => void;
}

/** What the view needs from a page on screen. */
export interface PageController {
  /** The article (reading column). */
  el: HTMLElement;
  /** Outline / progress for the side panel. */
  aside: HTMLElement;
  /** Has the learner seen everything (a derivation fully revealed)? Continue is allowed anyway. */
  complete(): boolean;
  dispose(): void;
}

let uid = 0;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const lang_attr = (l: Lang) => (l === 'zh' ? 'zh-CN' : 'en');

// ---------------------------------------------------------------- blocks -> HTML (pure)
interface CiteInfo {
  n: number;
  text: L10n;
  url: string;
}
/** Rendering state of one page: language, footnote numbers, ids. */
export class BlockRenderer {
  readonly id = `mnp${++uid}`;
  cites = new Map<string, CiteInfo>();
  private all_cites = new Map<string, { text: L10n; url: string }>();
  headings: { id: string; text: string; level: number }[] = [];
  visuals: Extract<Block, { type: 'visual' }>[] = [];
  codes: { label: string; lang: string; code: string }[][] = [];
  words = 0;
  figures = 0;
  formulas = 0;
  constructor(readonly lang: Lang) {}

  /** Prose (L10n) as HTML: TeX, emphasis, `code`, links, footnote markers. */
  prose(s: L10n | undefined): string {
    const text = tr(s, this.lang);
    this.count(text);
    return math_html(text, { footnote: (key) => this.ref(key) });
  }
  private count(text: string): void {
    const plain = text.replace(/\$[^$]*\$/g, ' x ');
    this.words += (plain.match(/[㐀-鿿]/g)?.length ?? 0) / 2 + (plain.replace(/[㐀-鿿]/g, ' ').match(/\S+/g)?.length ?? 0);
  }
  private ref(key: string): string {
    const c = this.all_cites.get(key);
    if (!c) return `<sup class="mn-fnref mn-fnref-missing" title="${esc(key)}">?</sup>`;
    let info = this.cites.get(key);
    if (!info) this.cites.set(key, (info = { n: this.cites.size + 1, ...c }));
    // a word joiner keeps the marker on the line of the word it belongs to
    return `\u2060<sup class="mn-fnref"><a href="#" data-fn="${esc(key)}" id="${this.id}-ref-${esc(key)}" aria-label="${esc(t('sources', undefined, this.lang))} ${info.n}">${info.n}</a></sup>`;
  }
  /** Learn the page's cite blocks first, so references anywhere get their numbers. */
  collect(blocks: Block[]): void {
    for (const b of blocks) {
      if (b.type === 'cite') this.all_cites.set(b.key, { text: b.text, url: b.url });
      if (b.type === 'details') this.collect(b.blocks);
    }
  }

  block(b: Block): string {
    switch (b.type) {
      case 'h': {
        const level = b.level ?? 2;
        const id = `${this.id}-h${this.headings.length}`;
        this.headings.push({ id, text: tr(b.text, this.lang), level });
        return `<h${level} class="mn-h" id="${id}">${this.prose(b.text)}</h${level}>`;
      }
      case 'p':
        return `<p>${this.prose(b.text)}</p>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag} class="mn-list">${b.items.map((x) => `<li>${this.prose(x)}</li>`).join('')}</${tag}>`;
      }
      case 'math':
        this.formulas++;
        return `<div class="mn-dmath" role="math" aria-label="${esc(b.tex)}"><div class="mn-dmath-tex">${display_math_html(b.tex)}</div>${b.label ? `<span class="mn-eqlabel">(${esc(b.label)})</span>` : ''}</div>`;
      case 'code':
        return this.code_block(b);
      case 'figure': {
        this.figures++;
        const src = tr(b.src, this.lang).replace(/^\//, '');
        const cap = [b.caption ? this.prose(b.caption) : '', b.credit ? `<span class="mn-credit">${esc(t('source_credit', { c: b.credit }, this.lang))}</span>` : ''].filter(Boolean).join(' ');
        return `<figure class="mn-fig"><img src="${esc(src)}" alt="${esc(tr(b.alt, this.lang))}" loading="lazy" decoding="async">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
      }
      case 'visual': {
        const k = this.visuals.push(b) - 1;
        return `<figure class="mn-vis" data-vis="${k}"><div class="mn-vis-stage"><canvas width="1280" height="720" role="img" aria-label="${esc(tr(b.caption, this.lang) || b.name)}"></canvas></div><div class="mn-vis-bar"></div>${b.caption ? `<figcaption>${this.prose(b.caption)}</figcaption>` : ''}</figure>`;
      }
      case 'callout': {
        const title = b.title !== undefined ? this.prose(b.title) : esc(t(`callout_${b.kind}`, undefined, this.lang));
        return `<aside class="mn-callout mn-callout-${b.kind}" role="note"><div class="mn-callout-title"><span class="mn-callout-icon" aria-hidden="true">${CALLOUT_ICON[b.kind]}</span><span>${title}</span></div><div class="mn-callout-body">${this.prose(b.body)}</div></aside>`;
      }
      case 'details':
        return `<details class="mn-details"><summary><span>${this.prose(b.summary)}</span></summary><div class="mn-details-body">${b.blocks.map((x) => this.block(x)).join('')}</div></details>`;
      case 'table':
        return `<div class="mn-table-wrap" tabindex="0"><table class="mn-table"><thead><tr>${b.head.map((x) => `<th scope="col">${this.prose(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((x) => `<td>${this.prose(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'cite':
        return ''; // listed under "Sources" at the end of the page
    }
  }

  private code_block(b: Extract<Block, { type: 'code' }>): string {
    const tabs = [{ label: b.label ?? lang_label(b.lang), lang: b.lang, code: b.code }, ...(b.tabs ?? [])];
    const k = this.codes.push(tabs) - 1;
    const id = `${this.id}-c${k}`;
    const head = tabs.length > 1
      ? `<div class="mn-tabs" role="tablist">${tabs.map((x, i) => `<button type="button" role="tab" class="mn-tab" id="${id}-t${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-label="${esc(x.label)}">${esc(x.label)}</button>`).join('')}</div>`
      : `<span class="mn-code-lang">${esc(lang_label(b.lang))}</span>`;
    const panels = tabs.map((x, i) => `<pre class="mn-code" id="${id}-p${i}" ${tabs.length > 1 ? `role="tabpanel" aria-labelledby="${id}-t${i}"` : ''} tabindex="0"${i ? ' hidden' : ''}><code>${code_lines_html(x.code, x.lang)}</code></pre>`).join('');
    return `<figure class="mn-codeblock" data-code="${k}"><div class="mn-code-head">${head}<button type="button" class="mn-copy">${esc(t('copy', undefined, this.lang))}</button></div>${panels}${b.caption ? `<figcaption>${this.prose(b.caption)}</figcaption>` : ''}</figure>`;
  }

  /** The numbered sources of the page (referenced first, in order; then the others). */
  sources(): string {
    for (const [key, c] of this.all_cites) if (!this.cites.has(key)) this.cites.set(key, { n: this.cites.size + 1, ...c });
    if (!this.cites.size) return '';
    const items = [...this.cites.entries()].sort((a, b) => a[1].n - b[1].n).map(([key, c]) => {
      let host = c.url;
      try {
        host = new URL(c.url).hostname.replace(/^www\./, '');
      } catch {
        /* not absolute: show as is */
      }
      return `<li id="${this.id}-fn-${esc(key)}" value="${c.n}">${math_html(tr(c.text, this.lang))} <a href="${esc(c.url)}" target="_blank" rel="noopener" class="mn-src-link">${esc(host)}</a></li>`;
    });
    return `<section class="mn-sources"><h2 class="mn-sources-title">${esc(t('sources', undefined, this.lang))}</h2><ol>${items.join('')}</ol></section>`;
  }
  /** Minutes to spend on the page: 230 words (460 Chinese characters) a minute, plus time for code, formulas, figures and visuals. */
  minutes(): number {
    const extra = this.codes.length * 0.5 + this.visuals.length * 1 + this.figures * 0.3 + this.formulas * 0.2;
    return Math.max(1, Math.round(this.words / 230 + extra));
  }
}
const CALLOUT_ICON: Record<string, string> = { note: 'i', warning: '!', misconception: '✕', open: '?' };

/** Code as numbered lines (block spans), for code blocks and code pages. */
export function code_lines_html(code: string, lang: string, numbers = false): string {
  return highlight_lines(code, lang)
    .map((html, i) => `<span class="mn-line" data-n="${i + 1}">${numbers ? `<span class="mn-ln" aria-hidden="true">${i + 1}</span>` : ''}<span class="mn-lc">${html || '&#8203;'}</span></span>`)
    .join('');
}

/** HTML for a list of blocks plus its sources (pure; used by the read page and tests). */
export function blocks_html(blocks: Block[], lang: Lang, r = new BlockRenderer(lang)): string {
  r.collect(blocks);
  const body = blocks.map((b) => r.block(b)).join('');
  return body + r.sources();
}

// ---------------------------------------------------------------- behaviour
const TAB_KEY = 'mathnim.codetab';
const saved_tab = (): string | null => {
  try {
    return localStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
};

/** Wire copy buttons, tabs and footnote links inside `root`; returns the visual slots to load. */
function hydrate(root: HTMLElement, r: BlockRenderer, ctx: PageContext): VisualSlot[] {
  // copy buttons copy the visible tab's raw code
  root.querySelectorAll<HTMLElement>('.mn-codeblock').forEach((fig) => {
    const tabs = r.codes[+fig.dataset.code!];
    const btn = fig.querySelector<HTMLButtonElement>('.mn-copy')!;
    btn.onclick = () => {
      const i = [...fig.querySelectorAll('.mn-code')].findIndex((p) => !(p as HTMLElement).hidden);
      void copy_text(tabs[Math.max(0, i)].code, fig.querySelectorAll<HTMLElement>('.mn-code')[Math.max(0, i)], btn, ctx.lang);
    };
  });
  // tabs: one choice switches every block on the page that offers the same label
  const select = (label: string, remember: boolean) => {
    root.querySelectorAll<HTMLElement>('.mn-codeblock').forEach((fig) => {
      const btns = [...fig.querySelectorAll<HTMLButtonElement>('.mn-tab')];
      const k = btns.findIndex((b) => b.dataset.label === label);
      if (k < 0) return;
      btns.forEach((b, i) => {
        b.setAttribute('aria-selected', String(i === k));
        b.tabIndex = i === k ? 0 : -1;
      });
      fig.querySelectorAll<HTMLElement>('.mn-code').forEach((p, i) => (p.hidden = i !== k));
    });
    if (remember) {
      try {
        localStorage.setItem(TAB_KEY, label);
      } catch {
        /* no storage */
      }
    }
  };
  root.querySelectorAll<HTMLElement>('.mn-tabs').forEach((list) => {
    const btns = [...list.querySelectorAll<HTMLButtonElement>('.mn-tab')];
    btns.forEach((b, i) => {
      b.onclick = () => select(b.dataset.label!, true);
      b.onkeydown = (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = btns[(i + d + btns.length) % btns.length];
        n.focus();
        n.click();
      };
    });
  });
  const pref = saved_tab();
  if (pref) select(pref, false);
  // footnotes scroll (the app's router owns the URL hash)
  root.querySelectorAll<HTMLAnchorElement>('a[data-fn]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const li = root.querySelector<HTMLElement>(`#${CSS.escape(`${r.id}-fn-${a.dataset.fn}`)}`);
      li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      li?.classList.add('mn-flash');
      setTimeout(() => li?.classList.remove('mn-flash'), 1600);
    };
  });
  root.querySelectorAll<HTMLImageElement>('.mn-fig img').forEach((img) => {
    img.onerror = () => {
      const note = h('div', 'mn-fig-missing', esc(t('figure_missing', { src: img.getAttribute('src') ?? '' }, ctx.lang)));
      img.replaceWith(note);
    };
  });
  return [...root.querySelectorAll<HTMLElement>('.mn-vis')].map((fig) => new VisualSlot(fig, r.visuals[+fig.dataset.vis!], ctx));
}

async function copy_text(code: string, pre: HTMLElement, btn: HTMLButtonElement, lang: Lang): Promise<void> {
  const done = (key: string) => {
    btn.textContent = t(key, undefined, lang);
    btn.classList.add('mn-copied');
    setTimeout(() => {
      btn.textContent = t('copy', undefined, lang);
      btn.classList.remove('mn-copied');
    }, 1600);
  };
  try {
    await navigator.clipboard.writeText(code);
    done('copied');
  } catch {
    // no clipboard permission (e.g. an insecure origin): select the code instead
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    done('copy_failed');
  }
}

/** An embedded visual: loads when scrolled into view, plays once, then (optionally) becomes explorable. */
class VisualSlot {
  private player: ScenePlayer | null = null;
  private ui: Interaction | null = null;
  private aff: AffordanceLayer | null = null;
  private io: IntersectionObserver | null = null;
  private disposed = false;
  private hint: HTMLElement;
  constructor(private fig: HTMLElement, private b: Extract<Block, { type: 'visual' }>, private ctx: PageContext) {
    const bar = fig.querySelector<HTMLElement>('.mn-vis-bar')!;
    const v = ctx.visuals?.(b.name, b.params);
    this.hint = h('span', 'mn-help');
    if (!v) {
      fig.querySelector('.mn-vis-stage')!.innerHTML = `<div class="mn-vis-missing">${esc(t('visual_missing', { name: b.name }, ctx.lang))}</div>`;
      return;
    }
    const replay = h('button', 'mn-btn', esc(t('replay', undefined, ctx.lang)));
    replay.type = 'button';
    replay.onclick = () => void this.replay(v);
    bar.append(replay, this.hint);
    if (typeof IntersectionObserver === 'undefined') {
      void this.load(v);
      return;
    }
    this.io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        this.io?.disconnect();
        this.io = null;
        void this.load(v);
      }
    }, { threshold: 0.4 });
    this.io.observe(fig);
  }
  private async load(v: EmbeddedVisual): Promise<void> {
    if (this.player || this.disposed) return;
    await preload();
    if (this.disposed) return;
    const canvas = this.fig.querySelector('canvas')!;
    const p = new ScenePlayer(v.scene(), canvas, { audio: false });
    this.ctx.on_player?.(p);
    await p.load();
    if (this.disposed) return;
    this.player = p;
    p.opts.on_end = () => this.explorable(v);
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      p.show_end();
      this.explorable(v);
    } else p.play();
  }
  private explorable(v: EmbeddedVisual): void {
    const p = this.player;
    if (!p || this.ui || !this.b.explore || !v.explore || this.disposed) return;
    this.ui = new Interaction(p);
    v.explore(p.scene, this.ui);
    p.start_live();
    this.aff = new AffordanceLayer(this.ui, { color: this.ctx.accent ?? '#2f5bd3', hint: drag_hint(this.ui.handles, this.ctx.lang) });
    setTimeout(() => this.aff?.coach(), 400);
    this.hint.innerHTML = t('visual_explore', undefined, this.ctx.lang);
  }
  private async replay(v: EmbeddedVisual): Promise<void> {
    if (!this.player) return this.load(v);
    this.ui?.dispose();
    this.ui = null;
    this.aff?.dispose();
    this.aff = null;
    this.hint.innerHTML = '';
    const p = this.player;
    p.stop_live();
    p.seek_frame(0);
    p.play();
  }
  dispose(): void {
    this.disposed = true;
    this.io?.disconnect();
    this.aff?.dispose();
    this.ui?.dispose();
    this.player?.pause();
    this.player?.stop_live();
  }
}

/** The page header: chapter kicker and title. */
function header(step: TextStep, chapter: L10n | undefined, lang: Lang, extra = ''): string {
  const kicker = tr(chapter, lang);
  const title = tr(step.title, lang);
  if (!kicker && !title && !extra) return '';
  return `<header class="mn-page-head">${kicker ? `<div class="mn-page-kicker">${math_html(kicker)}</div>` : ''}${title ? `<h1 class="mn-page-title">${math_html(title)}</h1>` : ''}${extra}</header>`;
}

// ---------------------------------------------------------------- read
export function read_page(step: ReadStep, chapter: L10n | undefined, ctx: PageContext): PageController {
  const r = new BlockRenderer(ctx.lang);
  const body = blocks_html(step.blocks, ctx.lang, r);
  const el = h('article', 'mn-page mn-read');
  el.lang = lang_attr(ctx.lang);
  el.innerHTML = header(step, chapter, ctx.lang, `<div class="mn-page-meta">${esc(t('min_read', { n: r.minutes() }, ctx.lang))}</div>`) + `<div class="mn-prose">${body}</div>`;
  const slots = hydrate(el, r, ctx);
  const aside = h('nav', 'mn-outline');
  const heads = r.headings.filter((x) => x.level === 2);
  if (heads.length >= 2) {
    aside.setAttribute('aria-label', t('on_this_page', undefined, ctx.lang));
    aside.innerHTML = `<div class="mn-kicker">${esc(t('on_this_page', undefined, ctx.lang))}</div>`;
    const ol = h('ol');
    for (const x of heads) {
      const li = h('li');
      const b = h('button', 'mn-outline-link', math_html(x.text));
      b.type = 'button';
      b.onclick = () => el.querySelector(`#${CSS.escape(x.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      li.append(b);
      ol.append(li);
    }
    aside.append(ol);
  }
  return { el, aside, complete: () => true, dispose: () => slots.forEach((s) => s.dispose()) };
}

// ---------------------------------------------------------------- derive
/** Derivation progress this session, per lesson/step: lines shown, and how the blank ended. */
const DERIVE_STATE = new Map<string, { shown: number; blank?: 'right' | 'shown' }>();

export function derive_page(step: DeriveStep, chapter: L10n | undefined, ctx: PageContext): PageController {
  const lang = ctx.lang;
  const key = `${ctx.lesson}/${step.id}`;
  const state = DERIVE_STATE.get(key) ?? { shown: 1 };
  DERIVE_STATE.set(key, state);
  const n = step.lines.length;
  const blank = step.blank && step.blank.line >= 0 && step.blank.line < n ? step.blank : undefined;
  const r = new BlockRenderer(lang);
  const el = h('article', 'mn-page mn-derive');
  el.lang = lang_attr(lang);
  el.innerHTML = header(step, chapter, lang) + (step.intro ? `<div class="mn-prose">${r.prose(step.intro)}</div>` : '');
  const list = h('ol', 'mn-dlines');
  list.setAttribute('aria-live', 'polite');
  const controls = h('div', 'mn-dcontrols');
  const next = h('button', 'mn-btn primary mn-next-step', esc(t('next_step', undefined, lang)));
  next.type = 'button';
  const all = h('button', 'mn-linkbtn', esc(t('show_all', undefined, lang)));
  all.type = 'button';
  const count = h('span', 'mn-help');
  controls.append(next, all, count);
  const outro = h('div', 'mn-prose mn-outro', step.outro ? r.prose(step.outro) : '');
  el.append(list, controls, outro);
  const aside = h('div', 'mn-derive-aside');
  aside.innerHTML = `<div class="mn-kicker">${esc(t('kind_derive', undefined, lang))}</div><div class="mn-progress"><i></i></div><div class="mn-help mn-derive-count"></div><div class="mn-help">${esc(t('derive_help', undefined, lang))}</div>`;

  const blank_open = () => !!blank && state.shown > blank.line && !state.blank;
  const line_el = (i: number): HTMLLIElement => {
    const L = step.lines[i];
    const li = h('li', 'mn-dline');
    li.dataset.i = String(i);
    const num = h('span', 'mn-dnum', String(i + 1));
    num.setAttribute('aria-hidden', 'true');
    const body = h('div', 'mn-dbody');
    li.append(num, body);
    if (blank && i === blank.line && !state.blank) {
      body.append(blank_ui(li));
      return li;
    }
    const tex = h('div', 'mn-dtex', display_math_html(L.tex));
    tex.setAttribute('role', 'math');
    tex.setAttribute('aria-label', L.tex);
    const row = h('div', 'mn-drow');
    row.append(tex);
    if (blank && i === blank.line) li.classList.add(state.blank === 'right' ? 'mn-blank-right' : 'mn-blank-shown');
    if (L.why) {
      const id = `${r.id}-why${i}`;
      const btn = h('button', 'mn-why-btn', esc(t('why', undefined, lang)));
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id);
      const why = h('div', 'mn-why', r.prose(L.why));
      why.id = id;
      why.hidden = true;
      btn.onclick = () => {
        why.hidden = !why.hidden;
        btn.setAttribute('aria-expanded', String(!why.hidden));
        btn.textContent = t(why.hidden ? 'why' : 'why_hide', undefined, lang);
      };
      row.append(btn);
      body.append(row, why);
    } else body.append(row);
    return li;
  };

  const blank_ui = (li: HTMLLIElement): HTMLElement => {
    const b = blank!;
    const box = h('div', 'mn-blank');
    const prompt = h('div', 'mn-blank-prompt', `<span class="mn-yt-icon" aria-hidden="true">✎</span><span>${b.prompt ? r.prose(b.prompt) : esc(t('blank_prompt', undefined, lang))}</span>`);
    const input = h('input', 'mn-input') as HTMLInputElement;
    input.setAttribute('aria-label', t('blank_answer', undefined, lang));
    input.autocomplete = 'off';
    input.spellcheck = false;
    const preview = h('div', 'mn-preview');
    const help = h('div', 'mn-help', t('blank_help', undefined, lang));
    const fb = h('div', 'mn-feedback');
    fb.setAttribute('aria-live', 'polite');
    const acts = h('div', 'mn-actions');
    const check = h('button', 'mn-btn primary', esc(t('check', undefined, lang)));
    check.type = 'button';
    const show = h('button', 'mn-btn', esc(t('show_me', undefined, lang)));
    show.type = 'button';
    acts.append(check, show);
    box.append(prompt, input, preview, help, fb, acts);
    let tries = 0;
    input.oninput = () => {
      const s = input.value.trim();
      if (!s) return void (preview.textContent = '');
      try {
        preview.innerHTML = math_html(`$${expr.to_latex(expr.parse(s, b.variables ?? []))}$`);
      } catch {
        preview.textContent = '…';
      }
    };
    const settle = (how: 'right' | 'shown') => {
      state.blank = how;
      const fresh = line_el(b.line);
      li.replaceWith(fresh);
      const note = h('div', `mn-feedback ${how === 'right' ? 'good' : 'info'}`, esc(t(how === 'right' ? 'blank_right' : 'blank_shown', undefined, lang)));
      fresh.querySelector('.mn-dbody')!.append(note);
      update();
      next.focus();
    };
    check.onclick = () => {
      const s = input.value.trim();
      if (!s) return input.focus();
      tries++;
      const g = ctx.submit_blank ? ctx.submit_blank(s) : local_grade(step, s, lang);
      if (g.correct) return settle('right');
      fb.className = 'mn-feedback bad';
      fb.innerHTML = [t('blank_wrong', undefined, lang), ...g.feedback].map((x) => `<p>${math_html(x)}</p>`).join('');
      if (tries >= 2) show.classList.add('primary');
      input.focus();
      input.select();
    };
    show.onclick = () => {
      ctx.reveal_blank?.();
      settle('shown');
    };
    input.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation(); // the lesson view's Enter would press Continue
      check.click();
    };
    setTimeout(() => input.isConnected && input.focus({ preventScroll: false }), 60);
    return box;
  };

  const update = () => {
    const done = state.shown >= n && !blank_open();
    next.hidden = done;
    all.hidden = done || blank_open();
    controls.classList.toggle('mn-done', done);
    next.disabled = blank_open();
    count.textContent = blank_open() ? t('blank_pending', undefined, lang) : done ? t('derive_done', undefined, lang) : t('step_k_of_n', { k: Math.min(state.shown, n), n }, lang);
    outro.hidden = !done || !step.outro;
    const bar = aside.querySelector<HTMLElement>('.mn-progress i')!;
    bar.style.width = `${Math.round((Math.min(state.shown, n) / n) * 100)}%`;
    aside.querySelector('.mn-derive-count')!.textContent = done ? t('derive_done', undefined, lang) : t('step_k_of_n', { k: Math.min(state.shown, n), n }, lang);
    ctx.on_progress?.();
  };
  const reveal_to = (k: number) => {
    const from = list.children.length;
    state.shown = Math.min(n, k);
    for (let i = from; i < state.shown; i++) {
      const li = line_el(i);
      if (i >= 1) li.classList.add('mn-enter');
      list.append(li);
    }
    update();
    const last = list.lastElementChild as HTMLElement | null;
    if (from < state.shown && from > 0) last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  next.onclick = () => {
    if (blank_open()) return;
    reveal_to(state.shown + 1);
  };
  all.onclick = () => reveal_to(blank && !state.blank ? blank.line + 1 : n);
  // lines shown earlier this session stay shown (also after a language switch)
  const target = state.shown;
  state.shown = 0;
  reveal_to(target);
  return { el, aside, complete: () => state.shown >= n && !blank_open(), dispose: () => {} };
}

function local_grade(step: DeriveStep, text: string, lang: Lang): Grade {
  // without a runtime (e.g. a preview): the same grader, unlogged
  const b = step.blank!;
  try {
    const ok = expr.equivalent(expr.parse(text, b.variables ?? []), b.answer, { ranges: b.ranges ?? Object.fromEntries((b.variables ?? []).map((v) => [v, [0.5, 4] as [number, number]])) });
    return { correct: ok, score: ok ? 1 : 0, feedback: [] };
  } catch {
    return { correct: false, score: 0, feedback: [t('blank_wrong', undefined, lang)] };
  }
}

// ---------------------------------------------------------------- code
export function code_page(step: CodeStep, chapter: L10n | undefined, ctx: PageContext): PageController {
  const lang = ctx.lang;
  const r = new BlockRenderer(lang);
  const el = h('article', 'mn-page mn-codepage');
  el.lang = lang_attr(lang);
  const total = code_line_count(step.code);
  el.innerHTML = header(step, chapter, lang) + (step.intro ? `<div class="mn-prose">${r.prose(step.intro)}</div>` : '');
  const wrap = h('div', 'mn-cp');
  const code = h('div', 'mn-cp-code');
  code.innerHTML = `<figure class="mn-codeblock" data-code="0"><div class="mn-code-head"><span class="mn-code-lang">${esc(lang_label(step.lang))}</span><span class="mn-help mn-cp-help">${esc(t('code_help', undefined, lang))}</span><button type="button" class="mn-copy">${esc(t('copy', undefined, lang))}</button></div><pre class="mn-code mn-numbered" tabindex="0"><code>${code_lines_html(step.code, step.lang, true)}</code></pre></figure>`;
  r.codes.push([{ label: step.lang, lang: step.lang, code: step.code }]);
  // tensor shapes on a row of their own under the last line of their note, indented like it (always in view, never off to the right)
  step.notes.forEach((note, i) => {
    if (!note.shapes) return;
    const n = Math.min(total, Math.max(1, note.lines[1]));
    const line = code.querySelector<HTMLElement>(`.mn-line[data-n="${n}"]`);
    if (!line) return;
    const indent = /^[ \t]*/.exec(step.code.split('\n')[n - 1] ?? '')![0];
    const row = h('span', 'mn-shape-row', `<span class="mn-ln" aria-hidden="true"></span><span class="mn-lc">${esc(indent)}<span class="mn-shape-tag" data-note="${i}">↳ ${esc(note.shapes)}</span></span>`);
    line.after(row);
  });
  const notes = h('ol', 'mn-cp-notes');
  step.notes.forEach((note, i) => {
    const [a, b] = note.lines;
    const li = h('li', 'mn-note');
    li.tabIndex = 0;
    li.dataset.i = String(i);
    li.innerHTML = `<div class="mn-note-lines">${esc(t(a === b ? 'line_one' : 'lines_range', { a, b }, lang))}</div><div class="mn-note-text">${r.prose(note.text)}</div>${note.shapes ? `<div class="mn-note-shapes"><span class="mn-help">${esc(t('shapes', undefined, lang))}</span> <code>${esc(note.shapes)}</code></div>` : ''}`;
    notes.append(li);
  });
  wrap.append(code, notes);
  el.append(wrap);
  hydrate(el, r, ctx);

  const pre = code.querySelector<HTMLElement>('.mn-code')!;
  let active = -1;
  const focus_note = (i: number, scroll_code = true) => {
    if (i === active || i < 0 || i >= step.notes.length) return;
    active = i;
    const [a, b] = step.notes[i].lines;
    notes.querySelectorAll('.mn-note').forEach((x, k) => x.classList.toggle('active', k === i));
    pre.classList.add('mn-focusing');
    pre.querySelectorAll<HTMLElement>('.mn-line').forEach((x) => {
      const n = +x.dataset.n!;
      x.classList.toggle('hl', n >= a && n <= b);
      x.classList.toggle('hl-start', n === a);
      x.classList.toggle('hl-end', n === b);
    });
    pre.querySelectorAll<HTMLElement>('.mn-shape-tag').forEach((x) => x.classList.toggle('on', x.dataset.note === String(i)));
    const first = pre.querySelector<HTMLElement>(`.mn-line[data-n="${a}"]`);
    if (scroll_code && first && pre.scrollHeight > pre.clientHeight + 4) {
      pre.scrollTo({ top: Math.max(0, first.offsetTop - pre.clientHeight * 0.25), behavior: 'smooth' });
    }
  };
  notes.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.mn-note');
    if (li && !(e.target as HTMLElement).closest('a')) focus_note(+li.dataset.i!);
  });
  notes.addEventListener('focusin', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.mn-note');
    if (li) focus_note(+li.dataset.i!);
  });
  notes.addEventListener('keydown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.mn-note');
    if (!li) return;
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    (notes.children[Math.min(step.notes.length - 1, Math.max(0, +li.dataset.i! + d))] as HTMLElement | undefined)?.focus();
  });
  // scrolling the notes past the middle of the window focuses them (the code panel stays in view)
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((es) => {
      const hit = es.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0];
      if (hit) focus_note(+(hit.target as HTMLElement).dataset.i!);
    }, { rootMargin: '-40% 0px -50% 0px' });
    notes.querySelectorAll('.mn-note').forEach((x) => io!.observe(x));
  }
  focus_note(0, false);
  const aside = h('div', 'mn-code-aside', `<div class="mn-kicker">${esc(t('kind_code', undefined, lang))}</div><div class="mn-help">${esc(t('code_help', undefined, lang))}</div>`);
  return { el, aside, complete: () => true, dispose: () => io?.disconnect() };
}

/** The page for a text step. */
export function text_page(step: TextStep, chapter: L10n | undefined, ctx: PageContext): PageController {
  if (step.kind === 'read') return read_page(step, chapter, ctx);
  if (step.kind === 'derive') return derive_page(step, chapter, ctx);
  return code_page(step, chapter, ctx);
}
/** Forget derivation progress (tests, "Start again"). */
export function reset_derivations(lesson?: string): void {
  for (const k of [...DERIVE_STATE.keys()]) if (!lesson || k.startsWith(`${lesson}/`)) DERIVE_STATE.delete(k);
}
