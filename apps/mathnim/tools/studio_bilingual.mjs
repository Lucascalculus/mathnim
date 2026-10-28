// Make a demo course bilingual: each lesson exported by tools/studio_export.mjs (in the course's
// language) is merged with its translation (<lesson-id>.en.json, the same JSON with the words in
// English) into Mathnim's { en, zh } strings, so the site's language switch switches the lesson.
// The course entry in public/demo/courses.json is merged with course.en.json the same way.
// Ids, TeX, code and numbers are taken from the original; a lesson without a translation is left as it is.
// Usage: node tools/studio_bilingual.mjs <course-id> <folder with the .en.json files>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [id, from] = process.argv.slice(2);
if (!id || !from) {
  console.error('usage: node tools/studio_bilingual.mjs <course-id> <translations folder>');
  process.exit(2);
}
const here = path.dirname(new URL(import.meta.url).pathname);
const demo = path.join(here, '..', 'public', 'demo');
// fields that are not words for the learner
const KEEP = new Set(['id', 'kind', 'type', 'purpose', 'skill', 'misconception', 'tex', 'code', 'lang', 'mode', 'theme', 'key', 'url', 'src', 'next', 'reveal', 'on_correct', 'on_wrong']);
const is_l10n = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every((k) => k === 'en' || k === 'zh');
let mismatches = 0;

/** zh: the original (or an earlier merge, whose zh is taken), en: the translation, same shape. */
function merge(zh, en, key) {
  if (is_l10n(zh)) zh = zh.zh;
  if (typeof zh === 'string') {
    if (KEEP.has(key) || typeof en !== 'string' || en === zh || !en.trim()) return zh;
    return { en, zh };
  }
  if (Array.isArray(zh)) {
    if (!Array.isArray(en) || en.length !== zh.length) {
      mismatches++;
      return zh;
    }
    return zh.map((x, i) => merge(x, en[i], key));
  }
  if (zh && typeof zh === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(zh)) out[k] = merge(v, en && typeof en === 'object' ? en[k] : undefined, k);
    return out;
  }
  return zh;
}

const list_file = path.join(demo, 'courses.json');
const list = JSON.parse(readFileSync(list_file, 'utf8'));
const entry = list.find((c) => c.id === id);
if (!entry) throw new Error(`no course ${id} in public/demo/courses.json`);
let done = 0;
for (const l of entry.lessons) {
  const t = path.join(from, `${l.id}.en.json`);
  if (!existsSync(t)) continue;
  const file = path.join(demo, id, `${l.id}.json`);
  const before = mismatches;
  writeFileSync(file, JSON.stringify(merge(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(readFileSync(t, 'utf8')))));
  if (mismatches > before) console.warn(`${l.id}: ${mismatches - before} lists differ in length from the original (kept in the original language there)`);
  l.meta.langs = ['en', 'zh'];
  done++;
}
const ct = path.join(from, 'course.en.json');
if (existsSync(ct)) {
  const merged = merge(entry, JSON.parse(readFileSync(ct, 'utf8')));
  // the lessons' languages were set above
  merged.lessons.forEach((l, i) => (l.meta.langs = entry.lessons[i].meta.langs));
  list[list.indexOf(entry)] = merged;
}
writeFileSync(list_file, JSON.stringify(list, null, 1) + '\n');
console.log(`${id}: ${done} of ${entry.lessons.length} lessons bilingual${existsSync(ct) ? ', course entry too' : ''}`);
