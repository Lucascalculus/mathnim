// Chinese glyphs for node-side rendering (the visuals check and the lesson
// doctor). manim-web draws Text from fonts it has loaded and ships none with
// Chinese, so zh labels would be empty boxes. The first time a build draws a
// Chinese character without a glyph, a local Chinese font is registered and the
// build is run again; nothing is downloaded. Font, in this order:
//   1. $MATHNIM_CJK_FONT (a path);
//   2. apps/mathnim/public/fonts/noto-sans-sc-chinese-simplified-400-normal.woff
//      (the font the app uses in the browser), if it is there;
//   3. macOS: /System/Library/Fonts/Supplemental/Arial Unicode.ttf (23 MB, so
//      only read when needed; its metrics differ a little from Noto Sans SC).
import fs from 'node:fs';
import path from 'node:path';
import { face_for_char, register_font_bytes, resolve_font } from 'manim-web/ext/text/fonts';

const NOTO = 'noto-sans-sc-chinese-simplified-400-normal.woff';
const CJK = /[⺀-⿿　-ヿ㐀-鿿豈-﫿︰-﹏＀-￯]/;
let state: 'idle' | 'loaded' | 'failed' = 'idle';
let missing = false;
let watching = false;

/** Where to look, in order (`public_dir`: the app's public folder). */
export function cjk_candidates(public_dir = process.env.MATHNIM_PUBLIC): string[] {
  return [process.env.MATHNIM_CJK_FONT, public_dir && path.join(public_dir, 'fonts', NOTO), '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'].filter((x): x is string => !!x);
}

/** Notice manim-web's "no loaded font has a glyph" warnings for Chinese characters (they are retried, so not printed). */
export function watch_cjk(): void {
  if (watching) return;
  watching = true;
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const m = typeof args[0] === 'string' ? /no loaded font has a glyph for "(.+?)"/u.exec(args[0]) : null;
    if (m && CJK.test(m[1])) {
      missing = true;
      if (state !== 'failed') return;
    }
    warn(...args);
  };
}

/** Register the first usable Chinese font; prints which one. False when none is usable. */
export function load_cjk(log: (s: string) => void = console.log): boolean {
  if (state !== 'idle') return state === 'loaded';
  for (const file of cjk_candidates()) {
    if (!fs.existsSync(file)) continue;
    try {
      const names = register_font_bytes(new Uint8Array(fs.readFileSync(file)), {}, file);
      // the font must parse and actually have Chinese glyphs
      const ok = names.some((n) => face_for_char(resolve_font(n, 400, 'normal'), '中'.codePointAt(0)!)[0].family === n && face_for_char(resolve_font(n, 400, 'normal'), '中'.codePointAt(0)!)[1] > 0);
      if (!ok) {
        log(`Chinese font ${file}: no Chinese glyphs, trying the next one`);
        continue;
      }
      const noto = /noto sans sc/i.test(names[0]);
      log(`Chinese labels drawn with ${names[0]} (${file})${noto ? '' : ' - metrics approximate: the app draws them with Noto Sans SC'}`);
      state = 'loaded';
      return true;
    } catch (e) {
      log(`Chinese font ${file} could not be used (${(e as Error).message}); trying the next one`);
    }
  }
  log('no Chinese font found: zh labels are drawn as boxes (set MATHNIM_CJK_FONT to a .ttf/.otf/.woff path)');
  state = 'failed';
  return false;
}

/** Run a build; if it drew Chinese text with no font for it, load the Chinese font (once) and run it again. */
export async function with_cjk<T>(build: () => Promise<T>): Promise<T> {
  watch_cjk();
  missing = false;
  const first = await build();
  if (!missing || state !== 'idle' || !load_cjk()) return first;
  missing = false;
  return build();
}
