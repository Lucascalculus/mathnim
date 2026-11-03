// A tokenizer that knows which punctuation may not start or end a line (kinsoku), so every material breaks
// Chinese and English lines the same way.

// punctuation that never starts a line, and that never ends one
const NO_START = /^[，。、；：？！）」』”’》〉…—,.;:?!)\]’”%]/;
const NO_END = /[（「『“‘《〈(\[‘“]$/;
const CJK = /[　-鿿＀-￯]/;

// split a run of text into tokens: one per CJK character, one per Latin word (with the space after it noted)
export function tokens(text) {
  const out = [];
  const re = /([A-Za-z0-9À-ɏ.'’²³⁰-⁹₀-₉×−+=\-/]+)|(\s+)|(.)/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[2]) { if (out.length) out[out.length - 1].sp = true; continue; }
    const t = m[1] || m[3];
    out.push({ t, sp: false, cjk: CJK.test(t) });
  }
  return out;
}
export const no_start = (t) => NO_START.test(t);
export const no_end = (t) => NO_END.test(t);
