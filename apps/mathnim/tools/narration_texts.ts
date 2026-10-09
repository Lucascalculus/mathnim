// Collect every narration line of the course (authored lessons + recorded
// generated lesson, including the triggered lines of worlds) with its audio
// key, for tools/gen_narration.py. Only "videos" are voiced: scene steps and
// worlds (core's spoken_strings); text pages and questions have no audio.
// Bilingual lines give one item per
// language: the key is computed from the text itself, so each language has
// its own recording, and `lang` picks the voice. `spoken` is what the voice
// reads (core's to_spoken: TeX and symbols as words, in that language).
import { INSCRIBED_PLAN } from '@mathnim/ai';
import { is_bilingual, narration_key, spoken_lang, spoken_strings, to_spoken, type Lang } from '@mathnim/core';
import { COURSE } from '../src/course';

const items = new Map<string, { key: string; text: string; lang: Lang; spoken: string }>();
const add = (text: string, lang: Lang = spoken_lang(text)) => {
  if (!text.trim()) return;
  const key = narration_key(text);
  if (!items.has(key)) items.set(key, { key, text, lang, spoken: to_spoken(text, lang) });
};
for (const l of COURSE.units.flatMap((u) => u.lessons)) {
  if (!l.lesson) continue;
  // the narration of scenes and worlds, and the triggered lines of worlds (enter, idle, events, findings, goal)
  for (const v of spoken_strings(l.lesson)) {
    if (is_bilingual(v)) {
      add(v.en, 'en');
      add(v.zh, 'zh');
    } else add(v);
  }
}
for (const s of INSCRIBED_PLAN.steps) if (s.kind === 'scene' && s.narration) add(s.narration);
console.log(JSON.stringify([...items.values()], null, 1));
