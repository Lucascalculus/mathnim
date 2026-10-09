// Render key frames of every lesson scene to PNG (for design review).
//   node tools/snapshots.mjs <lessonId> <outDir>
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { ScenePlayer } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { all_lessons } from '../src/course';
import { apply_theme } from '../src/lessons/best-angle/theme';

await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });
const [id, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const lesson = all_lessons().find((l) => l.id === id)!.lesson!;
const ctx = { vars: { d: 12, a: 4, b: 9 }, rng: () => 0.5 };
for (const s of lesson.steps) {
  const spec = (s as any).scene;
  if (!spec) continue;
  const scene = /^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec(ctx);
  const canvas = createCanvas(1280, 720);
  const player = new ScenePlayer(scene, canvas as any, { audio: false });
  apply_theme(player);
  await player.load();
  const shots: [string, () => void][] = [['end', () => player.show_end()]];
  if (player.total_frames > 30) shots.unshift(['mid', () => { player.compute_frame(Math.floor(player.total_frames * 0.45)); player.draw(); }]);
  for (const [name, f] of shots) {
    f();
    fs.writeFileSync(path.join(out, `${s.id}-${name}.png`), canvas.toBuffer('image/png'));
  }
  console.log(`${s.id}: ${player.duration.toFixed(1)} s`);
}
