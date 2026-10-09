// Frame comparison of one example against real manim's golden frames.
import { config } from '../src/_config';
import { ScenePlayer } from '../src/ext/player';
import { load_transpiled } from '../src/ext/py/index';

export type Example = { key: string; name: string; code: string; js: string | null; js_error?: string; options: Record<string, unknown> };
export type Golden = Record<string, { status: string; frames?: number[]; total_frames?: number; error?: string }>;
export type Result = { key?: string; name: string; status: string; mean?: number; bad?: number; worst_frame?: string; frames?: number; our_frames?: number; error?: string };

export const W = 480, H = 270;

async function loadImage(src: string): Promise<ImageData | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, W, H);
}
function compare(a: ImageData, b: ImageData, diff?: ImageData): { mean: number; bad: number } {
  let sum = 0, bad = 0;
  const n = W * H;
  for (let i = 0; i < n; i++) {
    const k = 4 * i;
    const d = (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2])) / 3;
    sum += d;
    if (d > 40) bad++;
    if (diff) {
      const v = Math.min(255, d * 3);
      diff.data[k] = v;
      diff.data[k + 1] = v * 0.4;
      diff.data[k + 2] = 0;
      diff.data[k + 3] = 255;
    }
  }
  return { mean: sum / n, bad: (100 * bad) / n };
}
const toCanvas = (img: ImageData) => {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
};

export async function runExample(ex: Example | undefined, golden: Golden[string] | undefined, canvas: HTMLCanvasElement): Promise<{ r: Result; show?: HTMLElement[] }> {
  if (!ex) return { r: { name: '?', status: 'fail', error: 'unknown example' } };
  if (!golden || golden.status !== 'ok') return { r: { name: ex.name, status: 'skip', error: `no golden (${golden?.error ?? 'missing'})` } };
  if (!ex.js) return { r: { name: ex.name, status: 'fail', error: `transpile: ${ex.js_error}` } };
  canvas.width = W;
  canvas.height = H;
  config.pixel_width = W;
  config.pixel_height = H;
  config.frame_rate = 10;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let player: ScenePlayer;
  try {
    const mod = load_transpiled(ex.js);
    const Cls = mod[ex.name];
    if (!Cls) throw new Error(`class ${ex.name} not found`);
    player = new ScenePlayer(new Cls(), canvas, { audio: false });
    await player.load();
  } catch (e: any) {
    return { r: { name: ex.name, status: 'fail', error: `run: ${e?.message ?? e}`.slice(0, 300) } };
  }
  let worst = { mean: -1, bad: 0, label: '' };
  let worstImgs: [ImageData, ImageData] | null = null;
  const frames = (golden.frames ?? []).map((f) => ['f' + f, f] as const);
  for (const [label, f] of [...frames, ['last', -1] as const]) {
    const ref = await loadImage(`/golden/${ex.key}/${label}.png`);
    if (!ref) continue;
    try {
      if (f < 0) player.show_end();
      else {
        player.compute_frame(f);
        player.draw();
      }
    } catch (e: any) {
      return { r: { name: ex.name, status: 'fail', error: `frame ${label}: ${e?.message ?? e}`.slice(0, 300) } };
    }
    const ours = ctx.getImageData(0, 0, W, H);
    const c = compare(ours, ref);
    if (c.mean > worst.mean) {
      worst = { ...c, label };
      worstImgs = [ref, ours];
    }
  }
  const status = worst.mean < 1.5 && worst.bad < 0.5 ? 'pass' : worst.mean < 6 && worst.bad < 4 ? 'warn' : 'fail';
  const r: Result = { key: ex.key, name: ex.name, status, mean: +worst.mean.toFixed(2), bad: +worst.bad.toFixed(2), worst_frame: worst.label, frames: golden.total_frames, our_frames: player.total_frames };
  if (r.frames !== r.our_frames && status === 'pass') r.status = 'warn';
  let show: HTMLElement[] | undefined;
  if (worstImgs) {
    const d = new ImageData(W, H);
    compare(worstImgs[1], worstImgs[0], d);
    show = [toCanvas(worstImgs[0]), toCanvas(worstImgs[1]), toCanvas(d)];
  }
  return { r, show };
}

