// /studio: courses made from uploaded slides and practice exams.
//   /studio        my uploads (sign in first)
//   /studio/<id>   one course: its files, making it step by step, what the slides cover
// The steps run on the server one at a time (server/studio/pipeline.ts); this
// page asks which can run and keeps up to three going until none is left.
import { esc, t, ui_lang } from '@mathnim/present';
import { accounts_available, current_user, studio_available } from '../account';
import { lesson_path } from '../course';
import { login_form } from '../login';
import { navigate, type Route } from '../router';
import { load_studio_courses, studio_slug } from '../studio_courses';

const CSS = `
.studio{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.studio [hidden]{display:none!important}
.studio h1{margin:0;font-size:30px;letter-spacing:-.02em;line-height:1.2}
.studio-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.studio-head h1{flex:1;min-width:0}
.studio-head .mn-btn{text-decoration:none}
.studio-lead{margin:0;color:var(--mn-muted);font-size:15px}
.studio-gate{width:min(440px,100%);box-sizing:border-box;align-self:center;margin-top:40px;display:flex;flex-direction:column;gap:14px;padding:26px}
.studio-gate h1{font-size:24px}
.studio-list{display:flex;flex-direction:column;gap:10px}
.studio-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 18px;text-decoration:none;color:inherit;transition:border-color .15s}
.studio-row:hover{border-color:var(--mn-accent)}
.studio-row b{font-weight:600;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.studio-row span{flex:none;font-size:13px;color:var(--mn-muted)}
.studio-files{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.drop{display:flex;flex-direction:column;gap:10px;padding:16px 18px;transition:border-color .15s,background-color .15s}
.drop.over{border-color:var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 5%,var(--mn-panel))}
.drop h3{margin:0;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--mn-muted)}
.drop ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.drop li{display:flex;align-items:center;gap:8px;font-size:14px;padding:4px 0;border-bottom:1px solid var(--mn-faint)}
.drop li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drop li small{flex:none;color:var(--mn-muted);font-size:12px;font-variant-numeric:tabular-nums}
.drop li button{flex:none;width:22px;height:22px;border:0;border-radius:50%;background:none;color:var(--mn-muted);cursor:pointer;font-size:15px;line-height:1}
.drop li button:hover{background:var(--mn-faint);color:var(--mn-bad)}
.drop-add{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px dashed var(--mn-border);border-radius:9px;font-size:13.5px;color:var(--mn-muted);cursor:pointer}
.drop-add:hover{border-color:var(--mn-accent);color:var(--mn-accent)}
.drop-note{margin:0;font-size:13px;color:var(--mn-muted)}
.drop-note.bad{color:var(--mn-bad)}
.studio-run{display:flex;flex-direction:column;gap:12px;padding:18px}
.run-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.run-msg{font-size:14px;color:var(--mn-muted)}
.run-msg.bad{color:var(--mn-bad)}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.steps li{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid var(--mn-faint);font-size:14px}
.steps li:first-child{border-top:0}
.steps i{font-style:normal;text-align:center;color:var(--mn-muted)}
.steps .done i{color:var(--mn-good)}
.steps .failed i,.steps .failed .st{color:var(--mn-bad)}
.steps .active i{color:var(--mn-accent);animation:st-blink 1.2s ease-in-out infinite}
.steps .label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.steps .st{font-size:13px;color:var(--mn-muted);white-space:nowrap}
.steps .active .st{color:var(--mn-accent)}
.steps code{grid-column:2/-1;font:11.5px ui-monospace,Menlo,monospace;color:var(--mn-muted);word-break:break-all}
@keyframes st-blink{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.steps .active i{animation:none}}
.cover{padding:18px;display:flex;flex-direction:column;gap:10px}
.cover h2{margin:0;font-size:16px}
.cover-sum{margin:0;font-size:14px;color:var(--mn-muted)}
.cover table{width:100%;border-collapse:collapse;font-size:13.5px}
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
@media (max-width:640px){.studio h1{font-size:24px}.studio-files{grid-template-columns:minmax(0,1fr)}.cover td.pg,.cover th.pg{display:none}}
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
  plan: null | { course: { title: string }; lessons: { id: string; title: string; decks: string[]; final: boolean }[]; practice: null | { title: string; final: boolean } };
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
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export async function studio_page(root: HTMLElement, route: Route): Promise<() => void> {
  inject();
  const id = route.page === 'studio' ? route.id : undefined;
  if (!accounts_available() || !studio_available()) {
    root.innerHTML = `<div class="studio"><div class="card studio-gate"><h1>${esc(t('studio_title'))}</h1><p class="studio-lead">${esc(t(accounts_available() ? 'model_missing' : 'accounts_off'))}</p></div></div>`;
    return () => {};
  }
  if (!current_user()) {
    root.innerHTML = `<div class="studio"><div class="card studio-gate"><h1>${esc(t('studio_title'))}</h1><p class="studio-lead">${esc(t('studio_lead'))}</p></div></div>`;
    root.querySelector('.studio-gate')!.append(login_form());
    return () => {};
  }
  return id ? course_view(root, id) : list_view(root);
}

async function list_view(root: HTMLElement): Promise<() => void> {
  root.innerHTML = `<div class="studio"><header class="studio-head"><h1>${esc(t('my_studio'))}</h1><button type="button" class="mn-btn primary">${esc(t('studio_new'))}</button></header><p class="studio-lead">${esc(t('studio_lead'))}</p><div class="studio-list"></div></div>`;
  root.querySelector<HTMLButtonElement>('.studio-head button')!.onclick = async (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    const { id } = await api<{ id: string }>('courses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: ui_lang() }) });
    navigate(`/studio/${id}`);
  };
  const { courses } = await api<{ courses: Summary[] }>('courses').catch(() => ({ courses: [] as Summary[] }));
  const status = (c: Summary) =>
    !c.files ? t('st_empty') : !c.lessons ? t('st_waiting') : c.done < c.lessons ? t('st_making', { k: c.done, n: c.lessons }) : t('st_done', { n: c.lessons });
  root.querySelector('.studio-list')!.innerHTML = courses
    .map((c) => `<a class="card studio-row" href="/studio/${esc(c.id)}"><b>${esc(c.title || t('untitled'))}</b><span>${esc(status(c))}</span></a>`)
    .join('');
  return () => {};
}

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
  let note = '', note_bad = false, model_missing = false;

  root.innerHTML = `<div class="studio">
    <a class="backlink" href="/studio">‹ ${esc(t('my_studio'))}</a>
    <header class="studio-head"><h1></h1><a class="mn-btn primary open" hidden></a></header>
    <section class="studio-files">
      <div class="card drop" data-kind="slides"><h3>${esc(t('slides'))}</h3><ul></ul><label class="drop-add">＋ ${esc(t('add_pdf'))}<input type="file" accept="application/pdf,.pdf" multiple hidden></label></div>
      <div class="card drop" data-kind="exam"><h3>${esc(t('exams'))}</h3><ul></ul><label class="drop-add">＋ ${esc(t('add_pdf'))}<input type="file" accept="application/pdf,.pdf,.txt" multiple hidden></label></div>
    </section>
    <p class="drop-note" hidden></p>
    <section class="card studio-run"><div class="run-bar"><button type="button" class="mn-btn primary go"></button><span class="run-msg"></span></div><ol class="steps"></ol></section>
    <section class="card cover" hidden></section>
    <footer class="studio-foot"><span class="studio-pub"></span><button type="button" class="studio-del">${esc(t('delete_course'))}</button></footer>
  </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

  // ---------------------------------------------------------------- drawing
  const render = () => {
    $('h1').textContent = d.plan?.course.title || d.course.title || t('untitled');
    const open = $<HTMLAnchorElement>('.open');
    const first = d.entry?.lessons[0];
    open.hidden = !first;
    if (first) {
      open.href = `/${studio_slug(d.course.id)}`;
      open.textContent = t('open_course');
    }
    for (const kind of ['slides', 'exam'] as const) {
      $(`.drop[data-kind="${kind}"] ul`).innerHTML = d.files
        .filter((f) => f.kind === kind)
        .map((f) => `<li><span title="${esc(f.name)}">${esc(f.name)}</span><small>${mb(f.size)}</small><button type="button" data-rm="${esc(f.id)}" aria-label="${esc(t('remove'))}" title="${esc(t('remove'))}">×</button></li>`)
        .join('');
    }
    $('.studio-run').hidden = !d.files.some((f) => f.kind === 'slides');
    const go = $<HTMLButtonElement>('.go');
    const working = active.size > 0;
    const has_slides = d.files.some((f) => f.kind === 'slides');
    go.textContent = Object.keys(d.steps).length ? t('generate_more') : t('generate');
    go.hidden = !d.next.length && !working;
    go.disabled = working || !has_slides;
    const msg = $('.run-msg');
    msg.textContent = model_missing ? t('model_missing') : note;
    msg.classList.toggle('bad', model_missing || note_bad);
    $('.steps').innerHTML = step_rows().join('');
    draw_coverage();
    const pub = $('.studio-pub');
    pub.innerHTML = d.admin
      ? `<button type="button" class="set-switch" role="switch" aria-checked="${d.course.public}" aria-label="${esc(t('publish'))}"></button><span>${esc(t('publish'))}<small>${esc(t('publish_help'))}</small></span>`
      : '';
  };

  const row = (state: 'done' | 'active' | 'todo' | 'failed', label: string, st: string, extra = '') =>
    `<li class="${state}"><i aria-hidden="true">${state === 'done' ? '✓' : state === 'failed' ? '!' : state === 'active' ? '●' : '○'}</i><span class="label">${esc(label)}</span><span class="st">${esc(st)}</span>${extra}</li>`;
  const step_state = (keys: string[], done: boolean, running_word: string) => {
    const k = keys.find((x) => failed.has(x));
    if (k) return row('failed', '', `${t('s_failed')}`, `<code>${esc(failed.get(k)!)}</code>`);
    const p = keys.find((x) => pending.has(x));
    if (p) return row('todo', '', t('s_pending'), `<code>${esc(pending.get(p)!)}</code>`);
    if (keys.some((x) => active.has(x))) return row('active', '', running_word);
    return row(done ? 'done' : 'todo', '', done ? t('s_done') : t('s_todo'));
  };
  const with_label = (html: string, label: string) => html.replace('<span class="label"></span>', `<span class="label">${esc(label)}</span>`);
  function step_rows(): string[] {
    const out: string[] = [];
    const slides = d.files.filter((f) => f.kind === 'slides');
    const exams = d.files.filter((f) => f.kind === 'exam');
    if (!slides.length) return out;
    const maps = slides.map((f) => `map.${f.id}`);
    const mapped = maps.filter((k) => d.steps[k]).length;
    out.push(with_label(step_state(maps, mapped === maps.length, `${t('s_running')} · ${mapped}/${maps.length}`), `${t('step_maps')} · ${mapped}/${maps.length}`));
    if (exams.length) out.push(with_label(step_state(['exam'], !!d.steps.exam, t('s_running')), t('step_exam')));
    out.push(with_label(step_state(['plan'], !!d.plan, t('s_running')), t('step_plan')));
    d.plan?.lessons.forEach((l, i) => {
      const les = d.steps[`lesson.${l.id}`] as { rev: number } | undefined;
      const writing = active.has(`lesson.${l.id}`);
      const word = writing ? (les ? t('s_revising') : t('s_writing')) : t('s_checking');
      out.push(with_label(step_state([`lesson.${l.id}`, `review.${l.id}`], l.final, word), t('step_lesson', { n: i + 1, title: l.title })));
    });
    if (d.plan?.practice) out.push(with_label(step_state(['lesson.practice'], d.plan.practice.final, t('s_writing')), d.plan.practice.title));
    return out;
  }

  function draw_coverage() {
    const box = $('.cover');
    if (!d.plan || !d.coverage.length) return void (box.hidden = true);
    box.hidden = false;
    const core = d.coverage.filter((c) => c.weight === 'core');
    const n = (s: string) => core.filter((c) => c.status === s).length;
    const lessons = new Map(d.plan.lessons.map((l, i) => [l.id, { n: i + 1, title: l.title }]));
    const word: Record<string, string> = { taught: t('cov_taught'), thin: t('cov_thin'), missing: t('cov_missing'), planned: t('cov_planned'), unplanned: t('cov_unplanned') };
    const shown = new Set((d.entry?.lessons ?? []).map((l) => l.id));
    box.innerHTML = `<h2>${esc(t('coverage'))}</h2>
      <p class="cover-sum">${esc(t('cov_summary', { n: core.length, ok: n('taught'), thin: n('thin'), miss: n('missing') + n('unplanned') }))}</p>
      <div class="cover-wrap"><table><thead><tr><th>${esc(t('cov_point'))}</th><th class="pg">${esc(t('cov_where'))}</th><th>${esc(t('cov_lesson'))}</th><th></th></tr></thead><tbody>${d.coverage
        .map((c) => {
          const l = c.lesson ? lessons.get(c.lesson) : undefined;
          const lid = `${d.course.id}-${c.lesson}`;
          const where = l ? (shown.has(lid) ? `<a href="${lesson_path(lid)}">${esc(t('step_lesson', { n: l.n, title: l.title }))}</a>` : esc(t('step_lesson', { n: l.n, title: l.title }))) : '';
          const status = c.weight === 'minor' && c.status === 'unplanned' ? t('cov_minor') : word[c.status] ?? c.status;
          return `<tr class="${c.weight}"><td>${esc(c.name)}</td><td class="pg">${esc(c.deck.replace(/\.pdf$/i, ''))} · ${esc(c.pages)}</td><td>${where}</td><td><span class="cv ${c.weight === 'minor' && c.status === 'unplanned' ? 'planned' : esc(c.status)}">${esc(status)}${c.note && c.status !== 'taught' ? `<span class="cv-note">${esc(c.note)}</span>` : ''}</span></td></tr>`;
        })
        .join('')}</tbody></table></div>`;
  }

  const refresh = async () => {
    d = await api<Detail>(`courses/${id}`);
    render();
  };

  // ---------------------------------------------------------------- files
  const upload = async (kind: 'slides' | 'exam', files: File[]) => {
    const notice = $('.drop-note');
    for (const f of files) {
      const pdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      const txt = kind === 'exam' && /\.txt$/i.test(f.name);
      const problem = !pdf && !txt ? t('not_pdf', { name: f.name }) : f.size > 32 * 1024 * 1024 ? t('too_big', { name: f.name }) : '';
      if (problem) {
        notice.hidden = false;
        notice.className = 'drop-note bad';
        notice.textContent = problem;
        continue;
      }
      notice.hidden = false;
      notice.className = 'drop-note';
      notice.textContent = t('uploading', { name: f.name });
      try {
        d = await api<Detail>(`courses/${id}/files?kind=${kind}&name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f, headers: { 'content-type': f.type || 'application/octet-stream' } });
        render();
        notice.hidden = true;
      } catch (e) {
        notice.className = 'drop-note bad';
        notice.textContent = (e as Error).message;
      }
    }
  };
  root.querySelectorAll<HTMLElement>('.drop').forEach((box) => {
    const kind = box.dataset.kind as 'slides' | 'exam';
    const input = box.querySelector<HTMLInputElement>('input')!;
    input.onchange = () => {
      void upload(kind, [...(input.files ?? [])]);
      input.value = '';
    };
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('over');
    });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('over');
      void upload(kind, [...(e.dataTransfer?.files ?? [])]);
    });
    box.addEventListener('click', async (e) => {
      const rm = (e.target as Element).closest<HTMLButtonElement>('[data-rm]');
      if (!rm || active.size) return;
      d = await api<Detail>(`courses/${id}/files/${rm.dataset.rm}`, { method: 'DELETE' });
      render();
    });
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
    d = await api<Detail>(`courses/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ public: sw.getAttribute('aria-checked') !== 'true' }) });
    render();
  });
  $<HTMLButtonElement>('.studio-del').onclick = async () => {
    if (!confirm(t('delete_confirm'))) return;
    await api(`courses/${id}`, { method: 'DELETE' });
    navigate('/studio');
  };

  render();
  return () => stop.abort();
}
