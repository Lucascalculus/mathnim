// Courses made from uploaded slides (server/studio): the visitor's own, the
// finished ones an admin made public, and demos published as static files
// (public/demo/, tools/studio_export.mjs) that need no account. They join
// COURSES at start, so the home page, course pages, lessons, the learner model
// and review treat them like the hand-made courses; each lesson's data is
// fetched when opened.
import type { L10n, Lang, Lesson, Skill } from '@mathnim/core';
import { COURSES, type Course, type LessonMeta } from './course';
import { learner } from './store';

/** What /api/studio/catalog lists for a course (server/studio/pipeline.ts catalog_entry). */
export interface StudioEntry {
  id: string;
  title: L10n;
  summary: L10n;
  audience: L10n;
  outcomes: L10n[];
  lang: Lang;
  mine: boolean;
  public: boolean;
  ready: boolean;
  /** Published as static files (public/demo/<id>/): its lessons load from there. */
  demo?: boolean;
  /** What it was made from. */
  origin?: { decks: number; exams: number };
  units: { title: L10n; lessons: string[] }[];
  lessons: { id: string; title: L10n; summary: L10n; minutes: number; meta: LessonMeta }[];
}

export const studio_slug = (id: string) => `course-${id}`;
const MINE = { en: 'My courses', zh: '我的课程' };
const SHARED = { en: 'Made from lecture slides', zh: '用课件生成的课程' };
const DEMO = { en: 'Made from lecture slides · demo', zh: '用课件生成的课程 · 示例' };
const lesson_url = (e: StudioEntry, lesson: string) =>
  e.demo ? `/demo/${encodeURIComponent(e.id)}/${encodeURIComponent(lesson)}.json` : `/api/studio/lessons/${encodeURIComponent(e.id)}/${encodeURIComponent(lesson)}`;

export function course_of_entry(e: StudioEntry): Course {
  const by_id = new Map(e.lessons.map((l) => [l.id, l]));
  return {
    id: `studio-${e.id}`,
    slug: studio_slug(e.id),
    title: e.title,
    summary: e.summary,
    audience: e.audience || undefined,
    outcomes: e.outcomes.length ? e.outcomes : undefined,
    category: e.mine ? MINE : e.demo ? DEMO : SHARED,
    accent: '#0F766E',
    generated: { decks: e.origin?.decks ?? 0, exams: e.origin?.exams ?? 0, lessons: e.lessons.length },
    units: e.units.map((u, i) => ({
      id: `u${i + 1}`,
      title: u.title,
      lessons: u.lessons.flatMap((id) => {
        const l = by_id.get(id);
        if (!l) return [];
        return [{
          id: l.id,
          title: l.title,
          summary: l.summary,
          minutes: l.minutes,
          meta: l.meta,
          load: async (): Promise<Lesson> => {
            const r = await fetch(lesson_url(e, l.id), { credentials: 'same-origin' });
            if (!r.ok) throw new Error(`lesson ${l.id}: HTTP ${r.status}`);
            return r.json();
          },
        }];
      }),
    })),
  };
}

/** Fetch the courses this visitor may take and add them to the site (again after signing in or out). */
export async function load_studio_courses(): Promise<void> {
  const list = async (url: string, pick: (d: unknown) => StudioEntry[]): Promise<StudioEntry[]> => {
    try {
      const r = await fetch(url, { credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
      return r.ok && (r.headers.get('content-type') ?? '').includes('json') ? pick(await r.json()) : [];
    } catch {
      return []; // offline, or a host without the API: the other courses only
    }
  };
  const [own, demos] = await Promise.all([
    list('/api/studio/catalog', (d) => (d as { courses?: StudioEntry[] }).courses ?? []),
    list('/demo/courses.json', (d) => (Array.isArray(d) ? (d as StudioEntry[]).map((e) => ({ ...e, demo: true, mine: false })) : [])),
  ]);
  // the owner of a course that is also a demo sees their own, live copy
  const entries = [...own, ...demos.filter((d) => !own.some((e) => e.id === d.id))];
  for (let i = COURSES.length - 1; i >= 0; i--) if (COURSES[i].id.startsWith('studio-')) COURSES.splice(i, 1);
  const courses = entries.map(course_of_entry);
  // the learner's own first (after the hand-made courses), then the shared ones and the demos
  COURSES.push(...courses.filter((c) => c.category === MINE), ...courses.filter((c) => c.category === SHARED), ...courses.filter((c) => c.category === DEMO));
  const skills: Skill[] = entries.flatMap((e) => e.lessons.flatMap((l) => l.meta.skills));
  learner.add_skills(skills);
}
