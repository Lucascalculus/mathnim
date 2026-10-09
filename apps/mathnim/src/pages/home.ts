// Home: continue, reviews due, ask anything, and the course map.
import { AskPanel, RECORDED, recorded_question, worker_validator } from '@mathnim/ai';
import { MASTERY, lesson_langs, tr, type Lesson } from '@mathnim/core';
import { esc, math_html, t, ui_lang } from '@mathnim/present';
import { ScenePlayer } from 'manim-web/ext/player';
import { COURSE, cached_generation, playable, type CourseLesson } from '../course';
import { apply_theme } from '../lessons/best-angle/theme';
import { provider } from '../settings';
import { home_context } from '../student';
import { last_lesson, learner, log } from '../store';

function skills_of(cl: CourseLesson) {
  return cl.lesson?.skills ?? cached_generation(cl.id)?.plan.skills ?? [];
}
function ring(cl: CourseLesson): string {
  const sk = skills_of(cl);
  if (!sk.length) return '<div class="ring"><i></i><i></i><i></i></div>';
  return `<div class="ring">${sk.map((s) => {
    const p = learner.mastery(s.id);
    return `<i class="${p >= MASTERY ? 'm' : learner.state.skills[s.id]?.attempts ? 'p' : ''}" title="${esc(tr(s.name, ui_lang()))}: ${Math.round(p * 100)}%"></i>`;
  }).join('')}</div>`;
}

/** The card's tag: what kind of lesson this is. */
function tag(l: CourseLesson): string {
  if (!l.lesson) return t(cached_generation(l.id) ? 'tag_ai' : 'tag_generate');
  if (l.lesson.mode === 'game') return t('tag_game');
  if (!l.lesson.steps.some((s) => 'scene' in s && s.scene)) return t('tag_reading');
  return t(tr(l.level, 'en').includes('university') ? 'tag_essay' : 'tag_guided');
}

export function home(root: HTMLElement): void {
  const lang = ui_lang();
  const all = COURSE.units.flatMap((u) => u.lessons);
  const last = all.find((l) => l.id === last_lesson()) ?? all[0];
  const skills = Object.keys(learner.state.skills);
  const mastered = skills.filter((s) => learner.mastered(s)).length;
  const due = learner.due().length;
  root.innerHTML = `
    <div class="hero">
      <div class="card">
        <div class="muted" style="font-size:13px">${math_html(tr(COURSE.title, lang))}</div>
        <h2 style="font-size:26px;letter-spacing:-.02em;margin:6px 0 10px">${esc(t('hero'))}</h2>
        <div class="row" style="margin:14px 0">
          <a class="mn-btn primary" href="#/lesson/${last.id}" style="text-decoration:none">${math_html(t(last_lesson() ? 'continue_lesson' : 'start_lesson', { title: tr(last.title, lang) }))}</a>
          <a class="mn-btn" href="#/review" style="text-decoration:none">${esc(due ? t('review_due', { n: due }) : t('practice'))}</a>
        </div>
        <div class="row muted" style="gap:22px;font-size:13px">
          <span><span class="stat" style="font-size:20px;color:var(--mn-fg)">${mastered}</span>${esc(t('skills_mastered', { n: skills.length }))}</span>
          <span><span class="stat" style="font-size:20px;color:var(--mn-fg)">${log.summary().answered}</span>${esc(t('answers_session'))}</span>
        </div>
      </div>
      <div class="card"><h2>${esc(t('ask_anything'))}</h2><div class="muted" style="font-size:13px;margin-bottom:10px">${esc(t('ask_sub'))}</div><div id="ask"></div></div>
    </div>
    <div class="units">${COURSE.units.map((u) => `
      <section class="unit"><h3>${math_html(tr(u.title, lang))}</h3><div class="lessons">${u.lessons.map((l) => `
        <a class="card lesson-card" href="#/lesson/${l.id}">
          <canvas class="thumb" width="640" height="360" data-lesson="${l.id}" aria-hidden="true"></canvas>
          <div class="meta"><span class="row" style="gap:6px"><span class="tag ${l.lesson ? '' : 'ai'}">${esc(tag(l))}</span>${l.lesson && lesson_langs(l.lesson).length > 1 ? `<span class="tag" title="English · 中文">EN · 中</span>` : ''}</span><span>${esc(t('minutes', { n: l.minutes }))}</span></div>
          <div style="font-weight:600;font-size:16px">${math_html(tr(l.title, lang))}</div>
          <div class="muted" style="font-size:13px">${math_html(tr(l.summary, lang))}</div>
          ${ring(l)}
        </a>`).join('')}</div></section>`).join('')}
    </div>`;
  void draw_thumbnails(root);
  new AskPanel(root.querySelector<HTMLElement>('#ask')!, {
    provider, validate: worker_validator(), log,
    suggestions: [RECORDED[5], RECORDED[4], RECORDED[1], RECORDED[3]].map((r) => recorded_question(r, ui_lang())),
    context: home_context,
  });
}

/** Each card shows the final frame of its lesson's first scene, rendered live by manim-web. */
async function draw_thumbnails(root: HTMLElement): Promise<void> {
  for (const c of root.querySelectorAll<HTMLCanvasElement>('canvas.thumb')) {
    const cl = COURSE.units.flatMap((u) => u.lessons).find((l) => l.id === c.dataset.lesson);
    const lesson = cl && playable(cl);
    const step = (cl?.thumb && lesson?.steps.find((s: any) => s.id === cl.thumb && s.scene)) || lesson?.steps.find((s: any) => s.scene);
    if (!step) {
      c.classList.add('empty');
      if (lesson) text_thumbnail(c, lesson);
      else {
        const g = c.getContext('2d')!;
        g.fillStyle = '#2f5bd3';
        g.globalAlpha = 0.85;
        g.font = '600 30px Inter, ui-sans-serif, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(t('thumb_ai'), c.width / 2, c.height / 2 + 10);
      }
      continue;
    }
    try {
      const spec: any = (step as any).scene;
      const scene = /^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec({ vars: {}, rng: Math.random });
      const player = new ScenePlayer(scene, c, { audio: false });
      apply_theme(player);
      await player.load();
      player.show_end();
    } catch {
      c.classList.add('empty');
    }
  }
}

/** A lesson made of text pages has no scene to show: draw a page with its kinds of steps instead. */
function text_thumbnail(c: HTMLCanvasElement, lesson: Lesson): void {
  const g = c.getContext('2d')!;
  const W = c.width, H = c.height;
  // a sheet of paper with lines of text, a formula bar and a code block
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#e3e3de';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(W * 0.2, H * 0.12, W * 0.6, H * 0.8, 18);
  g.fill();
  g.stroke();
  const x0 = W * 0.27, w = W * 0.46;
  let y = H * 0.22;
  // the title, in up to two lines
  g.fillStyle = '#15171a';
  g.font = '700 22px Inter, ui-sans-serif, system-ui, "PingFang SC", sans-serif';
  g.textAlign = 'left';
  const words = tr(lesson.title, ui_lang()).split(/(?<=\s)|(?=[\u3400-\u9fff])/);
  const lines: string[] = [''];
  for (const wd of words) {
    if (g.measureText(lines[lines.length - 1] + wd).width > w && lines[lines.length - 1]) {
      if (lines.length === 2) {
        lines[1] = lines[1].trimEnd() + '…';
        break;
      }
      lines.push('');
    }
    lines[lines.length - 1] += wd;
  }
  for (const line of lines) {
    g.fillText(line.trim(), x0, y + 16);
    y += 30;
  }
  y += 8;
  g.fillStyle = '#c9ccd3';
  for (const f of [1, 0.92, 0.6]) {
    g.fillRect(x0, y, w * f, 9);
    y += 22;
  }
  y += 6;
  g.fillStyle = 'rgba(47,91,211,0.12)';
  g.fillRect(x0 + w * 0.15, y, w * 0.7, 30);
  y += 46;
  g.fillStyle = '#f6f7f9';
  g.fillRect(x0, y, w, H * 0.86 - y);
  const kinds = new Set(lesson.steps.map((s) => s.kind));
  g.fillStyle = '#7c3aed';
  g.font = '600 15px ui-monospace, Menlo, monospace';
  g.textAlign = 'left';
  g.fillText([kinds.has('read') && 'read', kinds.has('derive') && 'derive', kinds.has('code') && 'code'].filter(Boolean).join(' · '), x0 + 14, y + 26);
}
