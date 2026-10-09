// Chinese glyphs for the labels drawn on the canvas (manim-web's Text draws
// glyph outlines from fonts it has loaded; it ships Latin, Greek and Cyrillic
// only). For a Chinese learner the app registers Noto Sans SC (OFL) before the
// visuals are drawn: from public/fonts/ when the file is there (to work
// offline), else from the jsDelivr CDN (about 1.6 MB, cached by the browser).
// Until it is loaded, or if it cannot be, visuals keep English labels rather
// than draw empty boxes.
import { register_font } from 'manim-web/ext/text/fonts';

const FILE = 'noto-sans-sc-chinese-simplified-400-normal.woff';
const SOURCES = [`fonts/${FILE}`, `https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/files/${FILE}`];
let loading: Promise<boolean> | null = null;
let ready = false;

/** Is a font with Chinese glyphs registered? */
export const cjk_ready = (): boolean => ready;

/** Register the Chinese font once (resolves false when no source could be loaded; a later call tries again). */
export function ensure_cjk_font(): Promise<boolean> {
  if (ready) return Promise.resolve(true);
  loading ??= (async () => {
    for (const src of SOURCES) {
      try {
        // a static host may answer a missing file with the app's HTML: only accept a font
        const r = await fetch(src);
        if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) continue;
        await register_font('Noto Sans SC', await r.arrayBuffer());
        ready = true;
        return true;
      } catch {
        /* next source */
      }
    }
    loading = null;
    return false;
  })();
  return loading;
}
