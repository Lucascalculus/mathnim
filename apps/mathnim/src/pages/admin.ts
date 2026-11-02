// /data: the data centre. Five tabs over the numbers the server reads with SQL (server/admin.ts):
//   overview   the headline numbers of the range against the range before, each day as a chart, the latest questions
//   visitors   everyone, signed in or not: pages, landing pages, sources, countries, devices, languages, hours
//   learning   per course and lesson (signed-in learners): the hardest questions, misconceptions; one lesson page by page
//   AI         calls, tokens and cost per route; every question learners asked and the answer; feedback on answers
//   accounts   each learner and their record; uploaded courses
// Who sees what is the server's (NEED in server/admin.ts): the summaries, with no person in them, to everyone while
// they are public; each learner, their record and their words to teachers; exports, uploads and naming teachers to
// admins. The page leaves out what the viewer cannot open.
// Every view is an address (/data?tab=learning&lesson=…&days=30), so back and bookmarks work; what was fetched is
// kept for a minute, so moving between tabs is instant. Days are the site's local days (the server's STATS_TZ).
import { tr, type L10n, type Lesson } from '@mathnim/core';
import { esc, t, ui_lang } from '@mathnim/present';
import { current_user, data_available, is_staff } from '../account';
import { backlink } from '../backlink';
import { course_by_slug, ensure_lesson, find_course, find_lesson, lesson_path } from '../course';
import { navigate, parse } from '../router';
import { SHEET } from '../sheet';

type Row = Record<string, unknown>;
type Tab = 'overview' | 'traffic' | 'learning' | 'ai' | 'users';
const TABS: Tab[] = ['overview', 'traffic', 'learning', 'ai', 'users'];
const RANGES = [1, 7, 30, 90, 365, 0];
interface View {
  tab: Tab;
  days: number;
  lesson: string;
  user: string;
  q: string;
}

const CSS = `
.adm{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;padding-bottom:40px}
.adm [hidden]{display:none!important}
.ad-head{display:flex;align-items:flex-end;gap:14px 18px;flex-wrap:wrap}
.ad-head>div:first-child{flex:1;min-width:220px}
.ad-label{display:block;font:500 10.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--mn-fg) 55%,transparent)}
.adm h1{margin:2px 0 0;font-size:30px;letter-spacing:-.02em;line-height:1.2}
.ad-range{display:flex;gap:2px;padding:3px;border:1px solid var(--mn-border);border-radius:10px;background:var(--mn-panel)}
.ad-range a{padding:5px 10px;border-radius:7px;font-size:13px;color:var(--mn-muted);text-decoration:none;white-space:nowrap}
.ad-range a:hover{color:var(--mn-fg)}
.ad-range a.on{background:var(--mn-fg);color:var(--mn-bg)}
.ad-export{position:relative}
.ad-export>summary{list-style:none;font-size:13px;padding:7px 12px}
.ad-export>summary::-webkit-details-marker{display:none}
.ad-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;display:flex;flex-direction:column;min-width:210px;padding:6px!important}
.ad-menu a{padding:8px 10px;border-radius:7px;font-size:13.5px;color:var(--mn-fg);text-decoration:none}
.ad-menu a:hover{background:var(--mn-faint)}
.ad-menu a small{color:var(--mn-muted);font:500 10.5px ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:6px}
.ad-tabs{display:flex;gap:22px;border-bottom:1px solid var(--mn-border);overflow-x:auto;scrollbar-width:none}
.ad-tabs::-webkit-scrollbar{display:none}
.ad-tabs a{position:relative;padding:8px 0 10px;font-size:14.5px;font-weight:550;color:var(--mn-muted);text-decoration:none;white-space:nowrap}
.ad-tabs a:hover{color:var(--mn-fg)}
.ad-tabs a.on{color:var(--mn-fg)}
.ad-tabs a.on::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--mn-fg)}
.ad-body{display:flex;flex-direction:column;gap:18px;min-height:320px}
.ad-body.loading{opacity:.45;transition:opacity .2s .15s}
.ad-msg{margin:60px auto;color:var(--mn-muted);font-size:15px}
/* readouts: the chosen one is drawn on the engineering sheet */
.ad-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.ad-tile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;padding:12px 16px 14px;border:0;border-radius:2px;background:transparent;color:inherit;font:inherit;text-align:left}
button.ad-tile{cursor:pointer;transition:background-color .15s}
button.ad-tile:hover{background:color-mix(in srgb,var(--mn-fg) 4%,transparent)}
.ad-tile.on{${SHEET}}
.ad-tile .k{font-size:12.5px;line-height:1.35;color:var(--mn-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ad-tile .k small{display:block;min-height:1.35em;font-size:11px;opacity:.8;overflow:hidden;text-overflow:ellipsis}
.ad-tile b{font-size:27px;font-weight:620;letter-spacing:-.02em;line-height:1.25}
.ad-tile .d{font:500 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mn-muted)}
.ad-sec{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:12px;padding:16px 18px;min-width:0}
.ad-sec>h2{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;font-size:14.5px;font-weight:620}
.ad-sec>h2 small{font:500 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mn-muted);font-weight:500}
.ad-sec>h2 a{margin-left:auto;font-size:13px;font-weight:500;color:var(--mn-accent);text-decoration:none}
.ad-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}
.ad-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.ad-empty{margin:4px 0;color:var(--mn-muted);font-size:13.5px}
/* charts */
.ad-chart{position:relative;width:100%;min-height:40px;touch-action:pan-y}
.ad-chart svg{display:block;overflow:visible}
.ad-chart .grid{stroke:var(--mn-faint);stroke-width:1}
.ad-chart .tick{font:500 10.5px ui-monospace,SFMono-Regular,Menlo,monospace;fill:var(--mn-muted)}
.ad-chart .bar{fill:color-mix(in srgb,var(--mn-accent) 82%,var(--mn-panel))}
.ad-chart .bar.part{fill:color-mix(in srgb,var(--mn-accent) 38%,var(--mn-panel))}
.ad-chart .bar.on{fill:var(--mn-accent)}
.ad-chart .band{fill:color-mix(in srgb,var(--mn-fg) 5%,transparent)}
.ad-chart .line{fill:none;stroke:var(--mn-accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.ad-chart .area{fill:color-mix(in srgb,var(--mn-accent) 10%,transparent)}
.ad-chart .dot{fill:var(--mn-accent);stroke:var(--mn-panel);stroke-width:2}
.ad-tip{position:absolute;top:2px;transform:translateX(-50%);pointer-events:none;padding:6px 10px;border-radius:8px;background:var(--mn-panel);border:1px solid var(--mn-border);box-shadow:var(--mn-shadow);font-size:12.5px;line-height:1.45;white-space:nowrap;z-index:5}
.ad-tip b{font-size:14px}
/* tables */
.ad-scroll{overflow-x:auto;margin:0 -4px;padding:0 4px}
.ad-table{width:100%;border-collapse:collapse;font-size:13.5px}
.ad-table th{position:sticky;top:0;text-align:left;font-weight:500;font-size:12px;color:var(--mn-muted);padding:0 10px 8px 0;white-space:nowrap;border-bottom:1px solid var(--mn-border)}
.ad-table td{padding:8px 10px 8px 0;border-bottom:1px solid var(--mn-faint);vertical-align:top}
.ad-table tr:last-child td{border-bottom:0}
.ad-table .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ad-table td.name{position:relative;min-width:180px;max-width:420px}
.ad-table td.name a{color:var(--mn-fg);text-decoration:none}
.ad-table td.name a:hover{color:var(--mn-accent)}
.ad-table td.name small{display:block;color:var(--mn-muted);font-size:12px;margin-top:1px}
.ad-share{display:block;height:3px;margin-top:5px;border-radius:2px;background:color-mix(in srgb,var(--mn-accent) 55%,var(--mn-panel));min-width:2px}
.ad-mono{font:500 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mn-muted)}
.ad-yes{color:var(--mn-good)}
.ad-no{color:var(--mn-bad)}
/* courses that open into their lessons */
.ad-course{border-top:1px solid var(--mn-faint)}
.ad-course:first-of-type{border-top:0}
.ad-course>summary{display:grid;grid-template-columns:minmax(0,1fr) repeat(6,minmax(62px,auto));gap:10px;align-items:baseline;padding:11px 0;cursor:pointer;list-style:none;font-size:13.5px}
.ad-course>summary::-webkit-details-marker{display:none}
.ad-course>summary b{font-weight:600;font-size:14px}
.ad-course>summary b::before{content:'›';display:inline-block;width:14px;color:var(--mn-muted);transition:transform .2s}
.ad-course[open]>summary b::before{transform:rotate(90deg)}
.ad-course>summary span{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ad-course>summary span small{display:block;font-size:11px;color:var(--mn-muted)}
.ad-course>.ad-scroll{padding:0 0 12px 14px}
/* questions */
.ad-qs{display:flex;flex-direction:column}
.ad-q{padding:12px 0;border-top:1px solid var(--mn-faint)}
.ad-q:first-child{border-top:0;padding-top:2px}
.ad-q p{margin:0;font-size:14.5px;line-height:1.55}
.ad-q blockquote{margin:0 0 4px;padding-left:10px;border-left:2px solid color-mix(in srgb,var(--mn-warn) 60%,transparent);color:var(--mn-muted);font-size:13px}
.ad-q .meta{margin-top:4px;font-size:12px;color:var(--mn-muted)}
.ad-q .meta a{color:inherit}
.ad-q details{margin-top:6px}
.ad-q summary{font-size:12.5px;color:var(--mn-accent);cursor:pointer}
.ad-q .ans{margin-top:6px;padding:10px 12px;border-radius:8px;background:var(--mn-code-bg);font-family:ui-serif,Georgia,'Songti SC',serif;font-size:14px;line-height:1.6;white-space:pre-wrap;max-height:320px;overflow:auto}
.ad-search{display:flex;gap:8px;margin-bottom:12px}
.ad-search .mn-input{height:36px;padding:0 12px;font-size:14px;border-radius:9px;max-width:420px}
.ad-search .mn-btn{height:36px;padding:0 14px;font-size:13.5px}
.ad-more{align-self:flex-start;margin-top:10px;font-size:13px;padding:6px 12px}
.ad-sub{display:flex;align-items:flex-end;gap:12px 18px;flex-wrap:wrap}
.ad-sub>div{flex:1;min-width:240px}
.ad-sub h2{margin:4px 0 0;font-size:22px;letter-spacing:-.01em;line-height:1.3;overflow-wrap:anywhere}
.ad-sub p{margin:2px 0 0;font-size:13px;color:var(--mn-muted)}
.ad-sub .mn-btn{font-size:13px;text-decoration:none}
.ad-ev td:first-child{white-space:nowrap;color:var(--mn-muted);font-size:12.5px}
.ad-role{font:inherit;font-size:13px;padding:3px 6px;border:1px solid var(--mn-border);border-radius:7px;background:var(--mn-panel);color:var(--mn-fg)}
@media (max-width:640px){
  .adm h1{font-size:25px}
  .ad-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ad-tile{padding:10px 12px 12px}
  .ad-tile b{font-size:23px}
  .ad-grid2,.ad-grid3{grid-template-columns:minmax(0,1fr)}
  .ad-sec{padding:14px 14px}
  .ad-course>summary{grid-template-columns:minmax(0,1fr) repeat(3,auto)}
  .ad-course>summary span:nth-of-type(n+4){display:none}
}
@media (prefers-reduced-motion:reduce){.ad-body.loading{transition:none}}
`;
let injected = false;

// ---------------------------------------------------------------- the address
function read_view(): View {
  const p = new URLSearchParams(location.search);
  const tab = p.get('tab') as Tab;
  const d = Number(p.get('days') ?? 30);
  return { tab: TABS.includes(tab) ? tab : 'overview', days: RANGES.includes(d) ? d : 30, lesson: p.get('lesson') ?? '', user: p.get('user') ?? '', q: p.get('q') ?? '' };
}
/** The address of a view: the tab and range of `base`, with `v` on top (a lesson, a learner and a search belong to one view). */
function href(v: Partial<View>, base: View): string {
  const x: View = { ...base, lesson: '', user: '', q: '', ...v };
  const p = new URLSearchParams();
  if (x.tab !== 'overview') p.set('tab', x.tab);
  if (x.days !== 30) p.set('days', String(x.days));
  if (x.lesson) p.set('lesson', x.lesson);
  if (x.user) p.set('user', x.user);
  if (x.q) p.set('q', x.q);
  const s = p.toString();
  return `/data${s ? `?${s}` : ''}`;
}

// ---------------------------------------------------------------- fetching
class Refused extends Error {}
const kept = new Map<string, { t: number; p: Promise<Row> }>();
function load(section: string, params: Record<string, string | number> = {}): Promise<Row> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)])).toString();
  const url = `/api/admin/${section}${qs ? `?${qs}` : ''}`;
  const had = kept.get(url);
  if (had && Date.now() - had.t < 60_000) return had.p;
  const p = fetch(url, { credentials: 'same-origin' }).then(async (r) => {
    if (r.status === 401 || r.status === 403) throw new Refused();
    if (!r.ok) throw new Error(`${r.status}`);
    return (await r.json()) as Row;
  });
  p.catch(() => kept.delete(url));
  kept.set(url, { t: Date.now(), p });
  return p;
}

// ---------------------------------------------------------------- formats
const N = (v: unknown) => Number(v ?? 0) || 0;
const S = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const rows = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);
const loc = () => (ui_lang() === 'zh' ? 'zh-CN' : 'en-AU');
const int = (v: unknown) => N(v).toLocaleString(loc());
const compact = (v: unknown) => new Intl.NumberFormat(loc(), { notation: 'compact', maximumFractionDigits: 1 }).format(N(v));
const pct = (a: unknown, b: unknown) => (N(b) ? `${Math.round((100 * N(a)) / N(b))}%` : '—');
function usd(v: unknown): string {
  const x = N(v);
  if (!x) return '$0';
  return x < 0.01 ? `$${x.toFixed(4)}` : x < 10 ? `$${x.toFixed(3)}` : `$${x.toFixed(2)}`;
}
function dur(ms: unknown): string {
  const x = N(ms), zh = ui_lang() === 'zh';
  if (!x) return '—';
  if (x < 60_000) return `${Math.round(x / 1000)}${zh ? ' 秒' : ' s'}`;
  if (x < 3_600_000) return `${(x / 60_000).toFixed(x < 600_000 ? 1 : 0)}${zh ? ' 分钟' : ' min'}`;
  return `${(x / 3_600_000).toFixed(1)}${zh ? ' 小时' : ' h'}`;
}
const day_label = (d: string, o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => new Date(`${d}T00:00:00Z`).toLocaleDateString(loc(), { ...o, timeZone: 'UTC' });
const date = (ms: unknown) => (N(ms) ? new Date(N(ms)).toLocaleDateString(loc(), { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
function when(ms: unknown): string {
  const x = N(ms);
  if (!x) return '—';
  const s = (x - Date.now()) / 1000, rt = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  if (Math.abs(s) < 60) return rt.format(0, 'second');
  if (Math.abs(s) < 3600) return rt.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86_400) return rt.format(Math.round(s / 3600), 'hour');
  if (Math.abs(s) < 7 * 86_400) return rt.format(Math.round(s / 86_400), 'day');
  return new Date(x).toLocaleString(loc(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** A moment in a record: the time today, the date and time before. */
function stamp(ms: unknown): string {
  const d = new Date(N(ms));
  if (!N(ms)) return '—';
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString(loc(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
}
const L = (x: L10n | undefined, fallback = '') => (x ? tr(x, ui_lang()) : fallback);

// ---------------------------------------------------------------- names
const course_name = (id: unknown) => {
  const c = id ? find_course(String(id)) : undefined;
  return c ? L(c.title) : S(id) || '—';
};
const lesson_name = (id: unknown) => {
  const cl = find_lesson(String(id ?? ''));
  return cl ? L(cl.title) : S(id) || '—';
};
/** A page of the site by its address. */
function page_name(path: string): { title: string; sub?: string } {
  if (path === '/') return { title: t('nav_home') };
  if (path === '/studio/*') return { title: t('my_studio'), sub: '/studio/…' };
  const r = parse(path);
  switch (r.page) {
    case 'course':
      return { title: L(r.course.title), sub: path };
    case 'lesson':
      return { title: lesson_name(r.lesson), sub: L(r.course.title) };
    case 'lab':
      return { title: r.lab, sub: L(r.course.title) };
    case 'studio':
      return { title: t('my_studio') };
    case 'review':
    case 'settings':
      return { title: t(`nav_${r.page}`) };
    default:
      return { title: path };
  }
}
/** A lesson's pages by id: their titles (or their number), in order, and its misconceptions. */
interface LessonNames {
  lesson: Lesson | null;
  steps: Map<string, { n: number; title: string }>;
  misc: Map<string, string>;
}
const named = new Map<string, Promise<LessonNames>>();
function lesson_names(id: string): Promise<LessonNames> {
  let p = named.get(id);
  if (!p) {
    const cl = find_lesson(id);
    p = (cl ? ensure_lesson(cl) : Promise.resolve(null))
      .catch(() => null)
      .then((lesson) => ({
        lesson,
        steps: new Map((lesson?.steps ?? []).map((s, i) => [s.id, { n: i + 1, title: L(s.title, '') }])),
        misc: new Map((lesson?.misconceptions ?? []).map((m) => [m.id, L(m.description)])),
      }));
    named.set(id, p);
  }
  return p;
}
async function names_of(ids: unknown[]): Promise<Map<string, LessonNames>> {
  const list = [...new Set(ids.map(S).filter(Boolean))];
  return new Map(await Promise.all(list.map(async (id) => [id, await lesson_names(id)] as const)));
}
const step_name = (ln: LessonNames | undefined, step: unknown) => {
  const s = ln?.steps.get(S(step));
  const page = ui_lang() === 'zh' ? `第 ${s?.n} 页` : `p. ${s?.n}`;
  return s ? (s.title ? `${page} · ${s.title}` : page) : S(step) || '—';
};

// ---------------------------------------------------------------- pieces
interface Tile {
  k: string;
  label: string;
  sub?: string;
  value: string;
  delta?: string;
}
function tiles(list: Tile[], pick?: string): string {
  return `<div class="ad-tiles">${list
    .map((x) => {
      const inner = `<span class="k">${esc(x.label)}<small>${esc(x.sub ?? '')}</small></span><b>${esc(x.value)}</b>${x.delta ? `<span class="d">${esc(x.delta)}</span>` : ''}`;
      return pick === undefined ? `<div class="ad-tile">${inner}</div>` : `<button type="button" class="ad-tile${x.k === pick ? ' on' : ''}" data-k="${esc(x.k)}" aria-pressed="${x.k === pick}" aria-label="${esc(`${x.label} ${x.value}`)}">${inner}</button>`;
    })
    .join('')}</div>`;
}
/** "↑ 12% vs the 30 days before" (nothing for "everything"). */
function delta(now: unknown, before: unknown, days: number, fmt: (v: unknown) => string = int): string | undefined {
  if (!days || before === undefined || before === null) return undefined;
  const a = N(now), b = N(before);
  const vs = days === 1 ? t('ad_vs_day') : t('ad_vs', { n: days });
  if (!b) return a ? `+${fmt(a)} ${vs}` : undefined;
  const d = Math.round(((a - b) / b) * 100);
  return `${d > 0 ? '↑' : d < 0 ? '↓' : '='} ${Math.abs(d)}% ${vs}`;
}
const section = (title: string, body: string, o: { count?: string; link?: string } = {}) =>
  `<section class="ad-sec"><h2>${esc(title)}${o.count ? ` <small>${esc(o.count)}</small>` : ''}${o.link ?? ''}</h2>${body}</section>`;
const empty = () => `<p class="ad-empty">${esc(t('ad_none'))}</p>`;
interface Col {
  h: string;
  num?: boolean;
  cls?: string;
  cell: (r: Row) => string;
}
function table(cols: Col[], list: Row[], cls = ''): string {
  if (!list.length) return empty();
  return `<div class="ad-scroll"><table class="ad-table ${cls}"><thead><tr>${cols.map((c) => `<th${c.num ? ' class="n"' : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${list
    .map((r) => `<tr>${cols.map((c) => `<td class="${[c.num ? 'n' : '', c.cls ?? ''].join(' ').trim()}">${c.cell(r)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}
const share = (v: unknown, max: number) => (max && N(v) > 0 ? `<i class="ad-share" style="width:${Math.max(1, Math.round((100 * N(v)) / max))}%"></i>` : '');

/** A round top for the axis: 1, 2, 4, 6, 8 or 10 times a power of ten (whole numbers stay whole at the half-way line). */
function nice(max: number, whole: boolean): number {
  if (max <= 0) return whole ? 2 : 1;
  const m = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 4, 6, 8, 10].map((f) => f * m).find((v) => v >= max) ?? 10 * m;
  return whole ? Math.max(2, Math.ceil(top / 2) * 2) : top;
}
interface Bar {
  label: string;
  value: number;
  tip: string;
}
/**
 * One series by day (or hour): thin bars from one baseline (a line once they would be thinner than 4 px), three
 * recessive grid lines, and a tip for the bar under the pointer. The last bar can be drawn lighter: today, not over.
 */
function chart(bars: Bar[], o: { fmt: (v: number) => string; whole: boolean; part_last?: boolean; height?: number; ticks?: number[] }, observers: ResizeObserver[]): HTMLElement {
  const host = document.createElement('div');
  host.className = 'ad-chart';
  const H = o.height ?? 190, top = 12, bottom = 22, right = 46;
  let drawn = 0;
  const draw = () => {
    const W = Math.floor(host.clientWidth);
    if (!W || W === drawn) return;
    drawn = W;
    const n = bars.length, plot = W - right, slot = plot / Math.max(n, 1), base = H - bottom;
    const max = nice(Math.max(0, ...bars.map((b) => b.value)), o.whole);
    const y = (v: number) => top + (base - top) * (1 - v / max);
    const grid = [0, max / 2, max].map((v) => `<line class="grid" x1="0" x2="${plot}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${W}" y="${y(v) + 3.5}" text-anchor="end">${esc(o.fmt(v))}</text>`).join('');
    let marks = '';
    if (slot >= 4) {
      const bw = Math.min(24, slot - 2);
      bars.forEach((b, i) => {
        if (b.value <= 0) return;
        const x = i * slot + (slot - bw) / 2, ty = Math.min(y(b.value), base - 1.5), r = Math.min(4, bw / 2, base - ty);
        marks += `<path class="bar${o.part_last && i === n - 1 ? ' part' : ''}" data-i="${i}" d="M${x},${base}V${ty + r}Q${x},${ty} ${x + r},${ty}H${x + bw - r}Q${x + bw},${ty} ${x + bw},${ty + r}V${base}Z"/>`;
      });
    } else {
      const pts = bars.map((b, i) => `${(i * slot + slot / 2).toFixed(1)},${y(b.value).toFixed(1)}`);
      marks = `<path class="area" d="M${(slot / 2).toFixed(1)},${base}L${pts.join('L')}L${((n - 1) * slot + slot / 2).toFixed(1)},${base}Z"/><path class="line" d="M${pts.join('L')}"/><circle class="dot" r="4" cx="0" cy="0" opacity="0"/>`;
    }
    const at = (o.ticks ?? [0, Math.round((n - 1) / 2), n - 1]).filter((i, k, a) => i >= 0 && i < n && a.indexOf(i) === k);
    const xl = at.map((i) => `<text class="tick" x="${Math.min(Math.max(i * slot + slot / 2, 18), plot - 18)}" y="${H - 5}" text-anchor="middle">${esc(bars[i].label)}</text>`).join('');
    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect class="band" x="0" y="${top}" width="${slot}" height="${base - top}" opacity="0"/>${grid}${marks}${xl}<rect class="hit" x="0" y="0" width="${plot}" height="${H}" fill="transparent"/></svg><div class="ad-tip" hidden></div>`;
    const tip = host.querySelector<HTMLElement>('.ad-tip')!, band = host.querySelector('.band')!, hit = host.querySelector('.hit')!, dot = host.querySelector('.dot');
    const show = (e: PointerEvent) => {
      const i = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - hit.getBoundingClientRect().left) / slot)));
      band.setAttribute('x', String(i * slot));
      band.setAttribute('opacity', '1');
      host.querySelector('.bar.on')?.classList.remove('on');
      host.querySelector(`.bar[data-i="${i}"]`)?.classList.add('on');
      dot?.setAttribute('cx', String(i * slot + slot / 2));
      dot?.setAttribute('cy', String(y(bars[i].value)));
      dot?.setAttribute('opacity', '1');
      tip.innerHTML = bars[i].tip;
      tip.hidden = false;
      tip.style.left = `${Math.min(Math.max(i * slot + slot / 2, tip.offsetWidth / 2), W - tip.offsetWidth / 2)}px`;
    };
    hit.addEventListener('pointermove', show as EventListener);
    hit.addEventListener('pointerdown', show as EventListener);
    hit.addEventListener('pointerleave', () => {
      tip.hidden = true;
      band.setAttribute('opacity', '0');
      host.querySelector('.bar.on')?.classList.remove('on');
      dot?.setAttribute('opacity', '0');
    });
  };
  const ro = new ResizeObserver(draw);
  ro.observe(host);
  observers.push(ro);
  return host;
}
/** Days as bars of one measure, with "Mon 2 Nov · 12 visitors" tips. */
function day_chart(daily: Row[], key: string, label: string, fmt: (v: number) => string, observers: ResizeObserver[]): HTMLElement {
  const bars = daily.map((d) => {
    const v = N(d[key]);
    return { label: day_label(S(d.day)), value: v, tip: `${esc(day_label(S(d.day), { weekday: 'short', month: 'short', day: 'numeric' }))}<br><b>${esc(fmt(v))}</b> ${esc(label)}` };
  });
  return chart(bars, { fmt: key === 'cost' ? usd : (v) => compact(v), whole: key !== 'cost', part_last: true }, observers);
}

/** A list of questions to the tutor, each with where it was asked, who asked, and the answer folded away. */
function question_list(items: Row[], names: Map<string, LessonNames>, base: View): string {
  if (!items.length) return empty();
  return `<div class="ad-qs">${items
    .map((x) => {
      const ln = names.get(S(x.lesson));
      const where = `<a href="${esc(href({ tab: 'learning', lesson: S(x.lesson) }, base))}">${esc(lesson_name(x.lesson))}</a>${x.step ? ` · ${esc(step_name(ln, x.step))}` : ''}`;
      const who = x.user ? `<a href="${esc(href({ tab: 'users', user: S(x.user) }, base))}">${esc(S(x.email) || S(x.user))}</a>` : '';
      return `<div class="ad-q">${x.selected ? `<blockquote>${esc(S(x.selected))}</blockquote>` : ''}<p>${esc(S(x.q))}</p>
        <div class="meta">${where}${who ? ` · ${who}` : ''} · ${esc(when(x.t))}</div>
        ${x.a ? `<details><summary>${esc(t('ad_answer'))}</summary><div class="ans">${esc(S(x.a))}</div></details>` : ''}</div>`;
    })
    .join('')}</div>`;
}

// ---------------------------------------------------------------- the page
/** The chart each tab shows, as chosen by its readouts (kept while moving between tabs). */
const picked: Record<string, string> = { overview: 'visitors', traffic: 'visitors', ai: 'ai_calls' };

/** What the viewer may open: 1 the summaries, 2 a teacher (each learner, their words), 3 an admin (exports, uploads, roles). */
const level = () => (current_user()?.admin ? 3 : is_staff() ? 2 : 1);

export async function admin_page(root: HTMLElement): Promise<() => void> {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const observers: ResizeObserver[] = [];
  const done = () => observers.forEach((o) => o.disconnect());
  const v = read_view();
  const wrap = document.createElement('div');
  wrap.className = 'adm';
  root.append(wrap);
  if (!data_available()) {
    wrap.innerHTML = `<p class="ad-msg">${esc(t('ad_staff_only'))}</p>`;
    return done;
  }
  const tabs = TABS.filter((x) => x !== 'users' || level() >= 2);
  if (!tabs.includes(v.tab)) v.tab = 'overview';
  const range_label = (d: number) => (d === 1 ? t('ad_today') : d === 365 ? t('ad_year') : d === 0 ? t('ad_all') : t('ad_days', { n: d }));
  const tab_label: Record<Tab, string> = { overview: t('ad_tab_overview'), traffic: t('ad_tab_traffic'), learning: t('ad_tab_learning'), ai: t('ad_tab_ai'), users: t('ad_tab_users') };
  wrap.innerHTML = `
    <div class="ad-head">
      <div><span class="ad-label">Mathnim · data · <span class="ad-tz"></span></span><h1>${esc(t('ad_title'))}</h1></div>
      <nav class="ad-range">${RANGES.map((d) => `<a href="${esc(href({ days: d, lesson: v.lesson, user: v.user, q: v.q }, v))}"${d === v.days ? ' class="on" aria-current="true"' : ''}>${esc(range_label(d))}</a>`).join('')}</nav>
      ${
        level() >= 3
          ? `<details class="ad-export"><summary class="mn-btn">${esc(t('ad_export'))}</summary><div class="ad-menu card">${['events', 'hits', 'usage', 'users']
              .map((k) => `<a href="/api/admin/export?kind=${k}&days=${v.days}" download>${esc(t(`ad_x_${k}`))}<small>CSV</small></a>`)
              .join('')}</div></details>`
          : ''
      }
    </div>
    <nav class="ad-tabs">${tabs.map((x) => `<a href="${esc(href({ tab: x }, v))}"${x === v.tab ? ' class="on" aria-current="page"' : ''}>${esc(tab_label[x])}</a>`).join('')}</nav>
    <div class="ad-body loading"></div>`;
  const body = wrap.querySelector<HTMLElement>('.ad-body')!;
  const export_menu = wrap.querySelector<HTMLDetailsElement>('.ad-export');
  const close_menu = (e: Event) => {
    if (export_menu?.open && !export_menu.contains(e.target as Node)) export_menu.open = false;
  };
  document.addEventListener('pointerdown', close_menu);
  try {
    const views: Record<Tab, (v: View, body: HTMLElement, obs: ResizeObserver[]) => Promise<string | undefined>> = { overview, traffic, learning, ai, users };
    const tz = await views[v.tab](v, body, observers);
    wrap.querySelector('.ad-tz')!.textContent = tz ?? '';
  } catch (e) {
    body.innerHTML = `<p class="ad-msg">${esc(t(e instanceof Refused ? 'ad_staff_only' : 'ad_failed'))}</p>`;
  }
  body.classList.remove('loading');
  return () => {
    done();
    document.removeEventListener('pointerdown', close_menu);
  };
}
const tz_of = (d: Row) => S((d.range as Row | undefined)?.tz).replace(/_/g, ' ');

/** Readouts that choose the chart under them. */
function picker(host: HTMLElement, tab: string, list: Tile[], daily: Row[], fmt: Record<string, (v: number) => string>, observers: ResizeObserver[]): void {
  if (!list.some((x) => x.k === picked[tab])) picked[tab] = list[0].k;
  host.innerHTML = `${tiles(list, picked[tab])}<section class="ad-sec ad-main-chart"></section>`;
  const box = host.querySelector<HTMLElement>('.ad-main-chart')!;
  const show = () => {
    const x = list.find((y) => y.k === picked[tab])!;
    box.replaceChildren(day_chart(daily, x.k, x.label, fmt[x.k] ?? int, observers));
  };
  host.querySelectorAll<HTMLButtonElement>('.ad-tile').forEach((b) =>
    b.addEventListener('click', () => {
      picked[tab] = b.dataset.k!;
      host.querySelectorAll('.ad-tile').forEach((y) => {
        y.classList.toggle('on', y === b);
        y.setAttribute('aria-pressed', String(y === b));
      });
      show();
    }),
  );
  show();
}

// ---------------------------------------------------------------- overview
async function overview(v: View, body: HTMLElement, obs: ResizeObserver[]): Promise<string> {
  const words = level() >= 2;
  const [ov, qs] = await Promise.all([load('overview', { days: v.days }), words ? load('questions', { days: v.days }) : Promise.resolve({} as Row)]);
  const now = (ov.totals ?? {}) as Row, before = ov.previous as Row | null, daily = rows(ov.daily);
  const d = (k: string) => delta(now[k], before?.[k], v.days, k === 'cost' ? usd : int);
  const list: Tile[] = [
    { k: 'visitors', label: t('ad_visitors'), sub: t('ad_visitors_sub'), value: int(now.visitors), delta: d('visitors') },
    { k: 'views', label: t('ad_views'), value: int(now.views), delta: d('views') },
    { k: 'learners', label: t('ad_learners'), sub: t('ad_learners_sub'), value: int(now.learners), delta: d('learners') },
    { k: 'signups', label: t('ad_signups'), value: int(now.signups), delta: d('signups') },
    { k: 'asked', label: t('ad_questions'), value: int(now.asked), delta: d('asked') },
    { k: 'cost', label: t('ad_cost'), sub: t('ad_cost_sub'), value: usd(now.cost), delta: d('cost') },
  ];
  const top = document.createElement('div');
  top.style.display = 'contents';
  picker(top, 'overview', list, daily, { cost: usd }, obs);
  const items = rows(qs.items).slice(0, 6);
  const names = await names_of(items.map((x) => x.lesson));
  const learning = [
    [t('ad_answers'), int(now.answered)],
    [t('ad_right'), pct(now.correct, now.answered)],
    [t('ad_finished'), int(now.completed)],
    [t('ad_time'), dur(now.time_ms)],
    [t('ad_accounts'), int(now.users)],
  ];
  const rest = document.createElement('div');
  rest.className = 'ad-grid2';
  rest.innerHTML =
    (words ? section(t('ad_recent_q'), question_list(items, names, v), { link: `<a href="${esc(href({ tab: 'ai' }, v))}">${esc(t('ad_all_q'))} →</a>` }) : '') +
    section(t('ad_tab_learning'), table([{ h: '', cell: (r) => esc(S(r[0])) }, { h: '', num: true, cell: (r) => `<b>${esc(S(r[1]))}</b>` }], learning.map((x) => ({ ...x }) as unknown as Row)).replace(/<thead>.*?<\/thead>/, ''), {
      link: `<a href="${esc(href({ tab: 'learning' }, v))}">${esc(t('ad_tab_learning'))} →</a>`,
    });
  body.replaceChildren(top, rest);
  return tz_of(ov);
}

// ---------------------------------------------------------------- visitors
async function traffic(v: View, body: HTMLElement, obs: ResizeObserver[]): Promise<string> {
  const d = await load('traffic', { days: v.days });
  const daily = rows(d.daily);
  const sum = (k: string) => daily.reduce((n, x) => n + N(x[k]), 0);
  const members = rows(d.members);
  const mem = members.reduce((n, x) => n + (N(x.member) ? N(x.visitors) : 0), 0), all = members.reduce((n, x) => n + N(x.visitors), 0);
  const top = document.createElement('div');
  top.style.display = 'contents';
  picker(
    top,
    'traffic',
    [
      { k: 'visitors', label: t('ad_visitors'), sub: t('ad_visitors_sub'), value: int(sum('visitors')) },
      { k: 'views', label: t('ad_views'), value: int(sum('views')) },
    ],
    daily,
    {},
    obs,
  );
  top.querySelector('.ad-tiles')!.insertAdjacentHTML('beforeend', tiles([{ k: 'm', label: t('ad_signed_in'), value: pct(mem, all) }]).replace(/^<div class="ad-tiles">|<\/div>$/g, ''));
  const pages = rows(d.pages), maxp = Math.max(0, ...pages.map((x) => N(x.visitors)));
  const name_cell = (path: unknown, max: number, val: unknown) => {
    const p = page_name(S(path));
    const link = S(path).includes('*') ? esc(p.title) : `<a href="${esc(S(path))}">${esc(p.title)}</a>`;
    return `${link}${p.sub ? `<small>${esc(p.sub)}</small>` : ''}${share(val, max)}`;
  };
  const countries = new Intl.DisplayNames([loc()], { type: 'region' });
  const share_table = (list: Row[], label: (x: Row) => string) => {
    const max = Math.max(0, ...list.map((x) => N(x.visitors)));
    return table([{ h: '', cls: 'name', cell: (x) => `${esc(label(x))}${share(x.visitors, max)}` }, { h: t('ad_visitors'), num: true, cell: (x) => int(x.visitors) }], list);
  };
  const device = (x: Row) => (x.device ? t(`ad_${S(x.device)}`) : t('ad_unknown'));
  const language = (x: Row) => (x.lang === 'zh' ? '中文' : x.lang === 'en' ? 'English' : t('ad_unknown'));
  const country = (x: Row) => {
    try {
      return x.country ? `${countries.of(S(x.country))} · ${S(x.country)}` : t('ad_unknown');
    } catch {
      return S(x.country);
    }
  };
  const hours = Array.from({ length: 24 }, (_, h) => N(rows(d.hours).find((x) => N(x.hour) === h)?.views));
  const rest = document.createElement('div');
  rest.style.display = 'contents';
  rest.innerHTML =
    section(
      t('ad_pages'),
      table(
        [
          { h: '', cls: 'name', cell: (x) => name_cell(x.path, maxp, x.visitors) },
          { h: t('ad_visitors'), num: true, cell: (x) => int(x.visitors) },
          { h: t('ad_views'), num: true, cell: (x) => int(x.views) },
        ],
        pages.slice(0, 60),
      ),
      { count: pages.length ? String(pages.length) : '' },
    ) +
    `<div class="ad-grid2">${section(t('ad_sources'), share_table(rows(d.refs), (x) => (x.ref === 'direct' ? t('ad_direct') : S(x.ref))))}${section(
      t('ad_entries'),
      table(
        [
          { h: '', cls: 'name', cell: (x) => name_cell(x.path, Math.max(0, ...rows(d.entries).map((y) => N(y.visitors))), x.visitors) },
          { h: t('ad_visitors'), num: true, cell: (x) => int(x.visitors) },
        ],
        rows(d.entries),
      ),
    )}</div>` +
    `<div class="ad-grid3">${section(t('ad_countries'), share_table(rows(d.countries), country))}${section(t('ad_devices'), share_table(rows(d.devices), device))}${section(
      t('ad_language'),
      share_table(rows(d.langs), language),
    )}</div>` +
    `<section class="ad-sec ad-hours"><h2>${esc(t('ad_hours'))} <small>${esc(tz_of(d))}</small></h2></section>`;
  rest.querySelector('.ad-hours')!.append(
    chart(
      hours.map((n, h) => ({ label: `${h}:00`, value: n, tip: `${h}:00–${h + 1}:00<br><b>${int(n)}</b> ${esc(t('ad_views'))}` })),
      { fmt: (x) => compact(x), whole: true, height: 140, ticks: [0, 6, 12, 18, 23] },
      obs,
    ),
  );
  body.replaceChildren(top, rest);
  return tz_of(d);
}

// ---------------------------------------------------------------- learning
async function learning(v: View, body: HTMLElement, obs: ResizeObserver[]): Promise<string> {
  if (v.lesson) return one_lesson(v, body);
  const d = await load('learning', { days: v.days });
  const lessons = rows(d.lessons), courses = rows(d.courses);
  const names = await names_of([...rows(d.hardest), ...rows(d.misconceptions)].map((x) => x.lesson));
  // everyone who opened a page (signed in or not), by course address and by lesson
  const by_path = new Map(rows(d.views).map((x) => [S(x.path), N(x.visitors)]));
  const course_visitors = (id: string) => {
    const c = find_course(id);
    return c ? rows(d.sections).find((x) => S(x.seg) === c.slug)?.visitors : undefined;
  };
  const lesson_visitors = (id: string) => {
    const p = find_lesson(id) ? lesson_path(id) : '';
    return p ? by_path.get(p) : undefined;
  };
  const col = (label: string, value: string) => `<span>${value}<small>${esc(label)}</small></span>`;
  const course_rows = courses
    .map((c) => {
      const id = S(c.course);
      const own = lessons.filter((l) => S(l.course) === id);
      // the course's own order where it is known
      const order = find_course(id)?.units.flatMap((u) => u.lessons.map((l) => l.id)) ?? [];
      own.sort((a, b) => (order.indexOf(S(a.lesson)) + 1 || 1e9) - (order.indexOf(S(b.lesson)) + 1 || 1e9));
      const maxl = Math.max(0, ...own.map((l) => N(l.learners)));
      return `<details class="ad-course"><summary><b>${esc(course_name(id))}</b>${col(t('ad_visitors'), int(course_visitors(id) ?? 0))}${col(t('ad_learners'), int(c.learners))}${col(t('ad_finished'), int(c.completed))}${col(
        t('ad_right'),
        pct(c.correct, c.answered),
      )}${col(t('ad_time'), dur(c.time_ms))}${col(t('ad_asked'), int(c.asked))}</summary>${table(
        [
          { h: t('ad_lessons'), cls: 'name', cell: (l) => `<a href="${esc(href({ tab: 'learning', lesson: S(l.lesson) }, v))}">${esc(lesson_name(l.lesson))}</a>${share(l.learners, maxl)}` },
          { h: t('ad_visitors'), num: true, cell: (l) => int(lesson_visitors(S(l.lesson)) ?? 0) },
          { h: t('ad_learners'), num: true, cell: (l) => int(l.learners) },
          { h: t('ad_finished'), num: true, cell: (l) => `${int(l.completed)} <span class="ad-mono">${pct(l.completed, l.learners)}</span>` },
          { h: t('ad_answers'), num: true, cell: (l) => int(l.answered) },
          { h: t('ad_right'), num: true, cell: (l) => pct(l.correct, l.answered) },
          { h: t('ad_time'), num: true, cell: (l) => dur(l.time_ms) },
          { h: t('ad_asked'), num: true, cell: (l) => int(l.asked) },
          { h: t('ad_last'), num: true, cell: (l) => esc(when(l.last_t)) },
        ],
        own,
      )}</details>`;
    })
    .join('');
  const where = (x: Row) => `<a href="${esc(href({ tab: 'learning', lesson: S(x.lesson) }, v))}">${esc(lesson_name(x.lesson))}</a><small>${esc(step_name(names.get(S(x.lesson)), x.step))}</small>`;
  body.innerHTML =
    section(t('ad_courses'), course_rows || empty(), { count: courses.length ? String(courses.length) : '' }) +
    `<div class="ad-grid2">${section(
      t('ad_hardest'),
      table(
        [
          { h: t('ad_step'), cls: 'name', cell: where },
          { h: t('ad_first_try'), num: true, cell: (x) => `<b>${pct(x.first_right, x.learners)}</b>` },
          { h: t('ad_learners'), num: true, cell: (x) => int(x.learners) },
        ],
        rows(d.hardest).slice(0, 20),
      ),
    )}${section(
      t('ad_misconceptions'),
      table(
        [
          { h: t('ad_misconceptions'), cls: 'name', cell: (x) => `${esc(names.get(S(x.lesson))?.misc.get(S(x.misconception)) || S(x.misconception))}<small>${esc(lesson_name(x.lesson))} · ${esc(step_name(names.get(S(x.lesson)), x.step))}</small>` },
          { h: t('ad_learners'), num: true, cell: (x) => int(x.learners) },
        ],
        rows(d.misconceptions).slice(0, 20),
      ),
    )}</div>`;
  void obs;
  return tz_of(d);
}

async function one_lesson(v: View, body: HTMLElement): Promise<string> {
  const [d, ln] = await Promise.all([load('lesson', { id: v.lesson, days: v.days }), lesson_names(v.lesson)]);
  const sum = (d.summary ?? {}) as Row, views = (d.views ?? {}) as Row;
  const steps = rows(d.steps);
  const first = new Map(rows(d.first_try).map((x) => [S(x.step), x]));
  const stops = new Map(rows(d.stops).map((x) => [S(x.step), N(x.learners)]));
  // the lesson's own order, then any page the data knows and the lesson no longer has
  const order = [...(ln.lesson?.steps.map((s) => s.id) ?? [])];
  for (const s of steps) if (!order.includes(S(s.step))) order.push(S(s.step));
  const by = new Map(steps.map((s) => [S(s.step), s]));
  const list = order.map((id) => ({ ...(by.get(id) ?? {}), step: id }) as Row).filter((s) => by.has(S(s.step)) || ln.steps.has(S(s.step)));
  const maxr = Math.max(0, ...list.map((s) => N(s.reached)));
  const ft = rows(d.first_try).reduce((a, x) => [a[0] + N(x.first_right), a[1] + N(x.learners)], [0, 0]);
  const cl = find_lesson(v.lesson);
  const names = new Map([[v.lesson, ln]]);
  body.innerHTML = `
    <div class="ad-sub"><div>${backlink(href({ tab: 'learning' }, v), t('ad_tab_learning'))}<h2>${esc(lesson_name(v.lesson))}</h2><p>${esc(course_name(cl ? find_course_of(v.lesson) : ''))}</p></div>
      ${cl ? `<a class="mn-btn" href="${esc(lesson_path(v.lesson))}">${esc(t('ad_open_lesson'))} ↗</a>` : ''}</div>
    ${tiles([
      { k: 'v', label: t('ad_visitors'), sub: t('ad_visitors_sub'), value: int(views.visitors) },
      { k: 'l', label: t('ad_learners'), sub: t('ad_learners_sub'), value: int(sum.learners) },
      { k: 'c', label: t('ad_finished'), value: `${int(sum.completed)}`, delta: pct(sum.completed, sum.learners) },
      { k: 'f', label: t('ad_first_try'), value: pct(ft[0], ft[1]), delta: ft[1] ? `${int(ft[0])} / ${int(ft[1])}` : undefined },
      { k: 'q', label: t('ad_questions'), value: int(sum.asked) },
      { k: 't', label: t('ad_time'), value: dur(sum.time_ms) },
    ])}
    ${section(
      t('ad_by_page'),
      table(
        [
          { h: '#', num: true, cell: (s) => `<span class="ad-mono">${ln.steps.get(S(s.step))?.n ?? '·'}</span>` },
          { h: t('ad_step'), cls: 'name', cell: (s) => `${esc(ln.steps.get(S(s.step))?.title || S(s.step))}${share(s.reached, maxr)}` },
          { h: t('ad_reached'), num: true, cell: (s) => `${int(s.reached)} <span class="ad-mono">${pct(s.reached, maxr)}</span>` },
          { h: t('ad_stay'), num: true, cell: (s) => dur(N(s.stays) ? N(s.time_ms) / N(s.stays) : 0) },
          { h: t('ad_first_try'), num: true, cell: (s) => (first.get(S(s.step)) ? `${pct(first.get(S(s.step))!.first_right, first.get(S(s.step))!.learners)} <span class="ad-mono">${int(first.get(S(s.step))!.learners)}</span>` : '') },
          { h: t('ad_stopped'), num: true, cell: (s) => (stops.get(S(s.step)) ? `<b>${int(stops.get(S(s.step)))}</b>` : '') },
          { h: t('ad_asked'), num: true, cell: (s) => (N(s.asked) ? int(s.asked) : '') },
        ],
        list,
      ),
    )}
    <div class="ad-grid2">${section(
      t('ad_misconceptions'),
      table(
        [
          { h: t('ad_misconceptions'), cls: 'name', cell: (x) => `${esc(ln.misc.get(S(x.misconception)) || S(x.misconception))}<small>${esc(step_name(ln, x.step))}</small>` },
          { h: t('ad_learners'), num: true, cell: (x) => int(x.learners) },
        ],
        rows(d.misconceptions),
      ),
    )}${level() >= 2 ? section(t('ad_recent_q'), question_list(rows(d.questions), names, v), { link: `<a href="${esc(href({ tab: 'ai', q: '' }, v))}">${esc(t('ad_all_q'))} →</a>` }) : ''}</div>`;
  return tz_of(d);
}
const find_course_of = (lesson: string) => {
  const p = lesson_path(lesson).split('/')[1];
  return course_by_slug(p)?.id ?? '';
};

// ---------------------------------------------------------------- AI
async function ai(v: View, body: HTMLElement, obs: ResizeObserver[]): Promise<string> {
  const words = level() >= 2;
  const none = Promise.resolve({} as Row);
  const [d, qs, fb] = await Promise.all([load('ai', { days: v.days }), words ? load('questions', { days: v.days, q: v.q }) : none, words ? load('feedback') : none]);
  const daily = rows(d.daily).map((x) => ({ ...x, tokens: N(x.prompt) + N(x.completion) }));
  const all = rows(d.rows);
  const sum = (k: string, f: (x: Row) => boolean = () => true) => all.filter(f).reduce((n, x) => n + N(x[k]), 0);
  const top = document.createElement('div');
  top.style.display = 'contents';
  picker(
    top,
    'ai',
    [
      { k: 'ai_calls', label: t('ad_ai_calls'), value: int(sum('calls', (x) => x.route === 'ai')) },
      { k: 'cost', label: t('ad_cost'), sub: t('ad_cost_sub'), value: usd(sum('cost')) },
      { k: 'tokens', label: t('ad_tokens'), sub: t('ad_tokens_io'), value: `${compact(sum('prompt'))} / ${compact(sum('completion'))}` },
      { k: 'errors', label: t('ad_errors'), value: int(sum('errors')), delta: sum('limited') ? `${t('ad_limited')} ${int(sum('limited'))}` : undefined },
    ],
    daily,
    { cost: usd },
    obs,
  );
  const route = (x: Row) => {
    const r = S(x.route), key = r.startsWith('studio/') ? 'ad_r_studio' : `ad_r_${r.replace('/', '_')}`;
    const name = t(key) === key ? r : t(key);
    return `${esc(name)}<small>${esc([x.op, x.model].filter(Boolean).map(S).join(' · '))}</small>`;
  };
  const items = rows(qs.items);
  const names = await names_of(items.map((x) => x.lesson));
  const fb_items = rows(fb.items);
  const helpful = fb_items.filter((x) => x.helpful).length;
  const rest = document.createElement('div');
  rest.style.display = 'contents';
  rest.innerHTML =
    section(
      t('ad_routes'),
      table(
        [
          { h: '', cls: 'name', cell: route },
          { h: t('ad_calls'), num: true, cell: (x) => int(x.calls) },
          { h: t('ad_cached'), num: true, cell: (x) => (N(x.cached) ? int(x.cached) : '') },
          { h: t('ad_errors'), num: true, cell: (x) => (N(x.errors) ? `<span class="ad-no">${int(x.errors)}</span>` : '') },
          { h: t('ad_limited'), num: true, cell: (x) => (N(x.limited) ? int(x.limited) : '') },
          { h: `${t('ad_tokens')} · ${t('ad_tokens_io')}`, num: true, cell: (x) => (N(x.prompt) || N(x.completion) ? `${compact(x.prompt)} / ${compact(x.completion)}` : N(x.chars) ? `${compact(x.chars)} chars` : '') },
          { h: t('ad_latency'), num: true, cell: (x) => dur(N(x.calls) ? N(x.ms) / N(x.calls) : 0) },
          { h: t('ad_cost'), num: true, cell: (x) => `<b>${usd(x.cost)}</b>` },
        ],
        all,
      ),
    ) +
    (!words
      ? ''
      : `<section class="ad-sec ad-qsec"><h2>${esc(t('ad_all_q'))}</h2>
      <form class="ad-search"><input class="mn-input" type="search" name="q" value="${esc(v.q)}" placeholder="${esc(t('ad_search'))}" aria-label="${esc(t('ad_search'))}"><button class="mn-btn" type="submit">${esc(t('ad_search_btn'))}</button></form>
      <div class="ad-qlist">${question_list(items, names, v)}</div>${items.length >= 50 ? `<button type="button" class="mn-btn ad-more ad-qmore">${esc(t('ad_more'))}</button>` : ''}</section>` +
    section(
      t('ad_feedback'),
      fb.off || !fb_items.length
        ? empty()
        : `<p class="ad-empty">${esc(t('ad_helpful'))} ${int(helpful)} · ${esc(t('ad_not_helpful'))} ${int(fb_items.length - helpful)}</p>${table(
            [
              { h: '', cell: (x) => (x.helpful ? '<span class="ad-yes">✓</span>' : '<span class="ad-no">✕</span>') },
              { h: t('ad_questions'), cls: 'name', cell: (x) => `${esc(S(x.question))}${x.note ? `<small>${esc(S(x.note))}</small>` : ''}` },
              { h: '', num: true, cell: (x) => esc(when(Date.parse(S(x.t)))) },
            ],
            fb_items,
          )}`,
      ));
  // a search is an address of its own; more questions load under the list
  rest.querySelector<HTMLFormElement>('.ad-search')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = String(new FormData(e.target as HTMLFormElement).get('q') ?? '').trim();
    navigate(href({ tab: 'ai', q }, v));
  });
  const more = rest.querySelector<HTMLButtonElement>('.ad-qmore');
  let oldest = N(items.at(-1)?.t);
  more?.addEventListener('click', async () => {
    more.disabled = true;
    const next = rows((await load('questions', { days: v.days, q: v.q, before: oldest })).items);
    if (!next.length) return void (more.hidden = true);
    const nm = await names_of(next.map((x) => x.lesson));
    rest.querySelector('.ad-qlist .ad-qs')?.insertAdjacentHTML('beforeend', question_list(next, nm, v).replace(/^<div class="ad-qs">|<\/div>$/g, ''));
    oldest = N(next.at(-1)?.t);
    more.disabled = false;
    more.hidden = next.length < 50;
  });
  body.replaceChildren(top, rest);
  return tz_of(d);
}

// ---------------------------------------------------------------- accounts
async function users(v: View, body: HTMLElement): Promise<string> {
  if (v.user) return one_user(v, body);
  const admin = level() >= 3;
  const [d, ov, up] = await Promise.all([load('users', { q: v.q }), load('overview', { days: v.days }), admin ? load('uploads') : Promise.resolve({} as Row)]);
  const now = (ov.totals ?? {}) as Row;
  const list = rows(d.items);
  const person = (x: Row) => `<a href="${esc(href({ tab: 'users', user: S(x.id) }, v))}">${esc(S(x.email))}</a><small>№ ${esc(S(x.id).slice(0, 4).toUpperCase())}</small>`;
  // an admin names teachers here; an admin is one by the server's list, not by this choice
  const role_cell = (x: Row) =>
    !admin || x.role === 'admin'
      ? esc(t(`ad_role_${S(x.role) || 'learner'}`))
      : `<select class="ad-role" data-id="${esc(S(x.id))}" aria-label="${esc(t('ad_role'))}">${['learner', 'teacher'].map((r) => `<option value="${r}"${x.role === r ? ' selected' : ''}>${esc(t(`ad_role_${r}`))}</option>`).join('')}</select>`;
  const table_of = (l: Row[]) =>
    table(
      [
        { h: '', cls: 'name', cell: person },
        { h: t('ad_joined'), num: true, cell: (x) => esc(date(x.created)) },
        { h: t('ad_last'), num: true, cell: (x) => esc(when(x.last_t)) },
        { h: t('ad_lessons'), num: true, cell: (x) => int(x.lessons) },
        { h: t('ad_finished'), num: true, cell: (x) => int(x.completed) },
        { h: t('ad_right'), num: true, cell: (x) => (N(x.answered) ? `${pct(x.correct, x.answered)} <span class="ad-mono">${int(x.answered)}</span>` : '') },
        { h: t('ad_asked'), num: true, cell: (x) => (N(x.asked) ? int(x.asked) : '') },
        { h: t('ad_time'), num: true, cell: (x) => dur(x.time_ms) },
        { h: t('ad_uploads'), num: true, cell: (x) => (N(x.uploads) ? int(x.uploads) : '') },
        { h: t('ad_role'), num: true, cell: role_cell },
      ],
      l,
    );
  body.innerHTML = `${tiles([
    { k: 'a', label: t('ad_accounts'), value: int(d.total) },
    { k: 'n', label: t('ad_signups'), value: int(now.signups) },
    { k: 'l', label: t('ad_active'), value: int(now.learners) },
  ])}
    <section class="ad-sec"><h2>${esc(t('ad_accounts'))} <small>${esc(int(d.total))}</small></h2>
      <form class="ad-search"><input class="mn-input" type="search" name="q" value="${esc(v.q)}" placeholder="${esc(t('ad_find_email'))}" aria-label="${esc(t('ad_find_email'))}"><button class="mn-btn" type="submit">${esc(t('ad_search_btn'))}</button></form>
      <div class="ad-ulist">${table_of(list)}</div>${N(d.total) > list.length ? `<button type="button" class="mn-btn ad-more">${esc(t('ad_more'))}</button>` : ''}</section>
    ${
      !admin
        ? ''
        : section(
      t('ad_uploads'),
      table(
        [
          { h: t('ad_uploads'), cls: 'name', cell: (x) => `${esc(S(x.title) || S(x.id))}<small>${x.owner ? `<a href="${esc(href({ tab: 'users', user: S(x.owner) }, v))}">${esc(S(x.email))}</a>` : ''} · ${esc(S(x.lang))}</small>` },
          { h: t('ad_files'), num: true, cell: (x) => `${int(x.files)} <span class="ad-mono">${(N(x.bytes) / 1048576).toFixed(1)} MB</span>` },
          { h: '', num: true, cell: (x) => esc(t(N(x.public) ? 'ad_public' : 'ad_private')) },
          { h: t('ad_last'), num: true, cell: (x) => esc(when(x.updated)) },
        ],
        rows(up.items),
      ),
      { count: rows(up.items).length ? String(rows(up.items).length) : '' },
    )
    }`;
  body.addEventListener('change', async (e) => {
    const sel = (e.target as Element).closest<HTMLSelectElement>('.ad-role');
    if (!sel) return;
    sel.disabled = true;
    const r = await fetch('/api/admin/role', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sel.dataset.id, role: sel.value }) }).catch(() => null);
    if (!r?.ok) sel.value = sel.value === 'teacher' ? 'learner' : 'teacher'; // not saved: back to what it was
    kept.clear();
    sel.disabled = false;
  });
  body.querySelector<HTMLFormElement>('.ad-search')!.addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(href({ tab: 'users', q: String(new FormData(e.target as HTMLFormElement).get('q') ?? '').trim() }, v));
  });
  const more = body.querySelector<HTMLButtonElement>('.ad-more');
  let shown = list.length;
  more?.addEventListener('click', async () => {
    more.disabled = true;
    const next = rows((await load('users', { q: v.q, offset: shown })).items);
    shown += next.length;
    body.querySelector('.ad-ulist tbody')?.insertAdjacentHTML('beforeend', (table_of(next).match(/<tbody>([\s\S]*)<\/tbody>/) ?? ['', ''])[1]);
    more.disabled = false;
    more.hidden = shown >= N(d.total) || !next.length;
  });
  return tz_of(ov);
}

async function one_user(v: View, body: HTMLElement): Promise<string> {
  const d = await load('user', { id: v.user });
  const u = (d.user ?? {}) as Row, tot = (d.totals ?? {}) as Row;
  const lessons = rows(d.lessons), events = rows(d.events);
  const names = await names_of(events.map((x) => x.lesson));
  const lesson_cell = (x: Row) => `<a href="${esc(href({ tab: 'learning', lesson: S(x.lesson) }, v))}">${esc(lesson_name(x.lesson))}</a><small>${esc(course_name(x.course))}</small>`;
  const what = (x: Row) => {
    const verb = t(`ad_v_${S(x.verb)}`);
    const bits: string[] = [];
    if (x.verb === 'answered') bits.push(N(x.correct) ? '<span class="ad-yes">✓</span>' : '<span class="ad-no">✕</span>');
    if (x.misconception) bits.push(esc(names.get(S(x.lesson))?.misc.get(S(x.misconception)) || S(x.misconception)));
    if (x.verb === 'left' && x.duration_ms) bits.push(esc(dur(Math.min(N(x.duration_ms), 1_800_000))));
    if (x.data) bits.push(`<q>${esc(S(x.data))}</q>`);
    return `${esc(verb)}${bits.length ? ` · ${bits.join(' · ')}` : ''}`;
  };
  const ev_rows = (l: Row[]) =>
    table(
      [
        { h: '', cell: (x) => esc(stamp(x.t)) },
        { h: '', cell: what },
        { h: '', cls: 'name', cell: (x) => (x.lesson ? `${esc(lesson_name(x.lesson))}${x.step ? `<small>${esc(step_name(names.get(S(x.lesson)), x.step))}</small>` : ''}` : '') },
      ],
      l,
      'ad-ev',
    ).replace(/<thead>[\s\S]*?<\/thead>/, '');
  body.innerHTML = `
    <div class="ad-sub"><div>${backlink(href({ tab: 'users' }, v), t('ad_tab_users'))}<h2>${esc(S(u.email))}</h2><p>№ ${esc(S(u.id).slice(0, 4).toUpperCase())} · ${esc(t('ad_joined'))} ${esc(date(u.created))} · ${esc(t('ad_last'))} ${esc(when(tot.last_t))}</p></div></div>
    ${tiles([
      { k: 'l', label: t('ad_lessons'), value: int(tot.lessons) },
      { k: 'c', label: t('ad_finished'), value: int(tot.completed) },
      { k: 'r', label: t('ad_right'), value: pct(tot.correct, tot.answered), delta: N(tot.answered) ? `${int(tot.correct)} / ${int(tot.answered)}` : undefined },
      { k: 'q', label: t('ad_questions'), value: int(tot.asked) },
      { k: 't', label: t('ad_time'), value: dur(tot.time_ms) },
    ])}
    ${section(
      t('ad_lessons'),
      table(
        [
          { h: t('ad_lessons'), cls: 'name', cell: lesson_cell },
          { h: t('ad_finished'), num: true, cell: (x) => (N(x.completed) ? '<span class="ad-yes">✓</span>' : '') },
          { h: t('ad_answers'), num: true, cell: (x) => (N(x.answered) ? `${pct(x.correct, x.answered)} <span class="ad-mono">${int(x.answered)}</span>` : '') },
          { h: t('ad_asked'), num: true, cell: (x) => (N(x.asked) ? int(x.asked) : '') },
          { h: t('ad_time'), num: true, cell: (x) => dur(x.time_ms) },
          { h: t('ad_last'), num: true, cell: (x) => esc(when(x.last_t)) },
        ],
        lessons,
      ),
    )}
    <section class="ad-sec"><h2>${esc(t('ad_record'))}</h2><div class="ad-evlist">${ev_rows(events)}</div>${events.length >= 200 ? `<button type="button" class="mn-btn ad-more">${esc(t('ad_more'))}</button>` : ''}</section>
    ${rows(d.uploads).length ? section(t('ad_uploads'), table([{ h: t('ad_uploads'), cls: 'name', cell: (x) => esc(S(x.title) || S(x.id)) }, { h: '', num: true, cell: (x) => esc(t(N(x.public) ? 'ad_public' : 'ad_private')) }, { h: t('ad_last'), num: true, cell: (x) => esc(when(x.updated)) }], rows(d.uploads))) : ''}`;
  const more = body.querySelector<HTMLButtonElement>('.ad-more');
  let oldest = N(events.at(-1)?.t);
  more?.addEventListener('click', async () => {
    more.disabled = true;
    const next = rows((await load('user', { id: v.user, before: oldest })).events);
    for (const [k, x] of await names_of(next.map((e) => e.lesson))) names.set(k, x);
    body.querySelector('.ad-evlist tbody')?.insertAdjacentHTML('beforeend', (ev_rows(next).match(/<tbody>([\s\S]*)<\/tbody>/) ?? ['', ''])[1]);
    oldest = N(next.at(-1)?.t);
    more.disabled = false;
    more.hidden = next.length < 200;
  });
  return tz_of(d);
}
