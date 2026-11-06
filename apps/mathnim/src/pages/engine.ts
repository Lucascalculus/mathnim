// /engine: the gallery of the engine's library (docs/design/ENGINE-ARCH.md), drawn by the engine itself. Every entry
// of the registry - things, motions, gestures, the tutor's acts, text tools, interface effects - with what it means,
// how it is written, how mature it is and where it came from in the specimen; a thing's demo plays live (and can be
// explored), a text tool's example is set as the page sets it (it works: open the definition, drag the number), and
// each entry's acceptance checks run. Experiments are here before any lesson or model sees them: this is where one is
// tried and promoted. Unlisted (no link in the bar), like the demo courses' tests.
import { FigurePlayer, MATHIUM_VERSION, entries, run_checks, is_figure, type Entry, type Figure } from '@mathnim/engine';
import { esc, math_html, ui_lang, wire_text } from '@mathnim/present';
import { enable_dom_tex } from '../tex_dom';

const STYLE = `
.eng{max-width:980px;margin:0 auto;padding:48px 24px 120px;font-size:15px;line-height:1.7;color:var(--mn-fg)}
.eng-kicker{font:500 11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mn-muted)}
.eng h1{font-size:34px;line-height:1.2;margin:6px 0 4px;font-weight:600;letter-spacing:-.01em}
.eng-sum{color:var(--mn-muted);margin:0 0 28px}
.eng-filter{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 36px;font-size:14px}
.eng-filter button{border:0;background:none;padding:2px 0;font:inherit;color:var(--mn-muted);cursor:pointer;border-bottom:1.5px solid transparent}
.eng-filter button[aria-pressed=true]{color:var(--mn-fg);border-bottom-color:currentColor}
.eng h2{font-size:21px;margin:44px 0 6px;font-weight:600}
.eng-entry{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:8px 32px;padding:22px 0;border-top:1px solid var(--mn-border)}
.eng-entry.solo{grid-template-columns:minmax(0,1fr)}
.eng-name{font:600 14px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.eng-mat{margin-left:8px;font:500 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--mn-muted)}
.eng-mat.experiment{color:#C2410C}.eng-mat.preview{color:#2563EB}
.eng-says{margin:4px 0 8px}
.eng-code{display:block;font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mn-muted);white-space:pre-wrap;word-break:break-word}
.eng-meta{font-size:12.5px;color:var(--mn-muted);margin-top:6px}
.eng-meta b{font-weight:600;color:var(--mn-fg)}
.eng-ok{color:#15803D}.eng-bad{color:#B91C1C}
.eng-demo canvas{display:block;max-width:100%}
.eng-demo article{font-size:16px;line-height:1.8}
@media (max-width:760px){.eng-entry{grid-template-columns:minmax(0,1fr)}}
`;
const KINDS: [string, string, string, string][] = [['thing', 'Things', '物', 'thing'], ['gesture', 'Gestures', '手势', 'gesture'], ['motion', 'Motions', '动作', 'motion'], ['act', 'The tutor\'s acts', '导师的动作', 'tutor\'s act'], ['markup', 'Text tools', '文字工具', 'text tool'], ['effect', 'Interface effects', '界面效果', 'interface effect']];
const MATURITY_ZH: Record<string, string> = { experiment: '实验', preview: '预览', stable: '稳定' };

export async function engine_page(root: HTMLElement): Promise<() => void> {
  const zh = ui_lang() === 'zh', lang = zh ? 'zh' : 'en';
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  await enable_dom_tex();
  wire_text();
  // (what is being tried first, then what lessons use, then the vocabulary kits port from Manim)
  const rank = (e: Entry) => (e.internal ? 3 : { experiment: 0, preview: 1, stable: 2 }[e.maturity]);
  const all = entries().map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e);
  const el = document.createElement('div');
  el.className = 'eng';
  el.lang = lang;
  const count = (k: string) => all.filter((e) => e.kind === k).length;
  el.innerHTML = `<div class="eng-kicker">Mathium ${esc(MATHIUM_VERSION)}</div><h1>${zh ? '引擎的库' : 'The engine\'s library'}</h1>
    <p class="eng-sum">${KINDS.map(([k, , z, one]) => `${count(k)} ${zh ? z : count(k) === 1 ? one : `${one}s`}`).join(' · ')}</p>
    <div class="eng-filter">${['all', 'experiment', 'preview', 'stable'].map((m, i) => `<button type="button" data-m="${m}" aria-pressed="${i === 0}">${m === 'all' ? (zh ? '全部' : 'all') : zh ? MATURITY_ZH[m] : m}</button>`).join('')}</div>
    ${KINDS.filter(([k]) => count(k)).map(([k, en, z]) => `<section data-kind="${k}"><h2>${zh ? z : en}</h2>${all.filter((e) => e.kind === k).map((e) => entry_html(e, lang)).join('')}</section>`).join('')}`;
  root.append(el);
  // maturity: show one kind of piece at a time (an experiment among the stable ones is easy to miss)
  el.querySelector('.eng-filter')!.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    el.querySelectorAll('.eng-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    el.querySelectorAll<HTMLElement>('.eng-entry').forEach((x) => { x.hidden = b.dataset.m !== 'all' && x.dataset.m !== b.dataset.m; });
  });
  // the demos play when seen; each entry's acceptance checks run once
  const players: FigurePlayer[] = [];
  const io = new IntersectionObserver((es) => {
    for (const ev of es) {
      if (!ev.isIntersecting) continue;
      io.unobserve(ev.target);
      const box = ev.target as HTMLElement, e = all.find((x) => `${x.kind}/${x.name}` === box.dataset.entry);
      if (e) void show_demo(box, e, lang, players);
    }
  }, { rootMargin: '200px' });
  el.querySelectorAll('.eng-demo').forEach((d) => io.observe(d));
  for (const e of all.filter((x) => x.checks?.length)) {
    const out = el.querySelector<HTMLElement>(`[data-checks="${CSS.escape(`${e.kind}/${e.name}`)}"]`);
    void run_checks([e]).then((bad) => { if (out) out.innerHTML = bad.length ? `<span class="eng-bad">✗ ${esc(bad.join('; '))}</span>` : `<span class="eng-ok">✓ ${e.checks!.length}</span>`; });
  }
  return () => {
    io.disconnect();
    for (const p of players) { p.pause(); p.stop_live(); p.release(); }
    style.remove();
  };
}

function entry_html(e: Entry, lang: 'en' | 'zh'): string {
  const zh = lang === 'zh';
  const demo = e.demo || (e.kind === 'markup' || e.kind === 'effect') ? `<div class="eng-demo" data-entry="${esc(`${e.kind}/${e.name}`)}"></div>` : '';
  const meta = [
    e.from ? `${zh ? '来自样张' : 'from the specimen'} <b>${esc(e.from)}</b>` : '',
    e.aliases?.length ? `${zh ? '旧名' : 'also'} ${e.aliases.map(esc).join(', ')}` : '',
    `${zh ? '版本' : 'since'} ${esc(e.since)}`,
    esc(e.source.replace(/^packages\//, '')),
  ].filter(Boolean).join(' · ');
  return `<div class="eng-entry${demo ? '' : ' solo'}" data-m="${e.maturity}"><div>
      <div><span class="eng-name">${esc(e.name)}</span><span class="eng-mat ${e.maturity}">${zh ? MATURITY_ZH[e.maturity] : e.maturity}${e.internal ? (zh ? ' · 套件词汇' : ' · kit vocabulary') : ''}</span></div>
      <p class="eng-says">${esc(e.says[lang])}</p>
      <code class="eng-code">${esc(e.syntax)}</code>
      ${e.accept ? `<div class="eng-meta">${zh ? '验收' : 'accepted when'}: ${esc(e.accept[lang])} <span data-checks="${esc(`${e.kind}/${e.name}`)}"></span></div>` : e.checks?.length ? `<div class="eng-meta"><span data-checks="${esc(`${e.kind}/${e.name}`)}"></span></div>` : ''}
      <div class="eng-meta">${meta}</div>
    </div>${demo}</div>`;
}

/** A text tool's or an effect's demo: its example set as the page sets it (or its syntax, for an inline one). */
function markup_demo(e: Entry): string | null {
  const src = e.example ?? (e.kind === 'markup' || /^[[{`]/.test(e.syntax) ? e.syntax : null);
  if (!src) return null;
  return src.replace(/^```(\w+) … ```$/, '').trim() || null;
}

async function show_demo(box: HTMLElement, e: Entry, lang: 'en' | 'zh', players: FigurePlayer[]): Promise<void> {
  const made = e.demo?.(lang);
  // (a text tool's demo is a sentence in the learner's language, set as the page sets it, in its own page)
  if (typeof made === 'string') {
    box.innerHTML = `<article data-page>${math_html(made)}</article>`;
    return;
  }
  if (e.demo) {
    const fig = made;
    if (!is_figure(fig)) return;
    // (on the page's paper, as a figure in a text is)
    (fig as Figure).paper = 'clear';
    const canvas = document.createElement('canvas');
    box.append(canvas);
    const w = Math.min(560, Math.round(box.clientWidth || 460)), dpr = Math.min(2, devicePixelRatio || 1);
    const p = new FigurePlayer(fig as Figure, canvas, { audio: false, size: { w, dpr }, label: e.name });
    await p.load();
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    players.push(p);
    p.opts.on_end = () => { p.set_interactive(true); p.start_live(); };
    p.play();
    return;
  }
  const text = markup_demo(e);
  if (!text) return;
  // (its own page: the demo's nouns, numbers and light belong to it alone)
  box.innerHTML = `<article data-page>${math_html(text)}</article>`;
}
