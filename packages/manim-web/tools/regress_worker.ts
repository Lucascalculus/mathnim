// Worker for tools/regress.mjs: runs ONE example in a fresh isolate and
// compares its frames with real manim's golden frames (headless canvas).
import { parentPort, workerData } from 'node:worker_threads';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/_config';
import { ScenePlayer } from '../src/ext/player';
import { load_transpiled } from '../src/ext/py/index';
import { init_tex } from '../src/utils/tex/mathjax';
import { load_fonts } from '../src/ext/text/fonts';

const W = 480, H = 270;
const { ex, golden, goldenDir, outDir, saveImages } = workerData as {
  ex: { key: string; name: string; js: string | null; js_error?: string };
  golden: { status: string; frames?: number[]; total_frames?: number; error?: string } | undefined;
  goldenDir: string; outDir: string; saveImages: boolean;
};

function compare(a: Uint8ClampedArray, b: Uint8ClampedArray, diff?: Uint8ClampedArray) {
  let sum = 0, bad = 0;
  for (let i = 0; i < W * H; i++) {
    const k = 4 * i;
    const d = (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) / 3;
    sum += d;
    if (d > 40) bad++;
    if (diff) {
      const v = Math.min(255, d * 3);
      diff[k] = v;
      diff[k + 1] = v * 0.4;
      diff[k + 2] = 0;
      diff[k + 3] = 255;
    }
  }
  return { mean: sum / (W * H), bad: (100 * bad) / (W * H) };
}

async function run() {
  const base = { key: ex.key, name: ex.name };
  if (!golden || golden.status !== 'ok') return { ...base, status: 'skip', error: `no golden (${golden?.error ?? 'missing'})` };
  if (!ex.js) return { ...base, status: 'fail', error: `transpile: ${ex.js_error}` };
  config.pixel_width = W;
  config.pixel_height = H;
  config.frame_rate = 10;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  let player: ScenePlayer;
  try {
    await init_tex(); // module-level code may create TeX before ScenePlayer.load
    await load_fonts({ system_fonts: true }); // the fonts Pango used for the goldens
    const mod = load_transpiled(ex.js);
    const Cls = mod[ex.name];
    if (!Cls) throw new Error(`class ${ex.name} not found`);
    player = new ScenePlayer(new Cls(), canvas as any, { audio: false });
    await player.load();
  } catch (e: any) {
    return { ...base, status: 'fail', error: `run: ${e?.message ?? e}`.slice(0, 400), stack: String(e?.stack ?? '').split('\n').slice(0, 6).join('\n') };
  }
  let worst = { mean: -1, bad: 0, label: '' };
  let worstPair: [Uint8ClampedArray, Uint8ClampedArray] | null = null;
  const labels = [...(golden.frames ?? []).map((f) => ['f' + f, f] as const), ['last', -1] as const];
  for (const [label, f] of labels) {
    const file = path.join(goldenDir, ex.key, `${label}.png`);
    if (!fs.existsSync(file)) continue;
    const img = await loadImage(file);
    const rc = createCanvas(W, H);
    const rg = rc.getContext('2d');
    rg.drawImage(img, 0, 0);
    const ref = rg.getImageData(0, 0, W, H).data;
    try {
      if (f < 0) player.show_end();
      else {
        player.compute_frame(f);
        player.draw();
      }
    } catch (e: any) {
      return { ...base, status: 'fail', error: `frame ${label}: ${e?.message ?? e}`.slice(0, 400), stack: String(e?.stack ?? '').split('\n').slice(0, 6).join('\n') };
    }
    const ours = ctx.getImageData(0, 0, W, H).data;
    const c = compare(ours, ref);
    if (c.mean > worst.mean) {
      worst = { ...c, label };
      worstPair = [ref.slice(), ours.slice()];
    }
  }
  let status = worst.mean < 1.5 && worst.bad < 0.5 ? 'pass' : worst.mean < 6 && worst.bad < 4 ? 'warn' : 'fail';
  if (status === 'pass' && golden.total_frames !== player.total_frames) status = 'warn';
  if (saveImages && worstPair && status !== 'pass') {
    fs.mkdirSync(outDir, { recursive: true });
    const d = new Uint8ClampedArray(W * H * 4);
    compare(worstPair[1], worstPair[0], d);
    const strip = createCanvas(W * 3, H);
    const sg = strip.getContext('2d');
    [worstPair[0], worstPair[1], d].forEach((px, i) => {
      const id = sg.createImageData(W, H);
      id.data.set(px);
      sg.putImageData(id, i * W, 0);
    });
    fs.writeFileSync(path.join(outDir, `${ex.key}.png`), strip.toBuffer('image/png'));
  }
  return { ...base, status, mean: +worst.mean.toFixed(2), bad: +worst.bad.toFixed(2), worst_frame: worst.label, frames: golden.total_frames, our_frames: player.total_frames };
}

run().then((r) => parentPort!.postMessage(r), (e) => parentPort!.postMessage({ key: ex.key, name: ex.name, status: 'fail', error: `harness: ${e?.message ?? e}` }));
