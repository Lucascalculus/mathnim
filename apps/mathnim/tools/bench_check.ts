// How long checking one visual takes in node (build its picture and lint it), for the visuals given, in both
// languages: a manim scene is recorded (ScenePlayer.load) and its timeline linted (lint_timeline); an engine figure
// is built and linted wide and on a phone at the end of every section (lint_figure).
//   node tools/bench_check.mjs mpc_qp_plane,mpc_shift_tail,determinant_area,training_curves
import { createCanvas } from '@napi-rs/canvas';
import { lint_timeline } from 'manim-web/ext/lint';
import { ScenePlayer } from 'manim-web/ext/player';
import { load_fonts } from 'manim-web/ext/text/fonts';
import { init_tex } from 'manim-web';
import { check_params, get_visual } from '@mathnim/visuals';
import '@mathnim/visuals/mpc';
import '@mathnim/visuals/ft/b';
import { set_ft_lang } from '@mathnim/visuals/ft/f/kit';
import { with_cjk } from '../../../packages/visuals/tools/cjk_font';

await load_fonts({ font_dir: process.env.MANIM_WEB_FONTS! });
await init_tex();
const names = (process.argv[2] ?? '').split(',').filter(Boolean);
let engine: any = null;
try {
  engine = await import('../../../packages/engine/node');
} catch {
  /* the build before the engine */
}
for (const n of names) {
  const v = get_visual(n);
  if (!v) continue;
  for (const lang of ['en', 'zh'] as const) {
    set_ft_lang(lang);
    const ms = await with_cjk(async () => {
      const t0 = performance.now();
      const stage: any = v.scene(check_params(v, 'lang' in v.params ? { lang } : {}).params);
      let issues = 0;
      if (stage?.engine_figure) issues = engine.lint_figure(stage).length;
      else {
        const p = new ScenePlayer(stage, createCanvas(960, 540) as any, { audio: false });
        await p.load();
        issues = lint_timeline(p).length;
      }
      return [performance.now() - t0, issues];
    });
    console.log(JSON.stringify({ visual: n, lang, ms: Math.round(ms[0]), issues: ms[1] }));
  }
}
