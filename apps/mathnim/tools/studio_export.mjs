// Publish a course made from uploads as a demo every visitor can take, signed in or not:
// its catalog entry and the latest version of each lesson become static files under
// public/demo/ (served with the site, no account or model needed), and public/demo/courses.json
// lists them (src/studio_courses.ts reads it).
// Usage, with the dev server running and signed in as the course's owner (cookie from the browser):
//   node tools/studio_export.mjs <course-id> [--cookie "mn_sid=..."] [--base http://localhost:5176]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const id = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const base = opt('--base', 'http://localhost:5176');
const cookie = opt('--cookie', process.env.MN_COOKIE ?? '');
if (!id) {
  console.error('usage: node tools/studio_export.mjs <course-id> [--cookie "mn_sid=..."] [--base URL]');
  process.exit(2);
}
const r = await fetch(`${base}/api/studio/courses/${id}/export`, { headers: { cookie } });
if (!r.ok) {
  console.error(`export failed: HTTP ${r.status} ${await r.text()}`);
  process.exit(1);
}
const { entry, lessons } = await r.json();
const here = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(here, '..', 'public', 'demo');
mkdirSync(path.join(dir, id), { recursive: true });
for (const [lid, lesson] of Object.entries(lessons)) writeFileSync(path.join(dir, id, `${lid}.json`), JSON.stringify(lesson));
const list_file = path.join(dir, 'courses.json');
const list = existsSync(list_file) ? JSON.parse(readFileSync(list_file, 'utf8')).filter((c) => c.id !== id) : [];
list.push(entry);
writeFileSync(list_file, JSON.stringify(list, null, 1) + '\n');
console.log(`public/demo/${id}/: ${Object.keys(lessons).length} lessons; ${entry.lessons.length} listed in ${entry.units.length} units`);
