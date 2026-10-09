// Teacher/parent dashboard: mastery per skill, misconceptions, activity.
import { load_events, tr, type LearningEvent } from '@mathnim/core';
import { esc, math_html, plural_s, t, ui_lang } from '@mathnim/present';
import { all_skills, find_lesson } from '../course';
import { learner } from '../store';

const pct = (x: number) => `${Math.round(x * 100)}%`;
export function dashboard(root: HTMLElement): void {
  const lang = ui_lang();
  const ev = load_events('mathnim.events');
  const answers = ev.filter((e) => e.verb === 'answered');
  const correct = answers.filter((e) => e.result?.correct).length;
  const hints = ev.filter((e) => e.verb === 'hinted').length;
  const sessions = new Set(ev.filter((e) => e.verb === 'started').map((e) => e.lesson)).size;
  const mis = new Map<string, { n: number; lesson: string }>();
  for (const a of ev.filter((e) => e.verb === 'answered' || e.verb === 'detected')) if (a.result?.misconception) {
    const k = `${a.lesson}:${a.result.misconception}`;
    mis.set(k, { n: (mis.get(k)?.n ?? 0) + 1, lesson: a.lesson });
  }
  const describe = (k: string) => {
    const [lessonId, id] = k.split(':');
    const l = find_lesson(lessonId)?.lesson;
    const m = l?.misconceptions?.find((x) => x.id === id);
    return m ? tr(m.description, lang) : id;
  };
  const skills = all_skills();
  // skills from lessons no longer in the course: shown only if practised
  const human = (id: string) => id.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  for (const [id, st] of Object.entries(learner.state.skills)) if (st.attempts && !skills.some((s) => s.id === id)) skills.push({ id, name: human(id) });
  // active time: gaps between events, each capped at 3 minutes (idle tabs don't count)
  let time = 0;
  for (let i = 1; i < ev.length; i++) time += Math.min(ev[i].t - ev[i - 1].t, 180000) / 60000;
  root.innerHTML = `
    <div class="grid2">
      <div class="card"><div class="muted">${esc(t('answers'))}</div><div class="stat">${answers.length}</div><div class="muted">${esc(t('pct_correct', { p: answers.length ? pct(correct / answers.length) : '–' }))} · ${esc(t('n_hints', { n: hints, s: plural_s(hints) }))} · ${esc(t('n_lessons_started', { n: sessions, s: plural_s(sessions) }))}</div></div>
      <div class="card"><div class="muted">${esc(t('time_with_app'))}</div><div class="stat">${esc(t('minutes', { n: time.toFixed(0) }))}</div><div class="muted">${esc(t('items_due', { n: learner.due().length, s: plural_s(learner.due().length) }))}</div></div>
    </div>
    <div class="grid2" style="margin-top:18px">
      <div class="card"><h2>${esc(t('mastery_by_skill'))}</h2><div class="bars">${skills.map((s) => {
        const st = learner.state.skills[s.id];
        const p = learner.mastery(s.id);
        return `<div class="bar"><span>${math_html(tr(s.name, lang))}</span><span class="track"><i style="width:${pct(p)}"></i></span><span class="muted">${pct(p)}${st?.attempts ? ` · ${st.correct}/${st.attempts}` : ''}</span></div>`;
      }).join('')}</div></div>
      <div class="card"><h2>${esc(t('misconceptions_seen'))}</h2>${mis.size ? `<div class="bars">${[...mis.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<div class="bar" style="grid-template-columns:1fr 60px"><span>${math_html(describe(k))}</span><span class="muted">${v.n}×</span></div>`).join('')}</div>` : `<div class="muted">${esc(t('none_yet'))}</div>`}</div>
    </div>
    <div class="card" style="margin-top:18px"><h2>${esc(t('recent_activity'))}</h2><div id="recent" class="muted" style="font-size:13px"></div>
      <div class="row" style="margin-top:12px"><button class="mn-btn" id="export">${esc(t('export_events'))}</button><button class="mn-btn" id="reset">${esc(t('reset_progress'))}</button></div></div>`;
  const recent = root.querySelector<HTMLElement>('#recent')!;
  const title = (id: string) => {
    const l = find_lesson(id);
    return l ? tr(l.title, lang) : id;
  };
  recent.innerHTML = ev.slice(-14).reverse().map((e: LearningEvent) => `<div>${new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${esc(t(`verb_${e.verb}`))} · ${esc(title(e.lesson))}${e.step ? ` / ${e.step}` : ''}${e.result?.correct !== undefined ? (e.result.correct ? ' ✓' : ' ✗') : ''}</div>`).join('') || esc(t('nothing_yet'));
  root.querySelector<HTMLButtonElement>('#export')!.onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ev, null, 1)], { type: 'application/json' }));
    a.download = 'mathnim-events.json';
    a.click();
  };
  root.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
    if (!confirm(t('reset_confirm'))) return;
    learner.reset();
    localStorage.removeItem('mathnim.events');
    dashboard((root.innerHTML = '', root));
  };
}
