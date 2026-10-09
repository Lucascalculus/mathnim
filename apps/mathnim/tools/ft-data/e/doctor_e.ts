// Part E lesson doctor: the regular lesson doctor (tools/lesson_doctor.ts),
// pointed at the part E unit until the main session registers it in
// course.ts. Regenerate after the doctor changes. Same checks: build and lint
// every scene, play every world headlessly (goals unreached at first, reached
// by solve()), lint the text pages and both languages, build the visuals
// embedded in text pages.
//   node apps/mathnim/tools/ft-data/e/doctor_e.mjs
import { createCanvas } from '@napi-rs/canvas';
import { lint_timeline } from 'manim-web/ext/lint';
import { ScenePlayer } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { apply_white } from '@mathnim/ai';
import { WorldSession, type Block, type ExploreStep, type Lesson } from '@mathnim/core';
import { check_params, get_visual } from '@mathnim/visuals';
import { init_tex } from 'manim-web';
import { tex_to_svg } from 'manim-web/utils/tex/mathjax';
import fs from 'node:fs';
import path from 'node:path';
import { lint_lesson_text } from '../../text_lint';
// zh labels: a local Chinese font is loaded the first time one is drawn (no download)
import { with_cjk } from '../../../../../packages/visuals/tools/cjk_font';
import { DragHandle } from 'manim-web/ext/interact';
import '../../../../../packages/visuals/src/ft/e';
import '../../../../../packages/visuals/src/ft/f';
import '../../../../../packages/visuals/src/ft/d';
import { unit } from '../../../src/lessons/ft/e/unit';
const all_lessons = () => unit.lessons;

// the bundle cannot locate the font files relative to itself; point at the source folder
await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });

type Row = { what: string; ok: boolean; errors: string[]; warnings: string[]; seconds?: number };
const rows: Row[] = [];

async function check(what: string, make: () => any) {
  rows.push(await with_cjk(() => check_row(what, make)));
}
async function check_row(what: string, make: () => any): Promise<Row> {
  try {
    const player = new ScenePlayer(make(), createCanvas(960, 540) as any, { audio: false });
    apply_white(player);
    await player.load();
    const issues = lint_timeline(player);
    return { what, ok: !issues.some((i) => i.severity === 'error'), errors: issues.filter((i) => i.severity === 'error').map((i) => i.message), warnings: issues.filter((i) => i.severity === 'warning').map((i) => i.message), seconds: player.duration };
  } catch (e: any) {
    return { what, ok: false, errors: [`crash: ${e?.message ?? e}`], warnings: [] };
  }
}

/**
 * A stand-in for Interaction (no DOM here): handles are real DragHandles so
 * their mappings run; anything else a setup calls is a harmless no-op.
 */
function stub_ui(): any {
  const handles: DragHandle[] = [];
  const base: any = {
    handles,
    on_change: () => {},
    add_handle: (spec: any) => {
      const h = new DragHandle(spec);
      handles.push(h);
      return h;
    },
  };
  const noop: any = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop) });
}

/** Play a world headlessly: its goals must be unreached at first and reached by its scripted solution. */
async function check_world(what: string, step: ExploreStep, make: () => any) {
  rows.push(await with_cjk(() => world_row(what, step, make)));
}
async function world_row(what: string, step: ExploreStep, make: () => any): Promise<Row> {
  const errors: string[] = [];
  try {
    const player = new ScenePlayer(make(), createCanvas(960, 540) as any, { audio: false });
    apply_white(player);
    await player.load();
    player.show_end();
    const goals = [...(step.goal ? [{ id: 'goal', ...step.goal }] : []), ...(step.goals ?? [])];
    const reached: string[] = [];
    const world = new WorldSession({ goals, detectors: step.detectors, lines: step.lines, stars: step.stars }, player.scene, ctx, (o) => {
      if (o.type === 'goal') reached.push(o.goal.id);
    });
    step.setup?.(player.scene, stub_ui(), ctx, world.api);
    world.check_goals();
    if (reached.length) errors.push(`goal reached before any action: ${reached.join(', ')}`);
    if (!step.solve) errors.push('no solve() - the doctor cannot prove this world can be won');
    else {
      step.solve(player.scene, ctx, world.api);
      world.input();
      if (!world.done) errors.push(`solve() does not reach: ${goals.filter((g) => !reached.includes(g.id)).map((g) => g.id).join(', ')}`);
    }
  } catch (e: any) {
    errors.push(`crash: ${e?.message ?? e}`);
  }
  return { what: `${what} (world)`, ok: !errors.length, errors, warnings: [] };
}

const ctx = { vars: { a: 4, b: 9 }, rng: () => 0.5, lang: 'en' as const };
await init_tex();
const PUBLIC = process.env.MATHNIM_PUBLIC!;
/** Visual blocks of a page (also inside details). */
const visual_blocks = (bs: Block[]): Extract<Block, { type: 'visual' }>[] => bs.flatMap((b) => (b.type === 'visual' ? [b] : b.type === 'details' ? visual_blocks(b.blocks) : []));
for (const l of all_lessons()) {
  const lesson: Lesson | undefined = l.lesson;
  if (!lesson) continue;
  // text pages and both languages
  const issues = lint_lesson_text(lesson, {
    figure_exists: (src) => fs.existsSync(path.join(PUBLIC, src)),
    check_visual: (name, params) => {
      const v = get_visual(name);
      if (!v) return null;
      const c = check_params(v, params ?? {});
      return { errors: c.errors, notes: c.notes, explorable: !!v.explore };
    },
    tex_error: (tex, display) => {
      try {
        tex_to_svg(tex, display ? 'displaymath' : 'math');
        return null;
      } catch (e: any) {
        return String(e?.message ?? e).split('\n')[0];
      }
    },
  });
  const errors = issues.filter((i) => i.severity === 'error').map((i) => `${i.where}: ${i.message}`);
  rows.push({ what: `${lesson.id} (text & languages)`, ok: !errors.length, errors, warnings: issues.filter((i) => i.severity === 'warning').map((i) => `${i.where}: ${i.message}`) });
  // visuals embedded in text pages and case briefs are built and linted like scenes
  for (const s of lesson.steps) {
    const bs = s.kind === 'read' ? s.blocks : s.kind === 'checkpoint' ? s.group?.brief ?? [] : [];
    for (const b of visual_blocks(bs)) {
      const v = get_visual(b.name);
      if (v) await check(`${lesson.id}/${s.id}/visual:${b.name}`, () => v.scene(check_params(v, b.params ?? {}).params));
    }
  }
  for (const s of lesson.steps) {
    const spec = (s as any).scene;
    if (!spec) continue;
    const make = () => (/^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec(ctx));
    await check(`${lesson.id}/${s.id}`, make);
    if (s.kind === 'explore' && (s.goal || s.goals?.length)) await check_world(`${lesson.id}/${s.id}`, s, make);
  }
}
let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? (r.warnings.length ? 'warn' : 'ok  ') : 'FAIL'} ${r.what}${r.seconds !== undefined ? ` (${r.seconds.toFixed(1)} s)` : ''}`);
  for (const e of r.errors) console.log(`       error: ${e}`);
  for (const w of r.warnings) console.log(`       warning: ${w}`);
}
console.log(`\n${rows.length - bad}/${rows.length} checks pass`);
process.exitCode = bad ? 1 : 0;
