// Narration lines as data: the key that names a recorded line, and caption
// cues timed by the recording's word boundaries (no DOM).
/**
 * A beat in a scene's narration: "§" where the scene's next section (Scene.next_section) should start. The picture
 * waits there until the voice gets to it (ScenePlayer.wait_for, timed by beat_times from the recording itself, so any
 * voice, speed or language lines up). Beats are not said or shown, and do not change a line's recording.
 */
export const BEAT = '§';
/**
 * A line as it is said and shown: without its beats ("ahead: § the" -> "ahead: the"; "两秒：§虚线" -> "两秒：虚线").
 * Beats side by side ("§§": two sections start on the same word) go as one.
 */
export const unbeat = (text: string): string => (text.includes(BEAT) ? text.replace(/\s*(?:§\s*)+/g, (m) => (/\s/.test(m) ? ' ' : '')).trim() : text);
/**
 * When this recording's voice reaches each beat of `text` (seconds): the start of the word the beat stands before,
 * found by its share of the line's spoken letters and digits (the words a voice reports are its own, so they are
 * matched by share rather than by spelling).
 */
export function beat_times(text: string, rec: Recording): number[] {
  const parts = text.split(BEAT);
  if (parts.length < 2) return [];
  const lang = spoken_lang(unbeat(text));
  const letters = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '').length;
  const total = letters(to_spoken(unbeat(text), lang)) || 1;
  const sizes = rec.words.map((w) => letters(w[2]));
  const said = sizes.reduce((a, b) => a + b, 0) || 1;
  const out: number[] = [];
  for (let k = 1; k < parts.length; k++) {
    const share = letters(to_spoken(unbeat(parts.slice(0, k).join(BEAT)), lang)) / total;
    let i = 0;
    for (let acc = 0; i < sizes.length && acc / said < share - 1e-6; i++) acc += sizes[i];
    out.push(i < rec.words.length ? rec.words[i][0] : rec.duration);
  }
  return out;
}

/** A scene's voice starts this long after its picture (seconds): the eye finds the figure first. */
export const VOICE_DELAY = 0.6;
/** A section starts this long before the words its beat stands at (seconds): its motion is under way as they are said. */
export const BEAT_LEAD = 0.4;
/** A scene's beats on its picture's clock (the voice starts VOICE_DELAY in): when each beat's words are said, and the end. */
export function scene_beats(text: string, rec: Recording): { at: number[]; end: number } {
  return { at: beat_times(text, rec).map((t) => t + VOICE_DELAY), end: rec.duration + VOICE_DELAY };
}

/** Stable key of a narration line (FNV-1a 64-bit, hex); gen_narration uses the same. Beats do not count. */
export function narration_key(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(unbeat(text))) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export interface Recording {
  text: string;
  duration: number;
  words: [number, number, string][];
}
export interface Cue {
  start: number;
  end: number;
  text: string;
}

const CJK_CHAR = /[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/;
/** Display width: a Chinese character counts as two Latin ones. */
const width = (s: string) => [...s].reduce((n, c) => n + (CJK_CHAR.test(c) ? 2 : 1), 0);
/** Join two caption pieces: Latin pieces with a space, Chinese ones without. */
const join = (a: string, b: string) => (!a ? b : CJK_CHAR.test(a.slice(-1)) || CJK_CHAR.test(b.charAt(0)) ? a + b : `${a} ${b}`);

/**
 * Split a line into caption cues (sentences / phrases up to max_chars of
 * display width; a Chinese character counts double), timed by the spoken words.
 * English splits after . ? ! ; : , — and a space; Chinese after 。！？；：，、.
 */
export function caption_cues(text: string, rec: Recording, max_chars = 84): Cue[] {
  const pieces = text.split(/(?<=[.?!;:,—])\s+|(?<=[。！？；：，、])/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const p of pieces) {
    if (buf && width(buf) + 1 + width(p) > max_chars) {
      chunks.push(buf);
      buf = p;
    } else buf = join(buf, p);
  }
  if (buf) chunks.push(buf);
  if (chunks.length === 1 || !rec.words.length) return [{ start: 0, end: rec.duration, text }];
  // share the words out in proportion to characters
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const cues: Cue[] = [];
  let acc = 0;
  for (const c of chunks) {
    const i0 = Math.floor((acc / total) * rec.words.length);
    acc += c.length;
    const i1 = Math.max(i0, Math.ceil((acc / total) * rec.words.length) - 1);
    cues.push({ start: rec.words[Math.min(i0, rec.words.length - 1)][0], end: rec.words[Math.min(i1, rec.words.length - 1)][1], text: c });
  }
  cues[0].start = 0;
  cues[cues.length - 1].end = rec.duration;
  return cues;
}


// ---------------------------------------------------------------- live narration (WP8)
// Lines without a pre-generated recording can be synthesised on demand by the
// server (POST /api/tts, apps/mathnim/server/tts). These helpers are shared by
// that server and the Narrator.

const SYMBOLS: [string, string][] = [
  ['≈', ' about '], ['θ', 'theta'], ['α', 'alpha'], ['β', 'beta'], ['°', ' degrees'], ['²', ' squared'],
  ['√', 'root '], ['½', 'half'], ['×', ' times '], ['−', ' minus '], ['∠', 'angle '], ['·', ' times '],
];
/** The language a line is spoken in: Chinese when it has Chinese characters, else English. */
export function spoken_lang(text: string): 'en' | 'zh' {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text) ? 'zh' : 'en';
}
const ZH_SYMBOLS: [string, string][] = [
  ['≈', '约等于'], ['°', '度'], ['²', '的平方'], ['³', '的立方'], ['√', '根号'], ['½', '二分之一'], ['×', '乘'], ['−', '减'], ['∠', '角'], ['·', '乘'],
];
/**
 * Caption text -> what the voice reads: "9 m" is "9 meters", "AB" is spelled
 * out ("A-B"), symbols are named. Same rules as `to_spoken` in
 * apps/mathnim/tools/gen_narration.py (Python's Unicode `\b` and `\d` are
 * spelled out here), so live and pre-generated lines sound alike. Caption
 * markup ($TeX$, **bold**) is first turned into words (speakable_markup).
 * Chinese lines (spoken_lang) keep abbreviations and Greek letters as written
 * (the Chinese voices read LoRA, KL, β natively) and name symbols in Chinese.
 */
export function to_spoken(text: string, lang: 'en' | 'zh' = spoken_lang(text)): string {
  text = unbeat(text);
  if (lang === 'zh') {
    let z = speakable_markup(text, 'zh');
    for (const [a, b] of ZH_SYMBOLS) z = z.split(a).join(b);
    return z.replace(/\s+/g, ' ').trim();
  }
  let s = speakable_markup(text).replace(/(\p{Nd}+(?:\.\p{Nd}+)?)\s?m(?![\p{L}\p{N}_])/gu, '$1 meters');
  s = s.replace(/(?<![\p{L}\p{N}_])([A-Z]{2,3})(?![\p{L}\p{N}_])/gu, (_, g: string) => g.split('').join('-'));
  for (const [a, b] of SYMBOLS) s = s.split(a).join(b);
  return s.replace(/\s+/g, ' ').trim();
}

// Caption markup (math_html in @mathnim/present): $TeX$, **bold**, *italic*.
const TEX_SPEECH: [RegExp, string][] = [
  [/\^\s*\{?\\circ\}?/g, ' degrees'],
  [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 over $2 '],
  [/\\sqrt\s*\{([^{}]*)\}/g, ' root $1 '],
  [/\^\s*\{?2\}?(?![\d])/g, ' squared '],
  [/\^\s*\{?3\}?(?![\d])/g, ' cubed '],
  [/\^\s*\{([^{}]*)\}/g, ' to the power $1 '],
  [/\^\s*(\w+)/g, ' to the power $1 '],
  [/_\s*\{([^{}]*)\}/g, ' $1'],
  [/_(\w)/g, ' $1'],
  [/\\(?:cdot|times)(?![a-zA-Z])/g, ' times '],
  [/\\div(?![a-zA-Z])/g, ' divided by '],
  [/\\pm(?![a-zA-Z])/g, ' plus or minus '],
  [/\\(?:le|leq)(?![a-zA-Z])/g, ' less than or equal to '],
  [/\\(?:ge|geq)(?![a-zA-Z])/g, ' greater than or equal to '],
  [/\\(?:ne|neq)(?![a-zA-Z])/g, ' not equal to '],
  [/\\approx(?![a-zA-Z])/g, ' about '],
  [/\\(?:angle|measuredangle)(?![a-zA-Z])/g, ' angle '],
  [/\\(?:circ|degree)(?![a-zA-Z])/g, ' degrees'],
  [/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, ' $1 '],
  [/\\(pi|theta|alpha|beta|gamma|delta|phi|lambda|mu|sigma|omega|infty)(?![a-zA-Z])/g, ' $1 '],
  [/\\[a-zA-Z]+|\\./g, ' '],
  [/[{}]/g, ''],
];
// The same in Chinese: \frac{a}{b} is "b 分之 a", r^2 is "r 的平方"; Greek letters stay letters.
const GREEK: Record<string, string> = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', pi: 'π', omega: 'ω', phi: 'φ', infty: '无穷' };
const TEX_SPEECH_ZH: [RegExp, string][] = [
  [/\^\s*\{?\\circ\}?/g, '度'],
  [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $2 分之 $1 '],
  [/\\sqrt\s*\{([^{}]*)\}/g, ' 根号 $1 '],
  [/\^\s*\{?2\}?(?![\d])/g, '的平方'],
  [/\^\s*\{?3\}?(?![\d])/g, '的立方'],
  [/\^\s*\{([^{}]*)\}/g, '的 $1 次方'],
  [/\^\s*(\w+)/g, '的 $1 次方'],
  [/_\s*\{([^{}]*)\}/g, ' $1'],
  [/_(\w)/g, ' $1'],
  [/\\(?:cdot|times)(?![a-zA-Z])/g, ' 乘 '],
  [/\\div(?![a-zA-Z])/g, ' 除以 '],
  [/\\pm(?![a-zA-Z])/g, ' 正负 '],
  [/\\(?:le|leq)(?![a-zA-Z])/g, ' 小于等于 '],
  [/\\(?:ge|geq)(?![a-zA-Z])/g, ' 大于等于 '],
  [/\\(?:ne|neq)(?![a-zA-Z])/g, ' 不等于 '],
  [/\\approx(?![a-zA-Z])/g, ' 约等于 '],
  [/\\(?:circ|degree)(?![a-zA-Z])/g, '度'],
  [/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, ' $1 '],
  [/\\(alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|omega|phi|infty)(?![a-zA-Z])/g, ''],
  [/\\[a-zA-Z]+|\\./g, ' '],
  [/[{}]/g, ''],
];
/** $TeX$ read as words (\frac{a}{b} -> "a over b", r^2 -> "r squared"), emphasis marks dropped. Plain text is unchanged. */
export function speakable_markup(text: string, lang: 'en' | 'zh' = 'en'): string {
  if (!/[$*`]/.test(text)) return text;
  const s = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1');
  const rules = lang === 'zh' ? TEX_SPEECH_ZH : TEX_SPEECH;
  return s.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_, display: string | undefined, inline: string | undefined) => {
    let t = display ?? inline ?? '';
    if (lang === 'zh') t = t.replace(/\\(alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|omega|phi|infty)(?![a-zA-Z])/g, (_m, g: string) => ` ${GREEK[g]} `);
    for (const [re, to] of rules) t = t.replace(re, to);
    return ` ${t} `;
  });
}

/** What POST /api/tts returns: a Recording plus its audio. */
export interface TtsReply extends Recording {
  /** narration_key(text): the same key a pre-generated file would have. */
  key: string;
  voice: string;
  /** 'edge' (unofficial read-aloud endpoint, demo grade) or 'azure'. */
  provider: string;
  /** MP3 (audio-24khz-48kbitrate-mono-mp3), base64. */
  audio: string;
  /** Length of the audio itself in seconds (duration, like the files, is the last word's end + 0.25). */
  audio_duration: number;
  /** 'estimated' when the provider gave no word boundaries and they were spread over the audio. */
  timing?: 'measured' | 'estimated';
}

/** Split a long line into parts of at most `max` characters for synthesis, at sentence, then clause, then word breaks. */
export function tts_parts(text: string, max = 280): string[] {
  const units: string[] = [];
  const split = (s: string, level: number) => {
    if (s.length <= max || level > 2) {
      units.push(s);
      return;
    }
    const re = [/(?<=[.?!;:])\s+/, /(?<=[,—])\s+/, /\s+/][level];
    for (const p of s.split(re)) split(p, level + 1);
  };
  split(text.replace(/\s+/g, ' ').trim(), 0);
  const parts: string[] = [];
  let buf = '';
  for (const u of units) {
    if (buf && buf.length + 1 + u.length > max) {
      parts.push(buf);
      buf = u;
    } else buf = buf ? `${buf} ${u}` : u;
  }
  if (buf) parts.push(buf);
  return parts.filter(Boolean);
}

/** One Recording for a line synthesised in parts whose audio is played back to back (MP3 frames concatenate). */
export function merge_recordings(text: string, parts: { words: [number, number, string][]; audio_duration: number }[]): Recording {
  const words: [number, number, string][] = [];
  let t = 0;
  for (const p of parts) {
    for (const [s, e, w] of p.words) words.push([round3(s + t), round3(e + t), w]);
    t += p.audio_duration;
  }
  return { text, duration: round3(t), words };
}
const round3 = (x: number) => Math.round(x * 1000) / 1000;
