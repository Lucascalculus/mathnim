// The engine in node (the doctor, the visual checks, thumbnails, tests): canvases come from @napi-rs/canvas, fields
// draw on the CPU, and a figure is linted where a learner would see it: wide and on a phone, at the end of every
// section of its script.
import { createCanvas, Path2D, type Canvas } from '@napi-rs/canvas';
import type { Scene } from 'manim-web';
import { ScenePlayer } from 'manim-web/ext/player';
import { FigurePlayer, is_figure, set_canvas_factory, set_gpu_tier, set_measure_context, type Figure, type Issue } from './src/index';

let ready = false;
export function use_node_canvas(): void {
  if (ready) return;
  ready = true;
  set_canvas_factory((w, h) => createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))) as unknown as OffscreenCanvas);
  set_measure_context(createCanvas(8, 8).getContext('2d') as unknown as CanvasRenderingContext2D);
  (globalThis as { Path2D?: unknown }).Path2D ??= Path2D;
  set_gpu_tier('cpu');
}

/** The sizes a figure is checked at (CSS px): a desktop stage and a phone. */
export const SIZES = [
  { name: 'wide', w: 960, h: 540 },
  { name: 'phone', w: 360 },
] as const;

/** Draw a figure at w × h (h undefined: its own height) at script time t (default: the end). */
export function render_figure(fig: Figure, w: number, h?: number, t?: number, dpr = 1): Canvas {
  use_node_canvas();
  fig.build();
  const size = fig.layout_for(w, h);
  const c = createCanvas(Math.round(size.w * dpr), Math.round(size.h * dpr));
  fig.at(t ?? fig.duration);
  fig.draw(c.getContext('2d') as unknown as CanvasRenderingContext2D, dpr, { force: true });
  return c;
}

export interface FigureIssue extends Issue {
  size: string;
  time: number;
}
/** Lint a figure at every size, at the end of each section and at the end (duplicates folded). */
export function lint_figure(fig: Figure): FigureIssue[] {
  use_node_canvas();
  fig.build();
  const times = [...fig.section_starts().map((s) => Math.max(0, s - 0.02)), fig.duration];
  const out: FigureIssue[] = [];
  const seen = new Set<string>();
  for (const sz of SIZES) {
    const size = fig.layout_for(sz.w, 'h' in sz ? sz.h : undefined);
    const g = createCanvas(size.w, size.h).getContext('2d') as unknown as CanvasRenderingContext2D;
    for (const t of times) {
      fig.at(t);
      fig.draw(g, 1, { force: true });
      for (const i of fig.lint()) {
        const key = `${sz.name}|${i.rule}|${i.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...i, size: sz.name, time: t });
      }
    }
  }
  fig.at(fig.duration);
  return out;
}

/** The player for a step's picture in node: a manim scene's, or a figure's laid out at w × h (tools: snapshots, thumbnails). */
export function node_player(stage: unknown, canvas: Canvas, w: number, h: number): ScenePlayer | FigurePlayer {
  if (is_figure(stage)) {
    use_node_canvas();
    return new FigurePlayer(stage, canvas as unknown as OffscreenCanvas, { size: { w, h }, audio: false });
  }
  return new ScenePlayer(stage as Scene, canvas as unknown as OffscreenCanvas, { audio: false });
}
