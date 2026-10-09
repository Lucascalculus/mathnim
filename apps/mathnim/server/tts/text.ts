// Text for the speech services: request validation, the spoken form, the voice
// for the line's language, and SSML.
import { spoken_lang, to_spoken } from '../../../../packages/core/src/narration';
import type { Parsed } from '../http';

/** The voices of the pre-generated narration (tools/gen_narration.py): English and Chinese. */
export const VOICE = 'en-US-AndrewMultilingualNeural';
export const VOICE_ZH = 'zh-CN-YunxiNeural';
export type SpokenLang = 'en' | 'zh';
export const RATE = '+0%';
/** 48 kbps CBR MP3: bytes -> seconds is exact, and parts concatenate. */
export const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
export const MP3_BYTES_PER_SECOND = 48_000 / 8;
/** Longest caption text one request may synthesise (the Narrator splits longer lines). */
export const MAX_TTS_CHARS = 600;
/** One SSML request to the Edge endpoint must stay under 4096 bytes of text. */
export const MAX_SSML_TEXT_BYTES = 4000;

/** Body of POST /api/tts: {text, lang?}; without a (valid) lang the text's own script decides. */
export function parse_tts_request(body: string): Parsed<{ text: string; lang: SpokenLang }> {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON.' };
  }
  const text = (data as { text?: unknown })?.text;
  if (typeof text !== 'string' || !text.trim()) return { ok: false, status: 400, error: 'Expected {"text": "..."}.' };
  if (text.length > MAX_TTS_CHARS) return { ok: false, status: 413, error: `Text too long (max ${MAX_TTS_CHARS} characters).` };
  const asked = (data as { lang?: unknown }).lang;
  const lang: SpokenLang = asked === 'zh' || asked === 'en' ? asked : spoken_lang(text);
  return { ok: true, value: { text, lang } };
}

/** Control characters the service rejects (vertical tab from pasted PDFs etc.) become spaces. */
export const clean_text = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
/** Escape text content for SSML (&, <, > like Python's xml.sax.saxutils.escape). */
export const escape_xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const unescape_xml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export interface Voice {
  voice: string;
  rate: string;
  pitch?: string;
  volume?: string;
  lang?: string;
}
export const DEFAULT_VOICE: Voice = { voice: VOICE, rate: RATE, lang: 'en-US' };
export const DEFAULT_VOICE_ZH: Voice = { voice: VOICE_ZH, rate: RATE, lang: 'zh-CN' };
/** Voice overrides: MATHNIM_VOICE_EN / MATHNIM_VOICE_ZH (the same variables as tools/gen_narration.py). */
export interface VoiceEnv {
  MATHNIM_VOICE_EN?: string;
  MATHNIM_VOICE_ZH?: string;
}
/** Neural voice names look like 'zh-CN-YunxiNeural'; anything else is ignored. */
const voice_name = (s: string | undefined) => (s && /^[a-z]{2,3}-[A-Za-z]{2,4}(-[A-Za-z]+)?-[A-Za-z]+Neural$/.test(s.trim()) ? s.trim() : null);
/** The voice for a line in `lang`: Andrew for English, Yunxi for Chinese, unless the environment names another. */
export function voice_for(lang: SpokenLang, env: VoiceEnv = {}): Voice {
  const base = lang === 'zh' ? DEFAULT_VOICE_ZH : DEFAULT_VOICE;
  const name = voice_name(lang === 'zh' ? env.MATHNIM_VOICE_ZH : env.MATHNIM_VOICE_EN);
  return name ? { ...base, voice: name } : base;
}

/** Caption text -> the escaped spoken text that goes inside the SSML (in the line's language). */
export const ssml_text = (caption: string, lang: SpokenLang = spoken_lang(caption)) => escape_xml(clean_text(to_spoken(caption, lang)));

/** SSML as edge-tts builds it (voice + prosody). `escaped` must already be escaped. */
export function build_ssml(escaped: string, v: Voice = DEFAULT_VOICE): string {
  const q = (s: string) => s.replace(/'/g, '&apos;');
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${q(v.lang ?? 'en-US')}'>` +
    `<voice name='${q(v.voice)}'><prosody pitch='${q(v.pitch ?? '+0Hz')}' rate='${q(v.rate)}' volume='${q(v.volume ?? '+0%')}'>` +
    escaped +
    '</prosody></voice></speak>'
  );
}

/** When a service returns no word boundaries: spread the words over the audio by length. */
export function estimate_words(spoken: string, seconds: number): [number, number, string][] {
  // Chinese has no spaces: each Han character counts as a word
  const words = spoken.split(/\s+|(?<=[\u3400-\u9fff])|(?=[\u3400-\u9fff])/u).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const lead = Math.min(0.1, seconds / 10), span = Math.max(0, seconds - 2 * lead);
  let acc = 0;
  return words.map((w) => {
    const s = lead + (acc / total) * span;
    acc += w.length + 1;
    const e = lead + ((acc - 1) / total) * span;
    return [r3(s), r3(e), w];
  });
}
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
