// Beats: how a narrated scene's picture lines up with its voice, for placing and checking beats (§ in the narration,
// next_section() in the scene; docs/COURSE-PLAYBOOK.md, "Time each scene to its voice").
//   node tools/beats.mjs <lesson-id>[/<step-id>]     every narrated scene of a lesson, or one ("mpc-*": a course)
// Per scene: its sections on its own clock and what plays in each; then per language the narration's parts, when the
// voice reaches each, when its section will start once the player has added its waits (voice_waits, as it plays),
// and how the end lines up. Each scene ends PASS or FAIL; the exit code is 1 if any fails. It fails when the beats
// and sections differ in number, when a section starts more than 0.5 s after its words, when the picture runs on
// more than 3 s after the voice, or (a scene without beats) when the voice runs on more than 0.5 s past the picture.
import { createCanvas } from '@napi-rs/canvas';
import { ScenePlayer, voice_waits } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { BEAT, beat_times, lesson_langs, narration_key, tr, unbeat, type L10n, type Lesson, type Recording } from '@mathnim/core';
import fs from 'node:fs';
import path from 'node:path';
import { with_cjk } from '../../../packages/visuals/tools/cjk_font';
import { all_lessons, load_all_lessons } from '../src/course';

const LATE = 0.5, TAIL = 3;
const want = process.argv[2];
if (!want) {
  console.error('usage: node tools/beats.mjs <lesson-id>[/<step-id>]   (a lesson id may end with * for a whole course)');
  process.exit(2);
}
const [lid, sid] = want.split('/');
const lesson_matches = (id: string) => (lid.endsWith('*') ? id.startsWith(lid.slice(0, -1)) : id === lid);

await load_all_lessons();
await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });
const PUBLIC = process.env.MATHNIM_PUBLIC!;
const ctx = { vars: { a: 4, b: 9 }, rng: () => 0.5, lang: 'en' as const };

const s1 = (x: number) => x.toFixed(1);
const quote = (s: string, n = 46) => {
  const t = unbeat(s).trim();
  return `"${t.length > n ? `${t.slice(0, n - 1)}…` : t}"`;
};
const name_of = (m: any) => (m?.name && m.name !== m.constructor?.name ? m.name : m?.constructor?.name ?? '?');
/** What one segment does, in a few words: "play 1.6 s Create(plan0) FadeIn(b0)" or "wait 1.8 s". */
const what = (sg: any) =>
  sg.kind === 'wait' ? `wait ${s1(sg.run_time)} s` : `play ${s1(sg.run_time)} s ${(sg.animations ?? []).map((a: any) => `${a.constructor.name}(${name_of(a.mobject)})`).slice(0, 4).join(' ')}`;

let failed = 0, seen = 0;
for (const l of all_lessons()) {
  const lesson: Lesson | undefined = l.lesson;
  if (!lesson || !lesson_matches(lesson.id)) continue;
  for (const s of lesson.steps) {
    if (s.kind !== 'scene' || s.narration === undefined || (sid && s.id !== sid)) continue;
    seen++;
    const spec = (s as any).scene;
    const make = () => (/^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec(ctx));
    const player: ScenePlayer = await with_cjk(async () => {
      const p = new ScenePlayer(make(), createCanvas(320, 180) as any, { audio: false });
      await p.load();
      return p;
    });
    const ok = check(lesson, s.id, s.narration, player);
    if (!ok) failed++;
  }
}
if (!seen) {
  console.error(`no narrated scene matches ${want}`);
  process.exit(2);
}
console.log(`\n${seen - failed}/${seen} scenes pass`);
process.exitCode = failed ? 1 : 0;

function check(lesson: Lesson, step: string, narration: L10n, p: ScenePlayer): boolean {
  const starts = p.section_starts(), length = p.natural_duration;
  const segs = p.scene.segments;
  const bounds = [0, ...starts.map((t) => (t < 0 ? length : t)), length];
  console.log(`\n${lesson.id}/${step} · picture ${s1(length)} s · ${starts.length} section${starts.length === 1 ? '' : 's'} (next_section)`);
  // the sections, with what plays in each
  let f = 0;
  const seg_at = segs.map((sg) => ((f += sg.n_frames), (f - sg.n_frames) * p.dt));
  for (let k = 0; k + 1 < bounds.length; k++) {
    const inside = segs.filter((_, i) => seg_at[i] >= bounds[k] - 1e-6 && seg_at[i] < bounds[k + 1] - 1e-6);
    console.log(`  section ${k}  ${s1(bounds[k]).padStart(5)}–${s1(bounds[k + 1])} s  ${inside.map(what).join(' · ') || '(nothing plays)'}`);
  }
  let ok = true;
  for (const lang of lesson_langs(lesson)) {
    const text = tr(narration, lang);
    const parts = text.split(BEAT);
    const beats = parts.length - 1;
    const file = path.join(PUBLIC, 'narration', `${narration_key(text)}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  ${lang} · no recording yet (npm run narration) · ${beats} beat${beats === 1 ? '' : 's'}`);
      if (beats !== starts.length) {
        console.log(`    FAIL: ${beats} beats but ${starts.length} sections`);
        ok = false;
      }
      continue;
    }
    const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as Recording;
    console.log(`  ${lang} · voice ${s1(rec.duration)} s (${rec.voice ?? 'voice'}) · ${beats} beat${beats === 1 ? '' : 's'}`);
    if (!beats && !starts.length) {
      const over = rec.duration - length;
      console.log(`    no beats: the voice ${over > 0 ? `runs ${s1(over)} s past` : `ends ${s1(-over)} s before the end of`} the picture`);
      if (over > LATE) {
        console.log(`    FAIL: add beats (§) and sections (next_section) so the picture waits for the voice`);
        ok = false;
      }
      continue;
    }
    if (beats !== starts.length) {
      console.log(`    FAIL: ${beats} beats (§) in the narration but ${starts.length} sections (next_section) in the scene`);
      parts.forEach((x, k) => console.log(`    part ${k}  ${quote(x)}`));
      ok = false;
      continue;
    }
    const at = beat_times(text, rec);
    const plan = voice_waits(starts, length, at, rec.duration);
    let held = 0;
    parts.forEach((x, k) => {
      if (!k) return console.log(`    part 0   0.0 s  ${quote(x)}  section 0 starts with the voice`);
      const i = k - 1;
      held += plan.waits[i];
      const begins = starts[i] + held;
      const note = plan.late[i] > LATE ? `LATE ${s1(plan.late[i])} s: shorten section ${i}` : plan.waits[i] > 0 ? `waits ${s1(plan.waits[i])} s` : 'on time';
      if (plan.late[i] > LATE) ok = false;
      console.log(`    part ${k}  ${s1(at[i]).padStart(4)} s  ${quote(x)}  section ${k} starts ${s1(begins)} s (${note})`);
    });
    if (plan.tail > TAIL) ok = false;
    console.log(
      `    end: the voice stops at ${s1(rec.duration)} s; ${plan.tail > 0 ? `the picture runs ${s1(plan.tail)} s longer${plan.tail > TAIL ? ': shorten the last section' : ''}` : `the last frame holds ${s1(plan.end_wait)} s`}`,
    );
  }
  console.log(`  ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}
