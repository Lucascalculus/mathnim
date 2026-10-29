// The page of one hands-on lab (route /<course>/labs/<slug>, data from
// src/labs: load_lab(slug)). The tutorial in the learner's language is drawn
// by the text-page reader of @mathnim/present (read_page: headings, prose,
// tables, code blocks with copy, callouts, footnotes, the "on this page"
// outline). Under the title, the recommended setups; after the tutorial, the
// lab's code files, each with copy and a download link, before the sources.
// Always the light theme.
import { tr, type Lang, type ReadStep } from '@mathnim/core';
import { code_lines_html, esc, inject_styles, lang_label, read_page, t } from '@mathnim/present';
import type { LabConfig, LabFile, LabModule } from '../labs/types';

const S: Record<string, Record<Lang, string>> = {
  kicker: { en: 'Lab {id}', zh: '实验 {id}' },
  setups: { en: 'Recommended setups', zh: '推荐配置' },
  recommended: { en: 'Recommended', zh: '推荐' },
  files: { en: 'Code files', zh: '代码文件' },
  download: { en: 'Download', zh: '下载' },
  lines: { en: '{n} lines', zh: '{n} 行' },
  show_all: { en: 'Show all {n} lines', zh: '展开全部 {n} 行' },
  show_less: { en: 'Show less', zh: '收起' },
  copied_file: { en: '{name} copied', zh: '已复制 {name}' },
};
const s = (key: string, lang: Lang, vars: Record<string, string | number> = {}): string => S[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Files longer than this start folded to their first FOLD_TO lines. */
const FOLD_OVER = 24;
const FOLD_TO = 18;

const CSS = `
.lab-page{--mn-bg:#fbfbfa;--mn-fg:#15171a;--mn-muted:#6b7077;--mn-faint:#e7e7e3;--mn-panel:#fff;--mn-border:#e3e3de;--mn-accent:#2f5bd3;--mn-good:#1f8a5b;--mn-bad:#c2412d;--mn-warn:#b7791f;
 --mn-radius:14px;--mn-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06);--mn-code-bg:#f6f7f9;--mn-purple:#7c3aed;
 color:var(--mn-fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif}
.lab-page *,.lab-page *::before,.lab-page *::after{box-sizing:border-box}
.lab-page .mn-page{display:block}
.lab-page .mn-h,.lab-page .lab-file{scroll-margin-top:calc(var(--mn-sticky-top,0px) + 12px)}
.lab-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;max-width:1120px;margin:0 auto;align-items:start}
.lab-aside{display:none}
@media (min-width:1100px){
 .lab-layout.has-aside{grid-template-columns:minmax(0,1fr) 230px}
 .lab-layout.has-aside .lab-aside{display:block;position:sticky;top:calc(var(--mn-sticky-top,0px) + 12px);max-height:calc(100vh - var(--mn-sticky-top,0px) - 24px);overflow:auto;
  padding:14px;background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);box-shadow:var(--mn-shadow)}}
.lab-configs{margin-top:14px}
.lab-page .lab-configs-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--mn-muted);margin:0 0 6px;line-height:1.4}
.lab-configs ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
.lab-config{border:1px solid var(--mn-border);border-radius:10px;padding:8px 12px;background:var(--mn-panel);font-size:14px;line-height:1.45;min-width:0}
.lab-config.rec{border-color:color-mix(in srgb,var(--mn-accent) 45%,var(--mn-border));background:color-mix(in srgb,var(--mn-accent) 5%,var(--mn-panel))}
.lab-config-head{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px}
.lab-config-label{font-weight:650;color:var(--mn-fg)}
.lab-config-badge{font-size:11px;font-weight:700;letter-spacing:.04em;color:#fff;background:var(--mn-accent);border-radius:999px;padding:1px 8px;line-height:1.5}
.lab-config-gpu{color:var(--mn-muted);font-size:12.5px}
.lab-config-note{color:var(--mn-fg);opacity:.85;font-size:13.5px;margin-top:2px}
.lab-file .mn-code-head{flex-wrap:wrap;row-gap:4px}
.lab-file-name{font:600 13px/1.3 ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;color:var(--mn-fg);overflow-wrap:anywhere}
.lab-file-meta{font-size:12px;color:var(--mn-muted);white-space:nowrap}
.lab-page a.lab-dl{margin-left:0;color:var(--mn-fg);text-decoration:none;display:inline-flex;align-items:center}
.lab-page a.lab-dl:hover{border-color:var(--mn-fg)}
.lab-file-code.folded{max-height:calc(${FOLD_TO} * 1.6em + 12px);overflow-y:hidden;-webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}
.lab-file-more{display:block;width:100%;border:0;border-top:1px solid var(--mn-border);background:var(--mn-panel);color:var(--mn-accent);font:inherit;font-size:13px;font-weight:600;padding:9px 12px;cursor:pointer;text-align:center}
.lab-file-more:hover{background:var(--mn-faint)}
.lab-file-more:focus-visible,.lab-page a.lab-dl:focus-visible,.lab-page .mn-copy:focus-visible{outline:3px solid color-mix(in srgb,var(--mn-accent) 45%,transparent);outline-offset:1px}
.lab-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (max-width:640px){.lab-file .mn-code-head{padding:6px 6px 6px 10px}}
`;
let styled = false;
function inject_css(): void {
  inject_styles();
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

const MIME: Record<string, string> = { python: 'text/x-python', bash: 'text/x-sh', json: 'application/json', yaml: 'text/yaml' };

/** One code file: name, language and length, copy, download, and the code (folded when long). */
function file_html(f: LabFile, k: number, id: string, href: string, lang: Lang): string {
  const shown = f.code.replace(/\n$/, '');
  const n = shown.split('\n').length;
  const fold = n > FOLD_OVER;
  const fid = `${id}-f${k}`;
  return `<figure class="mn-codeblock lab-file" id="${fid}" data-file="${k}">
<div class="mn-code-head"><span class="lab-file-name" id="${fid}-name">${esc(f.name)}</span><span class="lab-file-meta">${f.lang === 'text' ? '' : `${esc(lang_label(f.lang))} · `}${esc(s('lines', lang, { n }))}</span>
<button type="button" class="mn-copy" aria-describedby="${fid}-name">${esc(t('copy', undefined, lang))}</button>
<a class="mn-copy lab-dl" href="${esc(href)}" download="${esc(f.name)}" aria-describedby="${fid}-name">${esc(s('download', lang))}</a></div>
<pre class="mn-code mn-numbered lab-file-code${fold ? ' folded' : ''}" id="${fid}-code" tabindex="0" aria-labelledby="${fid}-name"><code>${code_lines_html(shown, f.lang, true)}</code></pre>
${fold ? `<button type="button" class="lab-file-more" aria-expanded="false" aria-controls="${fid}-code" data-n="${n}">${esc(s('show_all', lang, { n }))}</button>` : ''}
</figure>`;
}

/** The recommended setups: label, the hardware, a short note; the recommended one marked in words, not only in colour. */
function configs_html(configs: LabConfig[], id: string, lang: Lang): string {
  const item = (c: LabConfig) => `<li class="lab-config${c.recommended ? ' rec' : ''}"><div class="lab-config-head">${c.recommended ? `<span class="lab-config-badge">${esc(s('recommended', lang))}</span>` : ''}<span class="lab-config-label">${esc(tr(c.label, lang))}</span><span class="lab-config-gpu">${esc(tr(c.gpu, lang))}</span></div><div class="lab-config-note">${esc(tr(c.note, lang))}</div></li>`;
  return `<section class="lab-configs" aria-labelledby="${id}-setups"><h2 class="lab-configs-title" id="${id}-setups">${esc(s('setups', lang))}</h2><ul>${configs.map(item).join('')}</ul></section>`;
}

async function copy_file(f: LabFile, pre: HTMLElement, btn: HTMLButtonElement, live: HTMLElement, lang: Lang): Promise<void> {
  let ok = true;
  try {
    await navigator.clipboard.writeText(f.code);
  } catch {
    ok = false;
    // no clipboard permission (e.g. an insecure origin): select the code instead
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  btn.textContent = t(ok ? 'copied' : 'copy_failed', undefined, lang);
  btn.classList.toggle('mn-copied', ok);
  live.textContent = ok ? s('copied_file', lang, { name: f.name }) : t('copy_failed', undefined, lang);
  setTimeout(() => {
    btn.textContent = t('copy', undefined, lang);
    btn.classList.remove('mn-copied');
  }, 1600);
}

/**
 * Renders the lab into `root` (replacing its content) in `lang`: the tutorial,
 * then its code files. Returns the cleanup to call when leaving the page (it
 * frees the files' download URLs).
 */
export function render_lab(root: HTMLElement, lab: LabModule, lang: Lang): () => void {
  inject_css();
  const step: ReadStep = { id: lab.slug, kind: 'read', title: lab.title, blocks: lab.blocks[lang] ?? lab.blocks.en };
  const page = read_page(step, s('kicker', lang, { id: lab.id }), { lang, lesson: `lab:${lab.slug}` });
  const el = page.el;
  const id = `lab-${lab.slug}`;

  // the recommended setups, under the title and reading time
  if (lab.configs?.length) el.querySelector('.mn-page-head')?.insertAdjacentHTML('beforeend', configs_html(lab.configs, id, lang));
  // numbered lists that go on after a code block keep counting
  const starts = lab.list_starts?.[lang];
  if (starts) el.querySelectorAll<HTMLOListElement>('.mn-prose ol.mn-list').forEach((ol, i) => {
    if ((starts[i] ?? 1) > 1) ol.start = starts[i];
  });
  // a source without a link (a document of the course) shows no empty link
  el.querySelectorAll<HTMLAnchorElement>('.mn-sources a.mn-src-link').forEach((a) => {
    if (!a.getAttribute('href')) a.remove();
  });

  // the code files, before the sources
  const urls = lab.files.map((f) => URL.createObjectURL(new Blob([f.code], { type: `${MIME[f.lang] ?? 'text/plain'};charset=utf-8` })));
  const section = document.createElement('section');
  section.className = 'lab-files';
  section.setAttribute('aria-labelledby', `${id}-files`);
  section.innerHTML = `<h2 class="mn-h" id="${id}-files">${esc(s('files', lang))}</h2>${lab.files.map((f, k) => file_html(f, k, id, urls[k], lang)).join('')}<span class="lab-sr" aria-live="polite"></span>`;
  const prose = el.querySelector<HTMLElement>('.mn-prose') ?? el;
  prose.insertBefore(section, prose.querySelector('.mn-sources'));
  const live = section.querySelector<HTMLElement>('.lab-sr')!;
  section.querySelectorAll<HTMLElement>('.lab-file').forEach((fig) => {
    const f = lab.files[+fig.dataset.file!];
    const pre = fig.querySelector<HTMLElement>('.lab-file-code')!;
    const btn = fig.querySelector<HTMLButtonElement>('.mn-copy')!;
    btn.onclick = () => void copy_file(f, pre, btn, live, lang);
    const more = fig.querySelector<HTMLButtonElement>('.lab-file-more');
    if (more) more.onclick = () => {
      const open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      pre.classList.toggle('folded', !open);
      more.textContent = open ? s('show_less', lang) : s('show_all', lang, { n: more.dataset.n! });
      if (!open && fig.getBoundingClientRect().top < 0) fig.scrollIntoView({ block: 'start' });
    };
  });

  // the outline (wide screens) also lists the code files
  const outline = page.aside.querySelector('ol');
  if (outline) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-outline-link';
    b.textContent = s('files', lang);
    b.onclick = () => section.querySelector('h2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    li.append(b);
    outline.append(li);
  }

  const wrap = document.createElement('div');
  wrap.className = 'lab-page';
  const layout = document.createElement('div');
  layout.className = 'lab-layout' + (outline ? ' has-aside' : '');
  layout.append(el);
  if (outline) {
    const aside = document.createElement('aside');
    aside.className = 'lab-aside';
    aside.append(page.aside);
    layout.append(aside);
  }
  wrap.append(layout);
  root.replaceChildren(wrap);
  return () => {
    page.dispose();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}
