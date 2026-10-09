// One learner model and one event log for the whole app, persisted locally.
import { EventLog, LearnerModel, local_event_sink, local_store } from '@mathnim/core';
import { all_skills } from './course';

export const learner = new LearnerModel(local_store('mathnim.learner'), all_skills());
export const log = new EventLog();
log.add_sink(local_event_sink('mathnim.events'));

const LAST = 'mathnim.last';
export const remember_last = (id: string) => localStorage.setItem(LAST, id);
export const last_lesson = () => localStorage.getItem(LAST);
