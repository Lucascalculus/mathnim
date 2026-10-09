// The syllabus: units of lessons. Authored lessons are code; the others are
// syllabus entries that the AI turns into lessons on demand (cached locally).
// Titles and summaries are L10n (plain strings are the same in every language).
import { INSCRIBED_ENTRY, lesson_from_generated, type GeneratedLesson, type SyllabusEntry } from '@mathnim/ai';
import type { L10n, Lesson, Skill } from '@mathnim/core';
import { lesson as bestAngle } from './lessons/best-angle/lesson';
import { lesson as pizza } from './lessons/pizza/lesson';
import { lesson as pizzaGame } from './lessons/pizza-game/lesson';
import { lesson as eigenPca } from './lessons/eigen-pca/lesson';
import { lesson as textDemo } from './lessons/text-pages-demo/lesson';

export interface CourseLesson {
  id: string;
  title: L10n;
  summary: L10n;
  /** Hand-authored lesson, or a syllabus entry to generate. */
  lesson?: Lesson;
  entry?: SyllabusEntry;
  minutes: number;
  /** Who it is for, e.g. 'grades 7-9' (generated lessons use their syllabus entry's level). */
  level?: L10n;
  /** Step whose figure (final frame) is the card thumbnail; default: the first step with a figure. */
  thumb?: string;
}
export interface Unit {
  id: string;
  title: L10n;
  lessons: CourseLesson[];
}

export const COURSE: { title: L10n; units: Unit[] } = {
  title: { en: 'Geometry through motion', zh: '在运动中学几何' },
  units: [
    {
      id: 'area', title: { en: 'Circles and area', zh: '圆与面积' },
      lessons: [
        { id: pizzaGame.id, title: 'Pizza shop', summary: 'A game: bet on the deal, cover, cut and rebuild the pizza, run the shop - and find out why a circle’s area is πr².', lesson: pizzaGame, minutes: 15, level: 'grades 7-9', thumb: 'bet' },
        { id: pizza.id, title: 'The pizza deal', summary: 'One 16-inch pizza or two 8-inch ones? Slice a circle into a rectangle and see why its area is πr².', lesson: pizza, minutes: 15, level: 'grades 7-9' },
      ],
    },
    {
      id: 'linalg', title: { en: 'Linear algebra (university)', zh: '线性代数（大学）' },
      lessons: [
        { id: eigenPca.id, title: 'The directions a matrix can’t turn', summary: 'Eigenvectors and eigenvalues from the picture up - hold the matrix in your hands - and why they are exactly what PCA needs.', lesson: eigenPca, minutes: 20, level: 'university, first-year linear algebra', thumb: 'why' },
      ],
    },
    {
      id: 'circles', title: { en: 'Angles and circles', zh: '角与圆' },
      lessons: [
        { id: INSCRIBED_ENTRY.id, title: INSCRIBED_ENTRY.title, summary: 'Why every point on an arc sees a chord at the same angle.', entry: INSCRIBED_ENTRY, minutes: 8 },
        { id: bestAngle.id, title: bestAngle.title, summary: 'A winger runs in: where is the goal widest? Circles give the answer.', lesson: bestAngle, minutes: 15, thumb: 'explore', level: 'grades 9-11' },
        {
          id: 'tangent-secant', title: 'Tangents and secants', summary: 'The power of a point: why d² = a·b.', minutes: 10,
          entry: { id: 'tangent-secant', title: 'Tangents and secants', unit: 'Angles and circles', level: 'Grade 10', objectives: ['A tangent is perpendicular to the radius at the point of contact.', 'Tangent-secant theorem: the square of the tangent length equals the product of the secant segments.', 'Use it to find unknown lengths.'] },
        },
      ],
    },
    {
      id: 'functions', title: { en: 'Functions in motion', zh: '动起来的函数' },
      lessons: [
        {
          id: 'graph-transformations', title: 'Transforming graphs', summary: 'Slide, stretch and flip y = f(x) with sliders.', minutes: 12,
          entry: { id: 'graph-transformations', title: 'Transforming graphs', unit: 'Functions in motion', level: 'Grade 10-11', objectives: ['f(x) + k shifts the graph up by k.', 'f(x - h) shifts it right by h (not left).', 'a·f(x) stretches it vertically; negative a reflects it.'] },
        },
        {
          id: 'rates-of-change', title: 'Slopes and rates of change', summary: 'From the slope of a secant to the slope of a tangent.', minutes: 12,
          entry: { id: 'rates-of-change', title: 'Slopes and rates of change', unit: 'Functions in motion', level: 'Grade 11-12', objectives: ['Average rate of change is the slope of a secant line.', 'As the second point approaches the first, secant slopes approach the tangent slope.', 'The derivative of x^2 at x is 2x.'] },
        },
      ],
    },
    {
      id: 'platform', title: { en: 'Platform demos', zh: '平台演示' },
      lessons: [
        {
          id: textDemo.id, title: textDemo.title, lesson: textDemo, minutes: 10, level: { en: 'authors and reviewers', zh: '课程作者与审阅者' },
          summary: { en: 'Every kind of text page in one short lesson: reading, a derivation to reveal, a code walkthrough, a case with written answers.', zh: '一节短课里展示所有文字类页面：阅读、逐行推导、代码讲解，以及带简答题的案例。' },
        },
      ],
    },
  ],
};

const GEN = (id: string) => `mathnim.generated.${id}`;
export function cached_generation(id: string): GeneratedLesson | null {
  try {
    return JSON.parse(localStorage.getItem(GEN(id)) ?? 'null');
  } catch {
    return null;
  }
}
export function cache_generation(g: GeneratedLesson): void {
  localStorage.setItem(GEN(g.entry.id), JSON.stringify(g));
}
export function find_lesson(id: string): CourseLesson | undefined {
  return COURSE.units.flatMap((u) => u.lessons).find((l) => l.id === id);
}
/** The playable lesson for a course entry (authored, or generated and cached). */
export function playable(cl: CourseLesson): Lesson | null {
  if (cl.lesson) return cl.lesson;
  const g = cached_generation(cl.id);
  return g ? lesson_from_generated(g) : null;
}
export function all_skills(): Skill[] {
  const out: Skill[] = [];
  for (const u of COURSE.units) for (const l of u.lessons) {
    const skills = l.lesson?.skills ?? cached_generation(l.id)?.plan.skills;
    if (skills) out.push(...skills);
  }
  return out;
}
