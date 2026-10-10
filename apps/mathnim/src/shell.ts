// App chrome: navigation bar (with the language switch) + hash router.
import { LANGS, type Lang } from '@mathnim/core';
import { inject_styles, on_ui_lang, t, ui_lang } from '@mathnim/present';
import './i18n';
import { lesson_path } from './course';
import { intercept_links, legacy_path, navigate, parse, set_router, type Route } from './router';
import { learner } from './store';
import { load_settings, set_language } from './settings';

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
.nav .langs{margin-left:auto}
.langs{display:inline-flex;border:1px solid var(--mn-border);border-radius:999px;padding:2px;gap:2px;background:var(--mn-panel);flex:none}
.langs button{border:0;background:transparent;color:var(--mn-muted);font:inherit;font-size:12.5px;font-weight:600;padding:3px 10px;border-radius:999px;cursor:pointer;line-height:1.4}
.langs button[aria-pressed=true]{background:var(--mn-fg);color:var(--mn-bg)}
.langs button:focus-visible{outline:2px solid var(--mn-accent);outline-offset:1px}
.page{max-width:1500px;margin:0 auto;padding:24px}
/* home: continue learning, all courses */
.section-title{font-size:13px;letter-spacing:.02em;color:var(--mn-muted);margin:26px 0 12px;font-weight:600}
.page>.section-title:first-child{margin-top:4px}
.home-intro{font-size:18px;margin:4px 0 6px;color:var(--mn-fg)}
.resume-card{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:20px;align-items:center;text-decoration:none;color:inherit;border-left:4px solid var(--course-accent,var(--mn-accent))}
.resume-card:hover,.resume-row:hover,.course-card:hover{border-color:var(--mn-accent)}
.resume-card:hover{border-left-color:var(--course-accent,var(--mn-accent))}
.resume-thumb{width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--mn-border);background:linear-gradient(135deg,#f3f4f8,#e9ebf2);display:block}
.resume-text{display:flex;flex-direction:column;gap:8px;align-items:flex-start;min-width:0}
.resume-course{font-size:13px}
.resume-title{font-size:22px;font-weight:700;letter-spacing:-.01em;line-height:1.3}
.resume-text .course-progress{width:100%;max-width:360px}
.resume-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin-top:10px;text-decoration:none;color:inherit}
.resume-row-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.resume-row .mn-btn{flex:none}
.catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.course-card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;transition:transform .15s,border-color .15s;border-top:4px solid var(--course-accent,var(--mn-border))}
.course-card:hover{transform:translateY(-2px)}
.course-card .thumb{width:100%;aspect-ratio:16/9;border-radius:10px;background:linear-gradient(135deg,#f3f4f8,#e9ebf2);border:1px solid var(--mn-border);display:block;object-fit:cover}
.course-name{font-weight:700;font-size:19px;letter-spacing:-.01em}
.course-sum{font-size:14px}
.course-card .meta{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--mn-muted)}
.course-progress{height:4px;border-radius:2px;background:var(--mn-faint);overflow:hidden}
.course-progress i{display:block;height:100%;background:var(--mn-good)}
/* a course page */
.backlink{display:inline-block;font-size:14px;color:var(--mn-muted);text-decoration:none;margin:0 0 12px}
.backlink:hover{color:var(--mn-accent)}
.course-hero{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;border-top:4px solid var(--course-accent,var(--mn-accent))}
.course-hero.with-feature{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:center}
.course-hero h1{font-size:30px;letter-spacing:-.02em;margin:0 0 6px;line-height:1.2}
.hero-text{display:flex;flex-direction:column;gap:4px;min-width:0}
.hero-text p{margin:0}
.hero-sum{font-size:16px}
.hero-aud,.hero-size{font-size:13.5px}
.hero-go{margin:12px 0 6px}
.hero-go .mn-btn{text-decoration:none}
.hero-text .course-progress{max-width:420px}
.hero-feature{margin:0}
.hero-feature img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--mn-border);background:#fff}
.outcomes{margin-top:18px}
.outcomes .section-title{margin-top:0}
.outcomes ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;font-size:15px}
.lesson-title{font-weight:600;font-size:16px;display:flex;gap:8px;align-items:baseline}
.lesson-title .status{flex:none;font-size:13px;width:16px;text-align:center;color:var(--mn-muted)}
.status-done .lesson-title .status{color:var(--mn-good)}
.status-started .lesson-title .status{color:var(--mn-accent)}
.kinds{display:inline-flex;gap:5px;color:var(--mn-muted);align-items:center}
.labs-soon{font-size:14px}
.hero-pre{margin:6px 0 2px;font-size:13.5px}
.hero-pre-sum{margin:0;color:var(--mn-muted);line-height:1.5}
.pre-links{margin-top:4px}
.pre-links summary{cursor:pointer;color:var(--mn-accent);font-weight:600;width:max-content;list-style:none;display:inline-flex;align-items:center;gap:6px}
.pre-links summary::-webkit-details-marker{display:none}
.pre-links summary::before{content:"";width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg);transition:transform .15s}
.pre-links[open] summary::before{transform:rotate(45deg) translate(-1px,-1px)}
.pre-links ul{margin:8px 0 2px;padding-left:1.15em;display:flex;flex-direction:column;gap:5px}
.pre-links a{color:var(--mn-fg);font-weight:600;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--mn-accent) 45%,transparent);text-underline-offset:2px}
.pre-links a:hover{color:var(--mn-accent)}
.lab-card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;transition:transform .15s,border-color .15s}
.lab-card:hover{transform:translateY(-2px);border-color:var(--mn-accent)}
.lab-head{display:flex;gap:8px;align-items:baseline}
.lab-id{flex:none;font:600 12px ui-monospace,Menlo,monospace;color:#7C3AED;background:color-mix(in srgb,#7C3AED 10%,transparent);padding:2px 6px;border-radius:6px}
.lab-head .lesson-title{display:block}
.lab-sum{font-size:13.5px;line-height:1.5}
.lab-card .meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mn-muted);margin-top:auto}
.lab-after{font-size:13.5px;margin:-4px 0 12px}
.lab-after a{color:var(--mn-accent)}
/* the breadcrumb above a lesson */
.crumb{font-size:13px;color:var(--mn-muted);margin:0 0 10px}
.crumb a{color:var(--mn-muted);text-decoration:none}
.crumb a:hover{color:var(--mn-accent);text-decoration:underline}
.tag.done-tag{background:color-mix(in srgb,var(--mn-good) 12%,transparent);color:var(--mn-good)}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:start}
.card{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);padding:18px;box-shadow:var(--mn-shadow)}
.card h2{margin:0 0 6px;font-size:18px}
.muted{color:var(--mn-muted)}
.units{display:flex;flex-direction:column;gap:22px;margin-top:26px}
.unit h3{margin:0 0 10px;font-size:15px;font-weight:650;letter-spacing:-.005em;color:var(--mn-fg)}
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
@media (max-width:900px){.hero,.grid2,.resume-card,.course-hero.with-feature{grid-template-columns:1fr}.bar{grid-template-columns:1fr 1fr 84px}}
@media (max-width:640px){.catalog{grid-template-columns:minmax(0,1fr)}.course-hero h1{font-size:24px}.resume-title{font-size:18px}.app-shell{--mn-sticky-top:52px}.nav{gap:14px;padding:12px 14px}.langs{margin-left:auto}.page{padding:16px 12px}
 .bar{grid-template-columns:1fr 84px;row-gap:4px}.bar .track{grid-column:1/-1;grid-row:2}}
/* phones: logo and language on top, a tab bar at the bottom (not inside lessons) */
.tabbar{display:none}
@media (max-width:699px){.nav .navlink{display:none}.langs{margin-left:auto}
 .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:6;background:color-mix(in srgb,var(--mn-panel) 94%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--mn-border);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
 .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:var(--mn-muted);text-decoration:none;position:relative;padding:2px 0}
 .tabbar a.on{color:var(--mn-accent);font-weight:600}
 .tabbar .count{position:absolute;top:-2px;left:58%}
 .app-shell:not(.in-lesson) .page{padding-bottom:88px}
 .in-lesson .tabbar{display:none}}
@media (max-width:420px){.nav .brand .name{display:none}.nav{gap:11px;padding:12px 10px}.nav a{font-size:13.5px}.langs button{padding:3px 7px}}
`;

export type Page = (root: HTMLElement, route: Route) => void | (() => void) | Promise<void | (() => void)>;
let cleanup: (() => void) | void;
let relocalizing = false;
/** True while the page is re-rendered for a new language (a lesson stays on its step). */
export const is_relocalizing = () => relocalizing;
const LANG_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文' };
const LOGO = '<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="var(--mn-accent)" stroke-width="3"/><path d="M6 22 L16 8 L26 22" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
const TAB_ICON: Record<string, string> = {
  home: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  review: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export function mount_shell(pages: Record<Route['page'], Page>): void {
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
  // phones: a bottom tab bar instead of the links in the top bar (hidden inside lessons)
  const tabs = document.createElement('nav');
  tabs.className = 'tabbar';
  app.append(nav, page, tabs);
  let current: Route = parse(location.pathname);
  const render_nav = () => {
    const here = current.page === 'course' || current.page === 'lesson' || current.page === 'lab' ? 'home' : current.page;
    const due = learner.due().length;
    const lang = ui_lang();
    const count = due ? `<span class="count">${due}</span>` : '';
    nav.innerHTML = `<a class="brand" href="/">${LOGO}<span class="name">Mathnim</span></a>
      <a href="/" class="navlink ${here === 'home' ? 'on' : ''}">${t('nav_courses')}</a>
      <a href="/review" class="navlink ${here === 'review' ? 'on' : ''}">${t('nav_review')}${count}</a>
      <a href="/dashboard" class="navlink ${here === 'dashboard' ? 'on' : ''}">${t('nav_dashboard')}</a>
      <a href="/settings" class="navlink ${here === 'settings' ? 'on' : ''}">${t('nav_settings')}</a>
      <span class="langs" role="group" aria-label="${t('language')} / Language">${LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${l === 'zh' ? 'zh-CN' : 'en'}" aria-pressed="${l === lang}">${LANG_LABEL[l]}</button>`).join('')}</span>`;
    nav.querySelectorAll<HTMLButtonElement>('.langs button').forEach((b) => (b.onclick = async () => {
      // switching to Chinese may first load the Chinese font for the visuals (a second or two, once)
      if (b.getAttribute('aria-pressed') === 'true') return;
      b.setAttribute('aria-busy', 'true');
      b.style.opacity = '0.6';
      await set_language(b.dataset.lang as Lang);
    }));
    const tab = (key: string, href: string, label: string, extra = '') => `<a href="${href}" class="${here === key ? 'on' : ''}"${here === key ? ' aria-current="page"' : ''}>${TAB_ICON[key]}<span>${label}</span>${extra}</a>`;
    tabs.innerHTML = tab('home', '/', t('nav_home')) + tab('review', '/review', t('nav_review'), count) + tab('dashboard', '/dashboard', t('nav_dashboard')) + tab('settings', '/settings', t('nav_settings'));
    app.classList.toggle('in-lesson', current.page === 'lesson' || current.page === 'lab');
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  };
  const route = async (keep_scroll = false) => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    current = parse(location.pathname);
    // one address per lesson: a lesson reached under another course's slug moves to its own
    if (current.page === 'lesson') {
      const canonical = lesson_path(current.lesson);
      if (canonical !== location.pathname) history.replaceState(null, '', canonical + location.search);
    }
    render_nav();
    page.innerHTML = '';
    if (!keep_scroll) window.scrollTo(0, 0);
    cleanup = await pages[current.page](page, current);
    // an anchor in the address (e.g. /llm-finetuning#labs) is scrolled to once the page is there
    if (!keep_scroll && location.hash.length > 1 && !location.hash.startsWith('#/')) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  };
  set_router(() => void route());
  intercept_links(document);
  window.addEventListener('popstate', () => void route());
  // old hash links (#/lesson/<id> ...) land on their new paths
  const legacy = legacy_path(location.hash);
  if (legacy) history.replaceState(null, '', legacy);
  window.addEventListener('hashchange', () => {
    const p = legacy_path(location.hash);
    if (p) navigate(p, true);
  });
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
