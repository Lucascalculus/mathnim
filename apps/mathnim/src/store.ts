// One learner model and one event log for the whole app, persisted locally.
import { EventLog, LearnerModel, load_events, local_event_sink, local_store } from '@mathnim/core';
import { COURSES, all_skills, course_of, type Course } from './course';

export const learner = new LearnerModel(local_store('mathnim.learner'), all_skills());
export const log = new EventLog();
// (not the tutor's answers: they are kept as notes, and would fill the browser's storage; see account.ts)
const keep_local = local_event_sink('mathnim.events');
log.add_sink((e) => e.verb !== 'asked' && keep_local(e));

const LAST = 'mathnim.last';
const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
/** Remember the lesson opened last, overall and within its course. */
export const remember_last = (id: string) => {
  try {
    localStorage.setItem(LAST, id);
    const c = course_of(id);
    if (c) localStorage.setItem(`${LAST}.${c.id}`, id);
  } catch {
    /* no storage */
  }
};
export const last_lesson = () => get(LAST);
/** The stops of a course's learning map the learner has already seen cleared (so each is celebrated once). */
export function map_seen(course_id: string): string[] {
  try {
    return JSON.parse(get(`mathnim.map.${course_id}`) ?? '[]');
  } catch {
    return [];
  }
}
export const set_map_seen = (course_id: string, ids: string[]) => {
  try {
    localStorage.setItem(`mathnim.map.${course_id}`, JSON.stringify(ids));
  } catch {
    /* no storage */
  }
};
/** The lesson opened last in this course (null if none). */
export const last_in_course = (c: Course): string | null => {
  const id = get(`${LAST}.${c.id}`) ?? last_lesson();
  return id && course_of(id) === c ? id : null;
};
/** The course of the lesson opened last, else the first (the tutor's context outside a lesson). */
export function current_course(): Course {
  return course_of(last_lesson() ?? '') ?? COURSES[0];
}
/** done: finished at least once; started: reached a later step or opened last in its course; new: not begun. */
export function lesson_status(id: string): 'done' | 'started' | 'new' {
  if (lesson_finished(id)) return 'done';
  try {
    if (+JSON.parse(get(`mathnim.progress.${id}`) ?? '{}').furthest > 0) return 'started';
  } catch {
    /* unreadable */
  }
  const c = course_of(id);
  return c && get(`${LAST}.${c.id}`) === id ? 'started' : 'new';
}
/** Has the learner finished this lesson (the lesson view keeps `finished`; old progress shows in the event log)? */
export function lesson_finished(id: string): boolean {
  try {
    if (JSON.parse(get(`mathnim.progress.${id}`) ?? '{}').finished) return true;
  } catch {
    /* unreadable */
  }
  return finished_from_events().has(id);
}
let from_events: Set<string> | null = null;
const finished_from_events = () => (from_events ??= new Set(load_events('mathnim.events').filter((e) => e.verb === 'completed').map((e) => e.lesson)));
