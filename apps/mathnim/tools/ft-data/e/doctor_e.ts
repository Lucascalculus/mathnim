// Part E lesson doctor (until the main session registers the unit in
// course.ts, the regular doctor does not see these lessons). Same checks as
// apps/mathnim/tools/lesson_doctor.ts: build and lint every scene; play every
// world headlessly - goals must be unreached at first and reached by solve().
import { createCanvas } from '@napi-rs/canvas';
import { lint_timeline } from 'manim-web/ext/lint';
import { ScenePlayer } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { WorldSession, type ExploreStep } from '@mathnim/core';
import { DragHandle } from 'manim-web/ext/interact';
import { apply_palette } from '@mathnim/visuals';
import '../../../../../packages/visuals/src/ft/e';
import '../../../../../packages/visuals/src/ft/f';
import '../../../../../packages/visuals/src/ft/d';
import { unit } from '../../../src/lessons/ft/e/unit';

await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS!, system_fonts: true });
type Row = { what: string; ok: boolean; errors: string[]; warnings: string[]; seconds?: number };
const rows: Row[] = [];
const ctx = { vars: {}, rng: () => 0.5 };

function stub_ui(): any {
  const handles: DragHandle[] = [];
  const base: any = { handles, on_change: () => {}, add_handle: (spec: any) => { const h = new DragHandle(spec); handles.push(h); return h; } };
  const noop: any = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop) });
}
async function check(what: string, make: () => any) {
  try {
    const player = new ScenePlayer(make(), createCanvas(960, 540) as any, { audio: false });
    apply_palette(player);
    await player.load();
    const issues = lint_timeline(player);
    rows.push({ what, ok: !issues.some((i) => i.severity === 'error'), errors: issues.filter((i) => i.severity === 'error').map((i) => i.message), warnings: issues.filter((i) => i.severity === 'warning').map((i) => i.message), seconds: player.duration });
  } catch (e: any) {
    rows.push({ what, ok: false, errors: [`crash: ${e?.stack?.split('\n').slice(0, 3).join(' | ') ?? e}`], warnings: [] });
  }
}
async function check_world(what: string, step: ExploreStep, make: () => any) {
  const errors: string[] = [];
  try {
    const player = new ScenePlayer(make(), createCanvas(960, 540) as any, { audio: false });
    apply_palette(player);
    await player.load();
    player.show_end();
    const goals = [...(step.goal ? [{ id: 'goal', ...step.goal }] : []), ...(step.goals ?? [])];
    const reached: string[] = [];
    const findings: string[] = [];
    const world = new WorldSession({ goals, detectors: step.detectors, lines: step.lines, stars: step.stars }, player.scene, ctx as any, (o) => {
      if (o.type === 'goal') reached.push(o.goal.id);
      if (o.type === 'finding') findings.push(`${o.finding.kind}:${o.finding.id}`);
    });
    step.setup?.(player.scene, stub_ui(), ctx as any, world.api);
    world.check_goals();
    if (reached.length) errors.push(`goal reached before any action: ${reached.join(', ')}`);
    if (!step.solve) errors.push('no solve()');
    else {
      step.solve(player.scene, ctx as any, world.api);
      world.input();
      if (!world.done) errors.push(`solve() does not reach: ${goals.filter((g) => !reached.includes(g.id)).map((g) => g.id).join(', ')}`);
    }
    rows.push({ what: `${what} (world)`, ok: !errors.length, errors, warnings: findings.length ? [`findings during solve: ${findings.join(', ')}`] : [] });
  } catch (e: any) {
    rows.push({ what: `${what} (world)`, ok: false, errors: [`crash: ${e?.stack?.split('\n').slice(0, 3).join(' | ') ?? e}`], warnings: [] });
  }
}
// checkpoint scenes and text-page visuals are built too
import { check_params, get_visual } from '@mathnim/visuals';
for (const l of unit.lessons) {
  const lesson = l.lesson!;
  for (const s of lesson.steps as any[]) {
    const spec = s.scene;
    if (spec) {
      const make = () => (/^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec(ctx));
      await check(`${lesson.id}/${s.id}`, make);
      if (s.kind === 'explore' && (s.goal || s.goals?.length)) await check_world(`${lesson.id}/${s.id}`, s, make);
    }
    for (const b of s.blocks ?? []) {
      if (b.type !== 'visual') continue;
      const v = get_visual(b.name);
      if (!v) { rows.push({ what: `${lesson.id}/${s.id} visual ${b.name}`, ok: false, errors: ['visual not registered'], warnings: [] }); continue; }
      const pc = check_params(v, b.params ?? {});
      if (!pc.ok) rows.push({ what: `${lesson.id}/${s.id} visual ${b.name}`, ok: false, errors: pc.errors, warnings: [] });
      else await check(`${lesson.id}/${s.id} visual ${b.name}${b.params?.which ? `:${b.params.which}` : ''}`, () => v.scene(pc.params));
    }
  }
}
let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? (r.warnings.length ? 'warn' : 'ok  ') : 'FAIL'} ${r.what}${r.seconds !== undefined ? ` (${r.seconds.toFixed(1)} s)` : ''}`);
  for (const e of r.errors) console.log(`       error: ${e}`);
  for (const w of r.warnings.slice(0, 4)) console.log(`       warning: ${w}`);
}
console.log(`\n${rows.length - bad}/${rows.length} pass`);
process.exitCode = bad ? 1 : 0;
