// One learner model and one event log for the whole app, persisted locally.
import { EventLog, LearnerModel, local_event_sink, local_store } from '@mathnim/core';
import { COURSES, all_skills, course_of, type Course } from './course';

export const learner = new LearnerModel(local_store('mathnim.learner'), all_skills());
export const log = new EventLog();
log.add_sink(local_event_sink('mathnim.events'));

const LAST = 'mathnim.last';
const COURSE_KEY = 'mathnim.course';
/** Remember the lesson opened last (and switch the home page to its course). */
export const remember_last = (id: string) => {
  localStorage.setItem(LAST, id);
  const c = course_of(id);
  if (c) localStorage.setItem(COURSE_KEY, c.id);
};
export const last_lesson = () => localStorage.getItem(LAST);
/** The course the home page shows: the one chosen last, else the last lesson's, else the first. */
export function current_course(): Course {
  const id = localStorage.getItem(COURSE_KEY);
  return COURSES.find((c) => c.id === id) ?? course_of(last_lesson() ?? '') ?? COURSES[0];
}
export const choose_course = (id: string) => localStorage.setItem(COURSE_KEY, id);
