// What the course pages show (docs/SITE-STRUCTURE.md, "Decisions after phase 1"):
// no hidden units, no AI-generated syllabus entries, unit titles without the
// course's name, and every lab suggested after a lesson of its course.
import { describe, expect, it } from 'vitest';
import { COURSES, FT_COURSE, MATH_COURSE, lesson_code, unit_title, visible_lessons, visible_units } from '../src/course';

describe('course pages', () => {
  it('leave out hidden units and syllabus entries', () => {
    for (const c of COURSES) {
      for (const u of visible_units(c)) {
        expect(u.hidden).toBeFalsy();
        expect(u.lessons.length).toBeGreaterThan(0);
        for (const l of u.lessons) expect(!!(l.lesson || l.load)).toBe(true);
      }
    }
    expect(visible_units(MATH_COURSE).map((u) => u.id)).not.toContain('platform');
    expect(visible_lessons(MATH_COURSE).some((l) => l.entry && !l.lesson)).toBe(false);
  });
  it('drop the course name from unit titles', () => {
    const a = FT_COURSE.units.find((u) => u.id === 'ft-a')!;
    expect(unit_title(FT_COURSE, a, 'zh')).toBe('A · 地图与 RAG');
    expect(unit_title(FT_COURSE, a, 'en')).toBe('A · The map and RAG');
    const f0 = FT_COURSE.units.find((u) => u.id === 'ft-f0')!;
    expect(unit_title(FT_COURSE, f0, 'zh')).toBe('中场选择练习');
    const b = FT_COURSE.units.find((u) => u.id === 'ft-b')!;
    expect(unit_title(FT_COURSE, b, 'zh')).toBe('B · 模仿：监督微调（SFT）');
  });
  it('name fine-tuning lessons by their code', () => {
    expect(lesson_code('ft-c2-lora')).toBe('C2');
    expect(lesson_code('ft-a2b')).toBe('A2b');
    expect(lesson_code('ft-d2a')).toBe('D2a');
    expect(lesson_code('pizza')).toBe('');
  });
  it('suggest every lab after a lesson shown on the course page', () => {
    const ids = visible_lessons(FT_COURSE).map((l) => l.id);
    expect(FT_COURSE.labs?.length).toBeGreaterThan(0);
    for (const lab of FT_COURSE.labs!) expect(ids).toContain(lab.after);
  });
  it('give every prerequisite link a URL in both languages', () => {
    for (const c of COURSES) {
      for (const k of c.prerequisites?.links ?? []) {
        for (const lang of ['en', 'zh'] as const) expect(typeof k.url === 'string' ? k.url : k.url[lang]).toMatch(/^https:\/\//);
      }
    }
  });
});
