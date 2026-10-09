// Pre-render the home page's lesson thumbnails (the final frame of each
// lesson's thumbnail scene) to public/thumbs/<lesson>.<lang>.webp, so the home
// page shows images instead of running every lesson's first scene in the
// browser. Lessons without a scene keep their drawn text thumbnail.
//   npm run thumbs -w mathnim
import { createCanvas } from '@napi-rs/canvas';
import { init_tex } from 'manim-web';
import { ScenePlayer } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { set_ft_lang } from '@mathnim/visuals/ft/f/kit';
import { LANGS, lesson_langs, type Lang } from '@mathnim/core';
import fs from 'node:fs';
import path from 'node:path';
import { with_cjk } from '../../../packages/visuals/tools/cjk_font';
import { all_lessons, load_all_lessons } from '../src/course';

// the fine-tuning lessons are loaded on demand in the app; the tools check them all
await load_all_lessons();
import { apply_theme } from '../src/lessons/best-angle/theme';

await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });
await init_tex();
const out = path.join(process.env.MATHNIM_PUBLIC!, 'thumbs');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);

let n = 0;
for (const cl of all_lessons()) {
  const lesson = cl.lesson;
  if (!lesson || (only.length && !only.includes(cl.id))) continue;
  const step: any = (cl.thumb && lesson.steps.find((s: any) => s.id === cl.thumb && s.scene)) || lesson.steps.find((s: any) => s.scene);
  if (!step) continue;
  const langs: Lang[] = lesson_langs(lesson).length > 1 ? [...LANGS] : ['en'];
  for (const lang of langs) {
    const t0 = Date.now();
    await with_cjk(async () => {
      set_ft_lang(lang);
      const spec = step.scene;
      const scene = /^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec({ vars: {}, rng: () => 0.5, lang });
      const canvas = createCanvas(640, 360);
      const player = new ScenePlayer(scene, canvas as any, { audio: false });
      apply_theme(player);
      await player.load();
      player.show_end();
      fs.writeFileSync(path.join(out, `${cl.id}.${lang}.webp`), await canvas.encode('webp', 82));
    });
    n++;
    console.log(`${cl.id}.${lang}.webp  ${Date.now() - t0} ms`);
  }
}
console.log(`${n} thumbnails in ${out}`);
