// POST /api/tts {text, lang?} -> TtsReply (packages/core/src/narration.ts): the
// line's audio (MP3, base64) with word boundaries, in the shape of the
// pre-generated narration files, read by the voice of its language (Andrew
// for English, Yunxi for Chinese; MATHNIM_VOICE_EN / _ZH override). Results
// are cached per voice and text (SHA-256).
import { narration_key, to_spoken, type TtsReply } from '../../../../packages/core/src/narration';
import { client_ip, error, origin_ok, read_text, sha256_hex, to_base64, too_many, type Note, type RateLimiter, type TextCache } from '../http';
import { choose_provider, type TtsDeps, type TtsEnv } from './providers';
import { DEFAULT_VOICE, MAX_SSML_TEXT_BYTES, MP3_BYTES_PER_SECOND, parse_tts_request, r3, ssml_text, voice_for, type Voice, type VoiceEnv } from './text';

export interface TtsHandlerEnv extends TtsEnv, VoiceEnv {
  ALLOWED_ORIGINS?: string;
}
export interface TtsHandlerDeps extends TtsDeps {
  cache: TextCache | null;
  limiter: RateLimiter | null;
}
export const TTS_CACHE_TTL = 30 * 86_400;

/** SHA-256, not the narration key: FNV collisions could be crafted to poison the shared cache. */
export const tts_cache_key = async (text: string, v: Voice = DEFAULT_VOICE) => `tts/${v.voice}/${v.rate}/${(await sha256_hex(text)).slice(0, 40)}`;

export async function tts(request: Request, env: TtsHandlerEnv, deps: TtsHandlerDeps, note: Note): Promise<Response> {
  if (request.method !== 'POST') return error(405, 'Use POST.', { allow: 'POST' });
  const provider = choose_provider(env, deps);
  if (!provider) return error(503, 'Live narration is off on this deployment.');
  note.provider = provider.name;
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const body = await read_text(request, 8 * 1024);
  if (body === null) return error(413, 'Request too large.');
  const parsed = parse_tts_request(body);
  if (!parsed.ok) return error(parsed.status, parsed.error);
  const { text, lang } = parsed.value;
  const voice = voice_for(lang, env);
  note.chars = text.length;

  const ck = await tts_cache_key(text, voice);
  const hit = await deps.cache?.get(ck).catch(() => null);
  if (hit) {
    note.cached = true;
    return new Response(hit, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-mathnim-cache': 'hit' } });
  }
  const v = deps.limiter?.hit(client_ip(request));
  if (v && !v.ok) return too_many(v, 'spoken lines');

  const escaped = ssml_text(text, lang);
  if (new TextEncoder().encode(escaped).length > MAX_SSML_TEXT_BYTES) return error(413, 'Text too long.');
  let r;
  try {
    r = await provider.synthesize(escaped, to_spoken(text, lang), voice);
  } catch (e) {
    note.error = String((e as Error)?.message ?? e).slice(0, 200);
    return error(502, 'The speech service did not answer.');
  }
  const audio_duration = r3(r.audio.length / MP3_BYTES_PER_SECOND);
  const last = r.words[r.words.length - 1];
  const reply: TtsReply = {
    key: narration_key(text),
    text,
    voice: voice.voice,
    provider: provider.name,
    duration: last ? r3(last[1] + 0.25) : audio_duration, // as tools/gen_narration.py
    words: r.words,
    audio: to_base64(r.audio),
    audio_duration,
    timing: r.timing,
  };
  const out = JSON.stringify(reply);
  if (deps.cache) note.after = deps.cache.put(ck, out, TTS_CACHE_TTL).catch(() => undefined);
  return new Response(out, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-mathnim-cache': 'miss' } });
}
