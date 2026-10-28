// Courses made from uploaded slides (server/studio): the visitor's own, and
// the finished ones an admin made public. They join COURSES at start, so the
// home page, course pages, lessons, the learner model and review treat them
// like the hand-made courses; each lesson's data is fetched when opened.
import type { Lang, Lesson, Skill } from '@mathnim/core';
import { COURSES, type Course, type LessonMeta } from './course';
import { learner } from './store';

/** What /api/studio/catalog lists for a course (server/studio/pipeline.ts catalog_entry). */
export interface StudioEntry {
  id: string;
  title: string;
  summary: string;
  audience: string;
  outcomes: string[];
  lang: Lang;
  mine: boolean;
  public: boolean;
  ready: boolean;
  units: { title: string; lessons: string[] }[];
  lessons: { id: string; title: string; summary: string; minutes: number; meta: LessonMeta }[];
}

export const studio_slug = (id: string) => `course-${id}`;
const MINE = { en: 'My courses', zh: '我的课程' };
const SHARED = { en: 'From course slides', zh: '课件生成的课程' };

export function course_of_entry(e: StudioEntry): Course {
  const by_id = new Map(e.lessons.map((l) => [l.id, l]));
  return {
    id: `studio-${e.id}`,
    slug: studio_slug(e.id),
    title: e.title,
    summary: e.summary,
    audience: e.audience || undefined,
    outcomes: e.outcomes.length ? e.outcomes : undefined,
    category: e.mine ? MINE : SHARED,
    accent: '#0F766E',
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
            const r = await fetch(`/api/studio/lessons/${encodeURIComponent(e.id)}/${encodeURIComponent(l.id)}`, { credentials: 'same-origin' });
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
  let entries: StudioEntry[] = [];
  try {
    const r = await fetch('/api/studio/catalog', { credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) entries = ((await r.json()) as { courses: StudioEntry[] }).courses ?? [];
  } catch {
    /* offline, or a host without the API: the hand-made courses only */
  }
  for (let i = COURSES.length - 1; i >= 0; i--) if (COURSES[i].id.startsWith('studio-')) COURSES.splice(i, 1);
  const courses = entries.map(course_of_entry);
  // the learner's own first (after the hand-made courses), then the shared ones
  COURSES.push(...courses.filter((c) => c.category === MINE), ...courses.filter((c) => c.category !== MINE));
  const skills: Skill[] = entries.flatMap((e) => e.lessons.flatMap((l) => l.meta.skills));
  learner.add_skills(skills);
}
