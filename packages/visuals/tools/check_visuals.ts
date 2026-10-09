// Visual checker: for every registered visual and every example (the defaults
// included), in both themes: check the parameters, build the scene, lint the
// whole timeline, exercise explore() (drag every handle to the extremes and
// lint again), check that the declared ids exist, and render a contact sheet.
//
//   node tools/check_visuals.mjs [--only a,b] [--theme light|dark] [--out dir] [--full] [--quiet]
//
// Chinese labels (examples with lang: 'zh') are drawn with a local Chinese font:
// $MATHNIM_CJK_FONT, else the app's public/fonts Noto Sans SC, else macOS's Arial
// Unicode (see cjk_font.ts); the line printed at the first zh example says which.
//
// Exit code 1 when anything has a lint error, crashes, has invalid example
// parameters or misses a declared id.
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DragHandle } from 'manim-web/ext/interact';
import { lint_frame, lint_timeline, type LintIssue } from 'manim-web/ext/lint';
import { ScenePlayer, preload } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { apply_palette, check_params, list_visuals, palette, set_theme, type ThemeName, type Visual } from '../src';
// the fine-tuning visuals (src/ft/<part>/index.ts) register themselves; the launcher collects the parts that exist
import 'mathnim:ft-visuals';
import { with_cjk } from './cjk_font';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const only = opt('only')?.split(',').map((s) => s.trim());
const themes: ThemeName[] = opt('theme') ? [opt('theme') as ThemeName] : ['light', 'dark'];
const out = path.resolve(opt('out') ?? path.join(os.tmpdir(), 'mathnim-visuals-check'));
const full = argv.includes('--full');
const quiet = argv.includes('--quiet');
fs.mkdirSync(out, { recursive: true });

// the bundle cannot locate the font files relative to itself; point at the source folder
await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });
await preload({ tex: true });

const W = 640, H = 360, COLS = 3, HEAD = 34, GAP = 10;
const FRACTIONS = [0.15, 0.35, 0.55, 0.8];

interface Row { what: string; errors: string[]; warnings: string[]; seconds?: number; build_s?: number; live_ms?: number }
const rows: Row[] = [];

const fmt_issue = (i: LintIssue) => `${i.rule}${i.time !== undefined ? ` @${i.time.toFixed(1)}s` : ''}: ${i.message}`;

function names_in(scene: any): Set<string> {
  const s = new Set<string>();
  const walk = (m: any) => {
    if (!m) return;
    if (m.name) s.add(m.name);
    for (const k of m.submobjects ?? []) walk(k);
  };
  for (const m of [...scene.mobjects, ...(scene.foreground_mobjects ?? []), ...(scene.tracked ?? [])]) walk(m);
  return s;
}

/** A stand-in for Interaction: collects handles without a DOM. */
function fake_ui(player: ScenePlayer) {
  const handles: DragHandle[] = [];
  return {
    player, handles, on_change: () => {},
    add_handle(spec: any) {
      const h = new DragHandle(spec);
      handles.push(h);
      return h;
    },
    remove_handle(h: DragHandle) {
      handles.splice(handles.indexOf(h), 1);
    },
    on_click() {},
    hit_test() {
      return [];
    },
  };
}

function step(scene: any, n = 3) {
  for (let i = 0; i < n; i++) {
    scene.update_mobjects(1 / 60);
    scene.update_self?.(1 / 60);
  }
}

async function check_one(v: Visual<any>, ex: Record<string, unknown>, ei: number, theme: ThemeName): Promise<{ row: Row; frames: [string, Canvas][] }> {
  const what = `${v.name}#${ei} ${theme}`;
  const row: Row = { what, errors: [], warnings: [] };
  const frames: [string, Canvas][] = [];
  set_theme(theme);
  const pc = check_params(v, ex);
  if (!pc.ok) row.errors.push(...pc.errors.map((e) => `params: ${e}`));
  if (pc.notes.length) row.warnings.push(...pc.notes.map((n) => `params: ${n}`));
  try {
    const canvas = createCanvas(W, H);
    const scene = v.scene(pc.params);
    const player = new ScenePlayer(scene, canvas as any, { audio: false });
    apply_palette(player);
    const t0 = performance.now();
    await player.load();
    row.build_s = (performance.now() - t0) / 1000;
    row.seconds = player.duration;
    if (player.duration < 8 || player.duration > 30) row.warnings.push(`duration ${player.duration.toFixed(1)} s is outside 8-30 s`);
    const bg = palette().bg;
    for (const i of lint_timeline(player, { background: bg })) (i.severity === 'error' ? row.errors : row.warnings).push(fmt_issue(i));
    // frames along the timeline
    const shot = (label: string) => {
      const c = createCanvas(W, H);
      const ctx = c.getContext('2d');
      ctx.drawImage(canvas as any, 0, 0);
      frames.push([label, c]);
    };
    for (const f of FRACTIONS) {
      player.compute_frame(Math.floor(player.total_frames * f));
      player.draw();
      shot(`${(player.time).toFixed(1)} s`);
    }
    player.show_end();
    shot('end');
    // ids
    const have = names_in(scene);
    // explore: attach handles, drag each to the extremes, lint every state
    if (v.explore) {
      const ui = fake_ui(player);
      v.explore(scene, ui as any, pc.params);
      step(scene);
      const seen = new Set<string>();
      const push = (is: LintIssue[], where: string) => {
        for (const i of is) {
          const key = i.rule + i.message;
          if (seen.has(key)) continue;
          seen.add(key);
          (i.severity === 'error' ? row.errors : row.warnings).push(`explore (${where}) ${i.rule}: ${i.message}`);
        }
      };
      push(lint_frame(scene, { background: bg }), 'start');
      for (const [k, h] of ui.handles.entries()) {
        const p0 = h.position();
        for (const q of [[-20, -20], [20, 20], [20, -20], [-20, 20], [0.3, 0.2], [p0[0] - 1.1, p0[1] + 0.7]]) {
          h.move_to([q[0], q[1], 0]);
          step(scene);
          const bad = h.position().some((x) => !Number.isFinite(x));
          if (bad) row.errors.push(`explore: handle ${h.spec.label ?? k} has a non-finite position after a drag to (${q})`);
          push(lint_frame(scene, { background: bg }), `${h.spec.label ?? `handle ${k}`} at (${q})`);
        }
        h.move_to(p0);
        step(scene);
      }
      // a representative explored state: every handle nudged a little
      for (const h of ui.handles) {
        const p = h.position();
        h.move_to([p[0] + 0.45, p[1] + 0.3, 0]);
      }
      step(scene);
      push(lint_frame(scene, { background: bg }), 'nudged');
      for (const n of names_in(scene)) have.add(n);
      // cost of one live frame (updaters + drawing), as while the student drags
      const t1 = performance.now();
      for (let k = 0; k < 20; k++) {
        const h = ui.handles[k % Math.max(1, ui.handles.length)];
        if (h) {
          const q = h.position();
          h.move_to([q[0] + (k % 2 ? 0.05 : -0.05), q[1], 0]);
        }
        scene.update_mobjects(1 / 60);
        player.draw();
      }
      row.live_ms = (performance.now() - t1) / 20;
      if (row.live_ms > 30) row.warnings.push(`a live frame takes ${row.live_ms.toFixed(1)} ms (slow for dragging)`);
      player.draw();
      shot(`explore (${ui.handles.length} handles)`);
    }
    if (argv.includes('--names')) console.log(v.name, [...have].join(' '));
    // every declared id must exist with the default parameters; other examples may switch parts off
    for (const id of v.ids ?? []) if (!have.has(id)) (Object.keys(ex).length ? row.warnings : row.errors).push(`id '${id}' is declared but no mobject has that name`);
  } catch (e: any) {
    row.errors.push(`crash: ${e?.stack?.split('\n').slice(0, 4).join(' | ') ?? e}`);
  }
  return { row, frames };
}

function sheet(title: string, parts: { theme: ThemeName; frames: [string, Canvas][]; row: Row }[]): Canvas {
  const rows_per_theme = Math.ceil(Math.max(1, ...parts.map((p) => p.frames.length)) / COLS);
  const block = HEAD + rows_per_theme * (H + 22);
  const c = createCanvas(COLS * W + (COLS - 1) * GAP, HEAD + parts.length * block);
  const g = c.getContext('2d');
  g.fillStyle = '#202225';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#FFFFFF';
  g.font = 'bold 22px sans-serif';
  g.fillText(title, 10, 24);
  parts.forEach((p, k) => {
    const y0 = HEAD + k * block;
    g.font = '18px sans-serif';
    g.fillStyle = p.row.errors.length ? '#FF6B6B' : p.row.warnings.length ? '#FFD166' : '#8BE28B';
    g.fillText(`${p.theme}: ${p.row.errors.length} errors, ${p.row.warnings.length} warnings${p.row.seconds ? `, ${p.row.seconds.toFixed(1)} s` : ''}`, 10, y0 + 24);
    p.frames.forEach(([label, f], i) => {
      const x = (i % COLS) * (W + GAP), y = y0 + HEAD + Math.floor(i / COLS) * (H + 22);
      g.drawImage(f as any, x, y);
      g.fillStyle = '#CCCCCC';
      g.font = '15px sans-serif';
      g.fillText(label, x + 8, y + H + 16);
    });
  });
  return c;
}

const visuals = list_visuals().filter((v) => !only || only.includes(v.name));
if (!visuals.length) {
  console.error(`no visuals match ${only?.join(', ')}`);
  process.exit(1);
}
const sheets: string[] = [];
for (const v of visuals) {
  const examples: Record<string, unknown>[] = [...(v.examples ?? [])] as any;
  if (!examples.some((e) => Object.keys(e).length === 0)) examples.unshift({});
  for (const [ei, ex] of examples.entries()) {
    const parts: { theme: ThemeName; frames: [string, Canvas][]; row: Row }[] = [];
    for (const theme of themes) {
      // zh labels: a local Chinese font is loaded the first time one is drawn (cjk_font.ts)
      const r = await with_cjk(() => check_one(v, ex, ei, theme));
      rows.push(r.row);
      parts.push({ theme, frames: r.frames, row: r.row });
      if (full) r.frames.forEach(([label, f], i) => fs.writeFileSync(path.join(out, `${v.name}-${ei}-${theme}-${i}.png`), f.toBuffer('image/png')));
    }
    const file = path.join(out, `${v.name}-${ei}.png`);
    fs.writeFileSync(file, sheet(`${v.name} #${ei}  ${JSON.stringify(ex)}`, parts).toBuffer('image/png'));
    sheets.push(file);
  }
}
set_theme('light');

let bad = 0;
for (const r of rows) {
  if (r.errors.length) bad++;
  const info = r.seconds !== undefined ? ` (${r.seconds.toFixed(1)} s long, built in ${r.build_s!.toFixed(1)} s${r.live_ms !== undefined ? `, live frame ${r.live_ms.toFixed(1)} ms` : ''})` : '';
  console.log(`${r.errors.length ? 'FAIL' : r.warnings.length ? 'warn' : 'ok  '} ${r.what}${info}${r.warnings.length ? ` - ${r.warnings.length} warnings` : ''}`);
  for (const e of r.errors) console.log(`       error: ${e}`);
  if (!quiet) for (const w of r.warnings) console.log(`       warning: ${w}`);
}
console.log(`\n${rows.length - bad}/${rows.length} checks pass; contact sheets in ${out}`);
process.exitCode = bad ? 1 : 0;
