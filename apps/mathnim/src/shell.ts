// App chrome: navigation bar (with the language switch) + hash router.
import { LANGS, type Lang } from '@mathnim/core';
import { inject_styles, on_ui_lang, t, ui_lang } from '@mathnim/present';
import './i18n';
import { learner } from './store';
import { active_provider, load_settings, provider_label, set_language } from './settings';

const CSS = `
body{margin:0;background:#fbfbfa}
.app-shell{--mn-sticky-top:58px;--mn-bg:#fbfbfa;--mn-fg:#15171a;--mn-muted:#6b7077;--mn-faint:#ececE8;--mn-panel:#fff;--mn-border:#e3e3de;--mn-accent:#2f5bd3;--mn-good:#1f8a5b;--mn-bad:#c2412d;--mn-warn:#b7791f;--mn-radius:14px;--mn-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06);
 font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--mn-fg);background:var(--mn-bg);min-height:100vh}
.app-shell.dark{--mn-bg:#0d0f12;--mn-fg:#eef1f6;--mn-muted:#8d96a6;--mn-faint:#232830;--mn-panel:#14171c;--mn-border:#262b33;--mn-accent:#8fb0ff;--mn-shadow:none}
.nav{display:flex;align-items:center;gap:22px;padding:14px 24px;border-bottom:1px solid var(--mn-border);position:sticky;top:0;background:color-mix(in srgb,var(--mn-bg) 88%,transparent);backdrop-filter:blur(8px);z-index:5}
.nav .brand{font-weight:700;letter-spacing:-.02em;font-size:18px;display:flex;gap:8px;align-items:center;color:inherit;text-decoration:none}
.nav a{color:var(--mn-muted);text-decoration:none;font-size:14px;white-space:nowrap}
.nav a.on{color:var(--mn-fg);font-weight:600}
.nav .count{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:var(--mn-accent);color:#fff;font-size:11px;text-align:center;margin-left:4px}
.nav .mode{margin-left:auto;font-size:12px;color:var(--mn-muted);white-space:nowrap}
.langs{display:inline-flex;border:1px solid var(--mn-border);border-radius:999px;padding:2px;gap:2px;background:var(--mn-panel);flex:none}
.nav .mode+.langs{margin-left:0}
.langs button{border:0;background:transparent;color:var(--mn-muted);font:inherit;font-size:12.5px;font-weight:600;padding:3px 10px;border-radius:999px;cursor:pointer;line-height:1.4}
.langs button[aria-pressed=true]{background:var(--mn-fg);color:var(--mn-bg)}
.langs button:focus-visible{outline:2px solid var(--mn-accent);outline-offset:1px}
.page{max-width:1500px;margin:0 auto;padding:24px}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:start}
.card{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);padding:18px;box-shadow:var(--mn-shadow)}
.card h2{margin:0 0 6px;font-size:18px}
.muted{color:var(--mn-muted)}
.units{display:flex;flex-direction:column;gap:22px;margin-top:26px}
.unit h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--mn-muted)}
.lessons{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.lesson-card{display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:transform .15s,border-color .15s;text-decoration:none;color:inherit}
.lesson-card:hover{transform:translateY(-2px);border-color:var(--mn-accent)}
.lesson-card .thumb{width:100%;aspect-ratio:16/9;border-radius:10px;background:linear-gradient(135deg,#f3f4f8,#e9ebf2);border:1px solid var(--mn-border);display:block}
.lesson-card .thumb.empty{background:linear-gradient(135deg,color-mix(in srgb,var(--mn-accent) 10%,#fff),#f3f4f8)}
.lesson-card .meta{display:flex;justify-content:space-between;font-size:12px;color:var(--mn-muted)}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-muted)}
.tag.ai{background:color-mix(in srgb,var(--mn-accent) 12%,transparent);color:var(--mn-accent)}
.ring{display:flex;gap:4px}
.ring i{flex:1;height:5px;border-radius:3px;background:var(--mn-faint)}
.ring i.m{background:var(--mn-good)}.ring i.p{background:var(--mn-accent)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.stat{font-size:28px;font-weight:700;letter-spacing:-.02em}
.bars{display:flex;flex-direction:column;gap:10px}
.bar{display:grid;grid-template-columns:220px 1fr 84px;gap:12px;align-items:center;font-size:14px}
.bar>span:last-child{white-space:nowrap}.bar .track{height:8px;background:var(--mn-faint);border-radius:4px;overflow:hidden}.bar .track i{display:block;height:100%;background:var(--mn-accent)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.col{display:flex;flex-direction:column;gap:16px}
label.field{display:flex;flex-direction:column;gap:6px;font-size:14px}
@media (max-width:900px){.hero,.grid2{grid-template-columns:1fr}.bar{grid-template-columns:1fr 1fr 84px}}
@media (max-width:640px){.app-shell{--mn-sticky-top:52px}.nav{gap:14px;padding:12px 14px}.nav .mode{display:none}.langs{margin-left:auto}.page{padding:16px 12px}
 .bar{grid-template-columns:1fr 84px;row-gap:4px}.bar .track{grid-column:1/-1;grid-row:2}}
@media (max-width:420px){.nav .brand .name{display:none}.nav{gap:11px;padding:12px 10px}.nav a{font-size:13.5px}.langs button{padding:3px 7px}}
`;

export type Page = (root: HTMLElement, params: string[]) => void | (() => void) | Promise<void | (() => void)>;
let cleanup: (() => void) | void;
let relocalizing = false;
/** True while the page is re-rendered for a new language (a lesson stays on its step). */
export const is_relocalizing = () => relocalizing;
const LANG_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文' };

export function mount_shell(routes: Record<string, Page>): void {
  inject_styles();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app')!;
  app.className = 'app-shell' + (load_settings().dark ? ' dark' : '');
  const nav = document.createElement('nav');
  nav.className = 'nav';
  const page = document.createElement('main');
  page.className = 'page';
  app.append(nav, page);
  const render_nav = () => {
    const here = location.hash.split('/')[1] ?? '';
    const due = learner.due().length;
    const s = load_settings();
    const lang = ui_lang();
    nav.innerHTML = `<a class="brand" href="#/"><svg width="22" height="22" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="var(--mn-accent)" stroke-width="3"/><path d="M6 22 L16 8 L26 22" fill="none" stroke="currentColor" stroke-width="2.5"/></svg><span class="name">Mathnim</span></a>
      <a href="#/" class="${here === '' ? 'on' : ''}">${t('nav_learn')}</a>
      <a href="#/review" class="${here === 'review' ? 'on' : ''}">${t('nav_review')}${due ? `<span class="count">${due}</span>` : ''}</a>
      <a href="#/dashboard" class="${here === 'dashboard' ? 'on' : ''}">${t('nav_dashboard')}</a>
      <a href="#/settings" class="${here === 'settings' ? 'on' : ''}">${t('nav_settings')}</a>
      <span class="mode">${t('nav_ai', { p: provider_label(active_provider(s)) })}</span>
      <span class="langs" role="group" aria-label="${t('language')} / Language">${LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${l === 'zh' ? 'zh-CN' : 'en'}" aria-pressed="${l === lang}">${LANG_LABEL[l]}</button>`).join('')}</span>`;
    nav.querySelectorAll<HTMLButtonElement>('.langs button').forEach((b) => (b.onclick = async () => {
      // switching to Chinese may first load the Chinese font for the visuals (a second or two, once)
      if (b.getAttribute('aria-pressed') === 'true') return;
      b.setAttribute('aria-busy', 'true');
      b.style.opacity = '0.6';
      await set_language(b.dataset.lang as Lang);
    }));
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  };
  const route = async (keep_scroll = false) => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    const [, name = '', ...params] = location.hash.split('?')[0].split('/');
    render_nav();
    page.innerHTML = '';
    if (!keep_scroll) window.scrollTo(0, 0);
    const p = routes[name] ?? routes[''];
    cleanup = await p(page, params.map(decodeURIComponent));
  };
  window.addEventListener('hashchange', () => void route());
  // a new language re-renders the page in place (a lesson keeps its step, see pages/lesson.ts)
  on_ui_lang(async () => {
    relocalizing = true;
    const y = window.scrollY;
    try {
      await route(true);
    } finally {
      relocalizing = false;
    }
    window.scrollTo(0, y);
  });
  setInterval(render_nav, 30000);
  void route();
}
