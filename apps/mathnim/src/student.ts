// What the tutor knows about the student when they ask a question: level,
// where they are, what is on their screen, mastery, and mistakes they made.
import type { AskContext } from '@mathnim/ai';
import { describe_step, is_text_step, load_events, tr } from '@mathnim/core';
import { ui_lang, type LessonView } from '@mathnim/present';
import { describe_text } from 'manim-web/ext/describe';
import { COURSE, all_skills, find_lesson, playable, type CourseLesson } from './course';
import { language_name } from './settings';
import { learner } from './store';

const MAX_SCREEN = 2500; // characters of scene description (keeps the prompt small and fast)
/** Visual-catalog topics per lesson: the AI looks there first when the catalog is large. */
const LESSON_TOPICS: Record<string, string[]> = {
  'pizza-game': ['geometry', 'circles', 'area', 'pi'],
  pizza: ['geometry', 'circles', 'area', 'pi'],
  'eigen-pca': ['linear algebra', 'eigenvectors', 'determinant', 'pca', 'covariance'],
};

/** Misconceptions shown in answers (most recent first), as descriptions. */
function mistakes(lesson_id?: string, max = 5): string[] {
  const out: string[] = [];
  const answers = load_events('mathnim.events').filter((e) => (e.verb === 'answered' || e.verb === 'detected') && e.result?.misconception && (!lesson_id || e.lesson === lesson_id));
  for (const e of answers.reverse()) {
    const cl = find_lesson(e.lesson);
    const m = (cl && playable(cl))?.misconceptions?.find((x) => x.id === e.result!.misconception);
    const d = m ? tr(m.description, ui_lang()) : e.result!.misconception!;
    if (!out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

function mastery(skill_ids?: string[]): string {
  const skills = all_skills().filter((s) => (skill_ids ? skill_ids.includes(s.id) : (learner.state.skills[s.id]?.attempts ?? 0) > 0));
  return skills.map((s) => `${tr(s.name, ui_lang())} ${Math.round(learner.mastery(s.id) * 100)}%`).join(', ');
}

/** Context for a question asked inside a lesson. */
export function lesson_context(cl: CourseLesson, view: LessonView): AskContext {
  const lesson = playable(cl)!;
  const lang = view.lang;
  const step = view.runtime.step;
  const player = view.runtime.player;
  // a text page has no scene: what the student reads is the page itself (and a case's brief)
  const screen = step && (is_text_step(step) || (step.kind === 'checkpoint' && step.group)) ? describe_step(step, lang) : player ? describe_text(player.scene) : '';
  return {
    topics: LESSON_TOPICS[cl.id],
    level: cl.level !== undefined ? tr(cl.level, lang) : cl.entry?.level,
    lesson: `${tr(lesson.title, lang)}${cl.entry ? ` - ${cl.entry.objectives.join('; ')}` : ''}`,
    step: step ? `${tr(step.title, lang) || step.id} (${step.kind})` : undefined,
    on_screen: screen ? screen.slice(0, MAX_SCREEN) : undefined,
    learner: mastery(lesson.skills.map((s) => s.id)) || undefined,
    misconceptions: mistakes(cl.id),
    learner_language: language_name(lang),
  };
}

/** Context for a question asked from the home page. */
export function home_context(): AskContext {
  return {
    level: 'secondary school',
    lesson: `Course: ${tr(COURSE.title, ui_lang())}`,
    learner: mastery() || undefined,
    misconceptions: mistakes(),
    learner_language: language_name(ui_lang()),
  };
}
