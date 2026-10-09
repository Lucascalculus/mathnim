// Collect every narration line of the course (authored lessons + recorded
// generated lesson, including the triggered lines of worlds) with its audio
// key, for tools/gen_narration.py. Bilingual lines give one item per
// language: the key is computed from the text itself, so each language has
// its own recording, and `lang` picks the voice. `spoken` is what the voice
// reads (core's to_spoken: TeX and symbols as words, in that language).
import { INSCRIBED_PLAN } from '@mathnim/ai';
import { is_bilingual, lesson_strings, narration_key, spoken_lang, to_spoken, type Lang } from '@mathnim/core';
import { COURSE } from '../src/course';

const items = new Map<string, { key: string; text: string; lang: Lang; spoken: string }>();
const add = (text: string, lang: Lang = spoken_lang(text)) => {
  if (!text.trim()) return;
  const key = narration_key(text);
  if (!items.has(key)) items.set(key, { key, text, lang, spoken: to_spoken(text, lang) });
};
for (const l of COURSE.units.flatMap((u) => u.lessons)) {
  if (!l.lesson) continue;
  // step narration and the triggered lines of worlds (enter, idle, events, findings, goal)
  for (const x of lesson_strings(l.lesson)) {
    if (x.role !== 'narration' && x.role !== 'line') continue;
    if (is_bilingual(x.value)) {
      add(x.value.en, 'en');
      add(x.value.zh, 'zh');
    } else add(x.value);
  }
}
for (const s of INSCRIBED_PLAN.steps) if (s.kind === 'scene' && s.narration) add(s.narration);
console.log(JSON.stringify([...items.values()], null, 1));
