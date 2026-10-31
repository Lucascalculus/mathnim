// What a learner adds to a lesson from the tutor: an answer kept as a small edit to the page's text (a sentence or
// two after the passage it is about, written in the text's voice), and whole pages the tutor wrote for them (on
// their yes). Both are kept in this browser like notes (and go up to the account with the other mathnim.* records);
// nobody else sees them.
import type { Block, Lesson, ReadStep } from '@mathnim/core';

/** An edit to the text: `text` inserted after the block `at` of its step (found again by its first words, `head`); `q` asked for it. */
export interface AddedAnswer {
  id: string;
  step: string;
  at: number;
  head: string;
  q: string;
  text: string;
  ink: number;
}
/** A page written for this learner, after the step `after`. */
export interface AddedPage {
  id: string;
  after: string;
  title: string;
  blocks: Block[];
  /** The question it answers. */
  q: string;
}

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write<T>(key: string, v: T[]): void {
  try {
    if (v.length) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    /* no storage */
  }
}

const answers_key = (lesson: string) => `mathnim.added.${lesson}`;
export const added_answers = (lesson: string): AddedAnswer[] => read<AddedAnswer>(answers_key(lesson));
export function add_answer(lesson: string, a: AddedAnswer): void {
  write(answers_key(lesson), [...added_answers(lesson).filter((x) => x.id !== a.id), a]);
}
export function remove_answer(lesson: string, id: string): void {
  write(answers_key(lesson), added_answers(lesson).filter((x) => x.id !== id));
}

const pages_key = (lesson: string) => `mathnim.pages.${lesson}`;
export const added_pages = (lesson: string): AddedPage[] => read<AddedPage>(pages_key(lesson));
export function add_page(lesson: string, p: AddedPage): void {
  write(pages_key(lesson), [...added_pages(lesson), p]);
}
export function remove_page(lesson: string, id: string): void {
  write(pages_key(lesson), added_pages(lesson).filter((x) => x.id !== id));
}
/** Is this step a page written for the learner? */
export const is_added_page = (id: string | undefined) => !!id?.startsWith('added-');

/** The lesson with the learner's own pages in place (a copy; the lesson itself is shared). */
export function with_added_pages(lesson: Lesson): Lesson {
  const pages = added_pages(lesson.id);
  if (!pages.length) return lesson;
  const steps = [...lesson.steps];
  for (const p of pages) {
    const at = steps.findIndex((s) => s.id === p.after);
    if (at < 0) continue;
    // after its step and any pages already added there
    let i = at + 1;
    while (i < steps.length && is_added_page(steps[i].id)) i++;
    const step: ReadStep = { kind: 'read', id: p.id, title: p.title, blocks: p.blocks };
    steps.splice(i, 0, step);
  }
  return { ...lesson, steps };
}
