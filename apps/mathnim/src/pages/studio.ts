// /studio: courses made from uploaded slides and practice exams.
//   /studio        my courses as cards, and a sheet to drop slides on: dropping starts a course
//   /studio/<id>   one course: its name and language, the files (dropped anywhere on the page,
//                  sorted into slides and practice exams by their names), making it step by step,
//                  the course as it takes shape (units, lessons and how far each is), what the
//                  slides cover and where
// The steps run on the server one at a time (server/studio/pipeline.ts); this page asks which can
// run and keeps up to three going until none is left. The drop areas are drawn on the engineering
// sheet (sheet.ts), whose crop marks close in while files are held over them.
import { esc, t, ui_lang } from '@mathnim/present';
import { accounts_available, current_user, generate_available, studio_available } from '../account';
import { backlink } from '../backlink';
import { lesson_path } from '../course';
import { login_form } from '../login';
import { navigate, type Route } from '../router';
import { load_studio_courses, studio_slug } from '../studio_courses';

const CSS = `
.studio{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.studio [hidden]{display:none!important}
.studio h1{margin:0;font-size:30px;letter-spacing:-.02em;line-height:1.2}
.studio-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.studio-head h1{flex:1;min-width:0}
.studio-head .mn-btn{text-decoration:none}
.studio-lead{margin:-6px 0 0;color:var(--mn-muted);font-size:15px;line-height:1.6}
.studio-gate{width:min(440px,100%);box-sizing:border-box;align-self:center;margin-top:40px;display:flex;flex-direction:column;gap:14px;padding:26px}
.studio-gate h1{font-size:24px}
/* the sheet files are dropped on: a dot grid whose crop marks close in while files are held over it (or when pointed at) */
.sheet{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;cursor:pointer;border-radius:2px;--g:color-mix(in srgb,var(--mn-fg) 16%,transparent);background:radial-gradient(var(--g) 1px,transparent 1.3px) 0 0/14px 14px,var(--mn-bg);transition:background-color .2s}
.sheet:hover,.sheet.over{--g:color-mix(in srgb,var(--mn-fg) 26%,transparent)}
.sheet>i{position:absolute;width:14px;height:14px;border:0 solid var(--mn-fg);transition:inset .35s cubic-bezier(.3,1.5,.5,1)}
.sheet>i:nth-child(1){left:0;top:0;border-left-width:1.5px;border-top-width:1.5px}
.sheet>i:nth-child(2){right:0;top:0;border-right-width:1.5px;border-top-width:1.5px}
.sheet>i:nth-child(3){left:0;bottom:0;border-left-width:1.5px;border-bottom-width:1.5px}
.sheet>i:nth-child(4){right:0;bottom:0;border-right-width:1.5px;border-bottom-width:1.5px}
.sheet.over>i:nth-child(1),.sheet:hover>i:nth-child(1){left:8px;top:8px}
.sheet.over>i:nth-child(2),.sheet:hover>i:nth-child(2){right:8px;top:8px}
.sheet.over>i:nth-child(3),.sheet:hover>i:nth-child(3){left:8px;bottom:8px}
.sheet.over>i:nth-child(4),.sheet:hover>i:nth-child(4){right:8px;bottom:8px}
.sheet.over{background-color:color-mix(in srgb,var(--mn-accent) 6%,var(--mn-bg))}
.sheet b{font-size:16px;font-weight:600;color:var(--mn-fg)}
.sheet small{font-size:13px;color:var(--mn-muted)}
.sheet .plus{font:300 30px/1 ui-sans-serif,system-ui;color:var(--mn-muted)}
.sheet input{display:none}
@media (prefers-reduced-motion:reduce){.sheet>i{transition:none}}
/* my courses */
.st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.st-card{display:flex;flex-direction:column;gap:10px;padding:18px;min-height:150px;box-sizing:border-box;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}
.st-card:hover{border-color:var(--mn-accent);transform:translateY(-2px)}
.st-card b{font-size:17px;font-weight:650;line-height:1.35;letter-spacing:-.01em}
.st-card .st-bar{margin-top:auto}
.st-bar{height:4px;border-radius:2px;background:var(--mn-faint);overflow:hidden}
.st-bar i{display:block;height:100%;background:var(--mn-good);transition:width .4s}
.st-status{font-size:12.5px;color:var(--mn-muted)}
.st-grid .sheet{min-height:150px;padding:20px}
.st-grid.empty{grid-template-columns:minmax(0,1fr)}
.st-grid.empty .sheet{min-height:260px}
/* one course */
.st-title{flex:1;min-width:0;margin:0;padding:2px 0;border:0;border-bottom:1.5px dashed transparent;background:none;font-family:inherit;font-size:30px;font-weight:700;line-height:1.25;letter-spacing:-.02em;color:var(--mn-fg);outline:none}
.st-title:hover{border-bottom-color:var(--mn-border)}
.st-title:focus{border-bottom-color:var(--mn-accent)}
.st-title::placeholder{color:color-mix(in srgb,var(--mn-fg) 30%,transparent)}
.st-line{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:-8px 0 0;font-size:13.5px;color:var(--mn-muted)}
.st-line:empty{display:none}
.st-lang{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--mn-border);border-radius:999px;margin-left:4px}
.st-lang button{border:0;border-radius:999px;background:none;padding:2px 10px;font:inherit;font-size:12.5px;color:var(--mn-muted);cursor:pointer}
.st-lang button[aria-pressed=true]{background:var(--mn-fg);color:var(--mn-bg)}
.st-note{margin:0;padding:12px 16px;border-left:3px solid var(--mn-warn);background:color-mix(in srgb,var(--mn-warn) 7%,transparent);font-size:14px;line-height:1.55;border-radius:0}
.course-drop{min-height:150px;padding:22px}
.st-files{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.st-col{padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.st-col h3{margin:0 0 4px;display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--mn-muted)}
.st-col h3 span{font:500 11px ui-monospace,Menlo,monospace;color:var(--mn-muted)}
.st-col ol{list-style:none;margin:0;padding:0}
.st-col li{display:grid;grid-template-columns:24px minmax(0,1fr) auto auto auto;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--mn-faint);font-size:14px}
.st-col li:first-child{border-top:0}
.st-col .no{font:500 11px ui-monospace,Menlo,monospace;color:var(--mn-muted)}
.st-col .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-col small{font-size:12px;color:var(--mn-muted);font-variant-numeric:tabular-nums}
.st-col li button{width:24px;height:24px;border:0;border-radius:6px;background:none;color:var(--mn-muted);cursor:pointer;font-size:14px;line-height:1;opacity:.55;transition:opacity .15s,background-color .15s}
.st-col li:hover button{opacity:1}
.st-col li button:hover{background:var(--mn-faint);color:var(--mn-fg)}
.st-col li button.rm:hover{color:var(--mn-bad)}
.st-col li.up{grid-template-columns:24px minmax(0,1fr) 90px}
.st-col li.up .st-bar i{background:var(--mn-accent)}
.st-col li.bad .nm{color:var(--mn-bad)}
.st-col li.none{display:block;font-size:13px;color:var(--mn-muted);padding:4px 0}
.st-make{padding:18px;display:flex;flex-direction:column;gap:12px}
.run-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.run-msg{font-size:14px;color:var(--mn-muted)}
.run-msg.bad{color:var(--mn-bad)}
.drop-note{margin:-8px 0 0}
.st-progress{display:flex;align-items:center;gap:12px}
.st-progress .st-bar{flex:1}
.st-progress small{flex:none;font-size:12.5px;color:var(--mn-muted);font-variant-numeric:tabular-nums}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.steps li{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid var(--mn-faint);font-size:14px}
.steps li:first-child{border-top:0}
.steps i{font-style:normal;text-align:center;color:var(--mn-muted)}
.steps .done i{color:var(--mn-good)}
.steps .failed i,.steps .failed .st{color:var(--mn-bad)}
.steps .active i{color:var(--mn-accent);animation:st-blink 1.2s ease-in-out infinite}
.steps .label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.steps .label a{color:inherit;text-decoration:none}
.steps .label a:hover{color:var(--mn-accent);text-decoration:underline}
.steps .st{font-size:13px;color:var(--mn-muted);white-space:nowrap}
.steps .active .st{color:var(--mn-accent)}
.steps code{grid-column:2/-1;font:11.5px ui-monospace,Menlo,monospace;color:var(--mn-muted);word-break:break-all}
@keyframes st-blink{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.steps .active i{animation:none}}
.st-outline{padding:18px;display:flex;flex-direction:column;gap:6px}
.st-outline h2{margin:0 0 4px;font-size:16px}
.st-outline h3{margin:12px 0 2px;font-size:12.5px;font-weight:600;letter-spacing:.02em;color:var(--mn-muted)}
.cover{padding:16px 18px}
.cover>summary{cursor:pointer;list-style:none;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.cover>summary::-webkit-details-marker{display:none}
.cover>summary b{font-size:16px}
.cover>summary span{font-size:13.5px;color:var(--mn-muted)}
.cover table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:12px}
.cover th{text-align:left;font-weight:600;font-size:12.5px;color:var(--mn-muted);padding:6px 8px;border-bottom:1px solid var(--mn-border)}
.cover td{padding:7px 8px;border-bottom:1px solid var(--mn-faint);vertical-align:top}
.cover td.pg{color:var(--mn-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.cover tr.minor td{color:var(--mn-muted)}
.cover a{color:inherit}
.cv{white-space:nowrap;font-size:12.5px;font-weight:600}
.cv.taught{color:var(--mn-good)}.cv.thin{color:var(--mn-warn)}.cv.missing,.cv.unplanned{color:var(--mn-bad)}.cv.planned{color:var(--mn-muted);font-weight:400}
.cv-note{display:block;font-size:12px;color:var(--mn-muted);font-weight:400;white-space:normal;margin-top:2px}
.cover-wrap{overflow-x:auto}
.studio-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:4px 2px}
.studio-pub{display:flex;align-items:center;gap:12px;font-size:14px}
.studio-pub small{display:block;color:var(--mn-muted);font-size:12.5px}
.studio-pub .set-switch{position:relative;flex:none;width:38px;height:22px;border-radius:11px;border:0;padding:0;background:var(--mn-border);cursor:pointer;transition:background-color .2s}
.studio-pub .set-switch::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
.studio-pub .set-switch[aria-checked=true]{background:var(--mn-accent)}
.studio-pub .set-switch[aria-checked=true]::after{transform:translateX(16px)}
.studio-del{border:0;background:none;padding:0;font:inherit;font-size:13.5px;color:var(--mn-muted);cursor:pointer}
.studio-del:hover{color:var(--mn-bad);text-decoration:underline}
@media (max-width:640px){.studio h1,.st-title{font-size:24px}.st-files{grid-template-columns:minmax(0,1fr)}.cover td.pg,.cover th.pg{display:none}.course-drop{min-height:120px}}
`;
let injected = false;
const inject = () => {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
};

// ---------------------------------------------------------------- the server's answers (server/studio/routes.ts)
interface Summary { id: string; title: string; files: number; lessons: number; done: number; next: number }
interface Detail {
  course: { id: string; title: string; lang: 'zh' | 'en'; public: boolean };
  admin: boolean;
  files: { id: string; kind: 'slides' | 'exam'; name: string; size: number }[];
  plan: null | {
    course: { title: string };
    units: { title: string; lessons: string[] }[];
    lessons: { id: string; title: string; question: string; decks: string[]; minutes: number; final: boolean }[];
    practice: null | { title: string; final: boolean };
  };
  steps: Record<string, true | { rev: number; title?: string; verdict?: string; issues?: number }>;
  next: string[];
  coverage: { id: string; name: string; deck: string; pages: string; weight: 'core' | 'minor'; lesson: string | null; status: string; note: string }[];
  entry: null | { lessons: { id: string }[]; ready: boolean };
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/studio/${path}`, { credentials: 'same-origin', ...init });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  return data as T;
}
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const MAX_FILE = 32 * 1024 * 1024;
/** A practice exam, from its name (anything else is slides; a file put in the wrong pile moves with one click). */
const EXAM_NAME = /exam|quiz|midterm|final|practice|sample|solution|answer|mock|test|模拟|试卷|考试|真题|答案|习题|练习/i;
const kind_of = (name: string): 'slides' | 'exam' => (EXAM_NAME.test(name) ? 'exam' : 'slides');
const CORNERS = '<i></i><i></i><i></i><i></i>';
/** The page's one line: what it does, or, while no model is connected, that it is still being tested. */
const lead = () => t(generate_available() ? 'studio_lead' : 'studio_testing');

/** Upload one file, telling its progress (0..1). Resolves with the course's detail. */
function send(course: string, f: File, kind: 'slides' | 'exam', on_progress: (p: number) => void): Promise<Detail> {
  return new Promise((done, fail) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/studio/courses/${course}/files?kind=${kind}&name=${encodeURIComponent(f.name)}`);
    x.withCredentials = true;
    x.upload.onprogress = (e) => e.lengthComputable && on_progress(e.loaded / e.total);
    x.onload = () => {
      let d: unknown = {};
      try {
        d = JSON.parse(x.responseText);
      } catch {
        /* not JSON */
      }
      if (x.status >= 200 && x.status < 300) done(d as Detail);
      else fail(new Error((d as { error?: string }).error ?? `HTTP ${x.status}`));
    };
    x.onerror = () => fail(new Error(t('net_down')));
    x.send(f);
  });
}
/** Files the page takes: PDFs (and text files as practice exams), at most 32 MB. */
function vet(files: File[]): { ok: File[]; problems: string[] } {
  const ok: File[] = [], problems: string[] = [];
  for (const f of files) {
    const pdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    const txt = /\.txt$/i.test(f.name);
    if (!pdf && !txt) problems.push(t('not_pdf', { name: f.name }));
    else if (f.size > MAX_FILE) problems.push(t('too_big', { name: f.name }));
    else ok.push(f);
  }
  return { ok, problems };
}
/** While this page is open, files dropped anywhere on it go to `take` (not to the browser, which would open them). */
function catch_drops(take: (files: File[]) => void, sheet: () => HTMLElement | null): () => void {
  const over = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    sheet()?.classList.add('over');
  };
  const leave = (e: DragEvent) => {
    if (!e.relatedTarget) sheet()?.classList.remove('over');
  };
  const drop = (e: DragEvent) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    sheet()?.classList.remove('over');
    take([...e.dataTransfer.files]);
  };
  window.addEventListener('dragover', over);
  window.addEventListener('dragleave', leave);
  window.addEventListener('drop', drop);
  return () => {
    window.removeEventListener('dragover', over);
    window.removeEventListener('dragleave', leave);
    window.removeEventListener('drop', drop);
  };
}

export async function studio_page(root: HTMLElement, route: Route): Promise<() => void> {
  inject();
  const id = route.page === 'studio' ? route.id : undefined;
  if (!accounts_available() || !studio_available()) {
    root.innerHTML = `<div class="studio"><div class="card studio-gate"><h1>${esc(t('studio_title'))}</h1><p class="studio-lead">${esc(t('accounts_off'))}</p></div></div>`;
    return () => {};
  }
  if (!current_user()) {
    root.innerHTML = `<div class="studio"><div class="card studio-gate"><h1>${esc(t('studio_title'))}</h1><p class="studio-lead">${esc(lead())}</p></div></div>`;
    root.querySelector('.studio-gate')!.append(login_form());
    return () => {};
  }
  return id ? course_view(root, id) : list_view(root);
}

// ---------------------------------------------------------------- my courses
/** Files dropped on "my courses" travel to the new course's page, which uploads them. */
const pending_uploads = new Map<string, File[]>();

async function list_view(root: HTMLElement): Promise<() => void> {
  const { courses } = await api<{ courses: Summary[] }>('courses').catch(() => ({ courses: [] as Summary[] }));
  const status = (c: Summary) =>
    !c.files ? t('st_empty') : !c.lessons ? t('st_waiting') : c.done < c.lessons ? t('st_making', { k: c.done, n: c.lessons }) : t('st_done', { n: c.lessons });
  root.innerHTML = `<div class="studio">
    <header class="studio-head"><h1>${esc(t('my_studio'))}</h1></header>
    <p class="studio-lead">${esc(lead())}</p>
    <div class="st-grid${courses.length ? '' : ' empty'}">
      ${courses
        .map(
          (c) => `<a class="card st-card" href="/studio/${esc(c.id)}"><b>${esc(c.title || t('untitled'))}</b>
          <span class="st-status">${esc(status(c))}</span>
          <div class="st-bar" aria-hidden="true"><i style="width:${c.lessons ? Math.round((c.done / c.lessons) * 100) : 0}%"></i></div></a>`,
        )
        .join('')}
      <label class="sheet new-sheet">${CORNERS}<span class="plus" aria-hidden="true">＋</span><b>${esc(t('drop_new'))}</b><small>${esc(t('drop_sub'))}</small><input type="file" accept="application/pdf,.pdf,.txt" multiple></label>
    </div>
  </div>`;
  const sheet = root.querySelector<HTMLElement>('.new-sheet')!;
  let busy = false;
  // files dropped here start a course: it is made, the files go up, and its page opens
  const start = async (files: File[]) => {
    const { ok, problems } = vet(files);
    if (busy || !ok.length) {
      if (problems.length) sheet.querySelector('small')!.textContent = problems.join(' · ');
      return;
    }
    busy = true;
    sheet.querySelector('b')!.textContent = t('creating');
    try {
      const { id } = await api<{ id: string }>('courses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: ui_lang() }) });
      pending_uploads.set(id, ok);
      navigate(`/studio/${id}`);
    } catch (e) {
      busy = false;
      sheet.querySelector('b')!.textContent = (e as Error).message;
    }
  };
  const input = sheet.querySelector('input')!;
  input.onchange = () => {
    void start([...(input.files ?? [])]);
    input.value = '';
  };
  return catch_drops((f) => void start(f), () => sheet);
}

// ---------------------------------------------------------------- one course
async function course_view(root: HTMLElement, id: string): Promise<() => void> {
  const stop = new AbortController();
  let d: Detail;
  try {
    d = await api<Detail>(`courses/${id}`);
  } catch {
    navigate('/studio', true);
    return () => {};
  }
  const active = new Map<string, number>(); // step -> characters written so far
  const pending = new Map<string, string>(); // step -> prompt file (dev)
  const failed = new Map<string, string>();
  const uploading: { name: string; kind: 'slides' | 'exam'; p: number; error?: string }[] = [];
  let note = '', note_bad = false, model_missing = false;

  root.innerHTML = `<div class="studio">
    ${backlink('/studio', t('my_studio'))}
    <header class="studio-head"><input class="st-title" maxlength="120" placeholder="${esc(t('untitled'))}" aria-label="${esc(t('untitled'))}"><a class="mn-btn primary open" hidden></a></header>
    <p class="st-line"></p>
    <p class="st-note" hidden></p>
    <label class="sheet course-drop">${CORNERS}<b>${esc(t('drop_files'))}</b><small>${esc(t('drop_sub'))}</small><input type="file" accept="application/pdf,.pdf,.txt" multiple></label>
    <p class="drop-note run-msg bad" hidden></p>
    <section class="st-files">
      <div class="card st-col" data-kind="slides"><h3>${esc(t('slides'))} <span></span></h3><ol></ol></div>
      <div class="card st-col" data-kind="exam"><h3>${esc(t('exams'))} <span></span></h3><ol></ol></div>
    </section>
    <section class="card st-make"><div class="run-bar"><button type="button" class="mn-btn primary go"></button><span class="run-msg"></span></div>
      <div class="st-progress"><div class="st-bar"><i></i></div><small></small></div><ol class="steps"></ol></section>
    <section class="card st-outline" hidden></section>
    <details class="card cover" hidden></details>
    <footer class="studio-foot"><span class="studio-pub"></span><button type="button" class="studio-del">${esc(t('delete_course'))}</button></footer>
  </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const title = $<HTMLInputElement>('.st-title');

  // ---------------------------------------------------------------- drawing
  const render = () => {
    if (document.activeElement !== title) title.value = d.course.title || d.plan?.course.title || '';
    const open = $<HTMLAnchorElement>('.open');
    open.hidden = !d.entry?.lessons.length;
    open.href = `/${studio_slug(d.course.id)}`;
    open.textContent = t('open_course');
    const slides = d.files.filter((f) => f.kind === 'slides'), exams = d.files.filter((f) => f.kind === 'exam');
    // one quiet line: what is here, and (before anything is made) the language it will be written in
    const started = Object.keys(d.steps).length > 0;
    $('.st-line').innerHTML = [
      d.files.length ? `<span>${esc(t('files_line', { s: slides.length, e: exams.length, mb: mb(d.files.reduce((n, f) => n + f.size, 0)) }))}</span>` : '',
      started ? '' : `<span>${esc(t('written_in'))}<span class="st-lang">${(['zh', 'en'] as const).map((l) => `<button type="button" data-lang="${l}" aria-pressed="${d.course.lang === l}">${l === 'zh' ? '中文' : 'English'}</button>`).join('')}</span></span>`,
    ].join('');
    const testing = $('.st-note');
    testing.hidden = generate_available();
    testing.textContent = t('studio_testing');
    for (const kind of ['slides', 'exam'] as const) {
      const files = kind === 'slides' ? slides : exams;
      const ups = uploading.filter((u) => u.kind === kind);
      const move = t(kind === 'slides' ? 'to_exam' : 'to_slides');
      $(`.st-col[data-kind="${kind}"] h3 span`).textContent = files.length ? String(files.length).padStart(2, '0') : '';
      const rows = files.map(
        (f, i) => `<li><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="nm" title="${esc(f.name)}">${esc(f.name)}</span><small>${mb(f.size)}</small><button type="button" class="mv" data-mv="${esc(f.id)}" title="${esc(move)}" aria-label="${esc(move)}">⇄</button><button type="button" class="rm" data-rm="${esc(f.id)}" title="${esc(t('remove'))}" aria-label="${esc(t('remove'))}">×</button></li>`,
      );
      const up_rows = ups.map((u) => `<li class="up${u.error ? ' bad' : ''}"><span class="no">↑</span><span class="nm" title="${esc(u.error ?? u.name)}">${esc(u.error ?? u.name)}</span><div class="st-bar"><i style="width:${Math.round(u.p * 100)}%"></i></div></li>`);
      $(`.st-col[data-kind="${kind}"] ol`).innerHTML = [...rows, ...up_rows].join('') || (kind === 'exam' ? `<li class="none">${esc(t('no_exams'))}</li>` : '');
    }
    draw_make();
    draw_outline();
    draw_coverage();
    $('.studio-pub').innerHTML = d.admin
      ? `<button type="button" class="set-switch" role="switch" aria-checked="${d.course.public}" aria-label="${esc(t('publish'))}"></button><span>${esc(t('publish'))}<small>${esc(t('publish_help'))}</small></span>`
      : '';
  };

  type RowState = 'done' | 'active' | 'todo' | 'failed';
  const mark = (state: RowState) => (state === 'done' ? '✓' : state === 'failed' ? '!' : state === 'active' ? '●' : '○');
  /** One row: `label` is HTML (a link to a finished lesson), the rest is text. */
  const row = (state: RowState, label: string, st: string, extra = '') =>
    `<li class="${state}"><i aria-hidden="true">${mark(state)}</i><span class="label">${label}</span><span class="st">${esc(st)}</span>${extra}</li>`;
  /** The state of a group of steps, as a row. */
  const state_row = (keys: string[], done: boolean, label: string, running_word: string) => {
    const k = keys.find((x) => failed.has(x));
    if (k) return row('failed', label, t('s_failed'), `<code>${esc(failed.get(k)!)}</code>`);
    const p = keys.find((x) => pending.has(x));
    if (p) return row('todo', label, t('s_pending'), `<code>${esc(pending.get(p)!)}</code>`);
    if (keys.some((x) => active.has(x))) return row('active', label, running_word);
    return row(done ? 'done' : 'todo', label, done ? t('s_done') : t('s_todo'));
  };
  /** Steps done of all the steps the course will take (reading, designing, writing and checking each lesson). */
  function counts(): { k: number; n: number } {
    const slides = d.files.filter((f) => f.kind === 'slides');
    const has_exam = d.files.some((f) => f.kind === 'exam');
    let n = slides.length + (has_exam ? 1 : 0) + 1;
    let k = slides.filter((f) => d.steps[`map.${f.id}`]).length + (has_exam && d.steps.exam ? 1 : 0) + (d.plan ? 1 : 0);
    for (const l of d.plan?.lessons ?? []) {
      n += 2;
      k += l.final ? 2 : d.steps[`lesson.${l.id}`] ? 1 : 0;
    }
    if (d.plan?.practice) {
      n += 1;
      k += d.plan.practice.final ? 1 : 0;
    }
    return { k, n };
  }
  function draw_make() {
    const slides = d.files.filter((f) => f.kind === 'slides');
    const working = active.size > 0;
    const go = $<HTMLButtonElement>('.go');
    go.textContent = Object.keys(d.steps).length ? t('generate_more') : t('generate');
    go.hidden = !d.next.length && !working && !!d.plan;
    go.disabled = working || !slides.length || !generate_available();
    const msg = $('.run-msg');
    msg.textContent = model_missing ? t('model_missing') : note;
    msg.classList.toggle('bad', model_missing || note_bad);
    $('.st-make').hidden = !slides.length;
    const { k, n } = counts();
    $('.st-progress').hidden = !Object.keys(d.steps).length && !working;
    $('.st-progress .st-bar i').style.width = `${Math.round((k / Math.max(1, n)) * 100)}%`;
    $('.st-progress small').textContent = t('steps_done', { k, n });
    const maps = slides.map((f) => `map.${f.id}`);
    const mapped = maps.filter((m) => d.steps[m]).length;
    const rows = [state_row(maps, mapped === maps.length, esc(`${t('step_maps')} · ${mapped}/${maps.length}`), `${t('s_running')} · ${mapped}/${maps.length}`)];
    if (d.files.some((f) => f.kind === 'exam')) rows.push(state_row(['exam'], !!d.steps.exam, esc(t('step_exam')), t('s_running')));
    rows.push(state_row(['plan'], !!d.plan, esc(t('step_plan')), t('s_running')));
    $('.st-make .steps').innerHTML = rows.join('');
  }
  /** The course as it takes shape: its units and lessons, each with how far it is. */
  function draw_outline() {
    const box = $('.st-outline');
    const plan = d.plan;
    box.hidden = !plan;
    if (!plan) return;
    const shown = new Set((d.entry?.lessons ?? []).map((l) => l.id));
    const lesson_row = (lid: string, n: number | null, label: string, final: boolean) => {
      const sid = `${d.course.id}-${lid}`;
      const name = n === null ? label : t('step_lesson', { n, title: label });
      const linked = shown.has(sid) ? `<a href="${lesson_path(sid)}">${esc(name)}</a>` : esc(name);
      const les = d.steps[`lesson.${lid}`] as { rev: number } | undefined;
      const rev = d.steps[`review.${lid}`] as { rev: number; verdict: string } | undefined;
      const keys = [`lesson.${lid}`, `review.${lid}`];
      const writing = active.has(keys[0]) ? (les ? t('s_revising') : t('s_writing')) : t('s_checking');
      if (final || keys.some((k) => failed.has(k) || pending.has(k) || active.has(k))) return state_row(keys, final, linked, writing);
      if (les && (!rev || rev.rev < les.rev)) return row('todo', linked, t('s_to_check'));
      if (les && rev?.verdict === 'revise') return row('todo', linked, t('s_to_rewrite'));
      return row('todo', linked, t('s_todo'));
    };
    const index = new Map(plan.lessons.map((l, i) => [l.id, i + 1]));
    const units = plan.units?.length ? plan.units : [{ title: t('the_course'), lessons: plan.lessons.map((l) => l.id) }];
    box.innerHTML = `<h2>${esc(t('the_course'))}</h2>${units
      .map((u) => {
        const rows = u.lessons.map((lid) => plan.lessons.find((x) => x.id === lid)).filter((l) => !!l).map((l) => lesson_row(l!.id, index.get(l!.id)!, l!.title, l!.final));
        return `<h3>${esc(u.title)}</h3><ol class="steps">${rows.join('')}</ol>`;
      })
      .join('')}${plan.practice ? `<h3>${esc(plan.practice.title)}</h3><ol class="steps">${lesson_row('practice', null, plan.practice.title, plan.practice.final)}</ol>` : ''}`;
  }
  function draw_coverage() {
    const box = $<HTMLDetailsElement>('.cover');
    if (!d.plan || !d.coverage.length) return void (box.hidden = true);
    box.hidden = false;
    const core = d.coverage.filter((c) => c.weight === 'core');
    const n = (s: string) => core.filter((c) => c.status === s).length;
    const lessons = new Map(d.plan.lessons.map((l, i) => [l.id, { n: i + 1, title: l.title }]));
    const word: Record<string, string> = { taught: t('cov_taught'), thin: t('cov_thin'), missing: t('cov_missing'), planned: t('cov_planned'), unplanned: t('cov_unplanned') };
    const shown = new Set((d.entry?.lessons ?? []).map((l) => l.id));
    const open = box.open;
    box.innerHTML = `<summary><b>${esc(t('coverage'))}</b><span>${esc(t('cov_summary', { n: core.length, ok: n('taught'), thin: n('thin'), miss: n('missing') + n('unplanned') }))}</span></summary>
      <div class="cover-wrap"><table><thead><tr><th>${esc(t('cov_point'))}</th><th class="pg">${esc(t('cov_where'))}</th><th>${esc(t('cov_lesson'))}</th><th></th></tr></thead><tbody>${d.coverage
        .map((c) => {
          const l = c.lesson ? lessons.get(c.lesson) : undefined;
          const lid = `${d.course.id}-${c.lesson}`;
          const where = l ? (shown.has(lid) ? `<a href="${lesson_path(lid)}">${esc(t('step_lesson', { n: l.n, title: l.title }))}</a>` : esc(t('step_lesson', { n: l.n, title: l.title }))) : '';
          const minor_off = c.weight === 'minor' && c.status === 'unplanned';
          const status = minor_off ? t('cov_minor') : word[c.status] ?? c.status;
          return `<tr class="${c.weight}"><td>${esc(c.name)}</td><td class="pg">${esc(c.deck.replace(/\.pdf$/i, ''))} · ${esc(c.pages)}</td><td>${where}</td><td><span class="cv ${minor_off ? 'planned' : esc(c.status)}">${esc(status)}${c.note && c.status !== 'taught' ? `<span class="cv-note">${esc(c.note)}</span>` : ''}</span></td></tr>`;
        })
        .join('')}</tbody></table></div>`;
    box.open = open;
  }

  const refresh = async () => {
    d = await api<Detail>(`courses/${id}`);
    render();
  };

  // ---------------------------------------------------------------- name and language
  const save_title = async () => {
    const v = title.value.trim();
    if (v === (d.course.title || d.plan?.course.title || '')) return;
    d = await patch<Detail>(`courses/${id}`, { title: v });
    render();
  };
  title.addEventListener('change', () => void save_title());
  title.addEventListener('keydown', (e) => e.key === 'Enter' && title.blur());
  $('.st-line').addEventListener('click', async (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-lang]');
    if (!b) return;
    d = await patch<Detail>(`courses/${id}`, { lang: b.dataset.lang });
    render();
  });

  // ---------------------------------------------------------------- files
  const upload = async (files: File[]) => {
    const { ok, problems } = vet(files);
    const notice = $('.drop-note');
    notice.hidden = !problems.length;
    notice.textContent = problems.join(' · ');
    const items = ok.map((f) => ({ f, u: { name: f.name, kind: kind_of(f.name), p: 0 } as (typeof uploading)[number] }));
    uploading.push(...items.map((x) => x.u));
    render();
    // one after another: each shows its own progress, and the course's state comes back with each
    for (const { f, u } of items) {
      try {
        d = await send(id, f, u.kind, (p) => {
          u.p = p;
          render();
        });
        uploading.splice(uploading.indexOf(u), 1);
      } catch (e) {
        u.error = `${f.name}: ${(e as Error).message}`;
      }
      render();
    }
  };
  const input = root.querySelector<HTMLInputElement>('.course-drop input')!;
  input.onchange = () => {
    void upload([...(input.files ?? [])]);
    input.value = '';
  };
  $('.st-files').addEventListener('click', async (e) => {
    const el = e.target as Element;
    const rm = el.closest<HTMLButtonElement>('[data-rm]'), mv = el.closest<HTMLButtonElement>('[data-mv]');
    if ((!rm && !mv) || active.size) return;
    if (rm) d = await api<Detail>(`courses/${id}/files/${rm.dataset.rm}`, { method: 'DELETE' });
    else {
      const f = d.files.find((x) => x.id === mv!.dataset.mv)!;
      d = await patch<Detail>(`courses/${id}/files/${f.id}`, { kind: f.kind === 'slides' ? 'exam' : 'slides' });
    }
    render();
  });

  // ---------------------------------------------------------------- making it
  const run_one = async (key: string): Promise<void> => {
    active.set(key, 0);
    render();
    try {
      const r = await fetch(`/api/studio/courses/${id}/steps/${encodeURIComponent(key)}`, { method: 'POST', credentials: 'same-origin', signal: stop.signal });
      if (!r.ok || !r.body) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = JSON.parse(buf.slice(0, nl)) as { t: string; chars?: number; prompt?: string; message?: string; model?: string };
          buf = buf.slice(nl + 1);
          if (line.t === 'progress') active.set(key, line.chars ?? 0);
          else if (line.t === 'pending') pending.set(key, line.prompt ?? '');
          else if (line.t === 'error') {
            if (line.model === 'missing') model_missing = true;
            else failed.set(key, line.message ?? '');
          }
        }
      }
    } catch (e) {
      if (!stop.signal.aborted) failed.set(key, (e as Error).message);
    } finally {
      active.delete(key);
    }
  };
  const PARALLEL = 3;
  const pump = async (): Promise<void> => {
    if (stop.signal.aborted) return;
    try {
      await refresh();
    } catch {
      note = t('net_down');
      note_bad = true;
      return render();
    }
    if (model_missing) return render();
    for (const k of d.next) {
      if (active.size >= PARALLEL) break;
      if (active.has(k) || pending.has(k) || failed.has(k)) continue;
      void run_one(k).then(pump);
    }
    render();
  };
  $<HTMLButtonElement>('.go').onclick = () => {
    pending.clear();
    failed.clear();
    note = '';
    note_bad = false;
    void pump();
  };

  // a course made in this visit joins the site's list before it is opened
  $<HTMLAnchorElement>('.open').onclick = async (e) => {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href')!;
    await load_studio_courses();
    navigate(href);
  };

  // ---------------------------------------------------------------- publishing, deleting
  $('.studio-pub').addEventListener('click', async (e) => {
    const sw = (e.target as Element).closest<HTMLButtonElement>('.set-switch');
    if (!sw) return;
    d = await patch<Detail>(`courses/${id}`, { public: sw.getAttribute('aria-checked') !== 'true' });
    render();
  });
  $<HTMLButtonElement>('.studio-del').onclick = async () => {
    if (!confirm(t('delete_confirm'))) return;
    await api(`courses/${id}`, { method: 'DELETE' });
    navigate('/studio');
  };

  render();
  const release = catch_drops((f) => void upload(f), () => root.querySelector<HTMLElement>('.course-drop'));
  // files dropped on "my courses" to start this course
  const carried = pending_uploads.get(id);
  if (carried) {
    pending_uploads.delete(id);
    void upload(carried);
  }
  return () => {
    stop.abort();
    release();
  };
}
