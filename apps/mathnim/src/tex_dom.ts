// TeX in the DOM (prompts, options, feedback) with the same MathJax fonts as the scenes.
// MathJax is large (about 0.5 MB compressed): the first page does not wait for it. It is loaded once
// the shell is up, or by the first page that needs it (lessons, review); formulas written meanwhile
// (course pages, the outline) are drawn when it arrives (present's set_tex_renderer).
import { set_tex_renderer } from '@mathnim/present';
import { init_tex } from 'manim-web';
import { tex_to_svg } from 'manim-web/utils/tex/mathjax';

let ready: Promise<void> | null = null;
export function enable_dom_tex(): Promise<void> {
  return (ready ??= init_tex().then(() =>
    set_tex_renderer((tex, display) => {
      const svg = tex_to_svg(tex, display ? 'displaymath' : 'math');
      // dvisvgm conventions: sizes in pt with 1em = 10pt -> scale to the surrounding text
      return svg
        .replace(/^<\?xml[^>]*>\s*/, '')
        .replace(/<!--[^>]*-->/, '')
        .replace(/width='([\d.]+)pt' height='([\d.]+)pt'/, (_m, w, h) => `width='${(+w / 10) * 1.12}em' height='${(+h / 10) * 1.12}em' fill='currentColor' style='vertical-align:-0.25em'`);
    }),
  ));
}
