// Cloudflare Pages Function: POST /api/tts {text, lang?} -> a recording of the line
// (MP3 + word boundaries), in the voice of its language: Andrew for English,
// Yunxi for Chinese (MATHNIM_VOICE_EN / MATHNIM_VOICE_ZH override). Logic in
// server/tts/ (shared with the dev server).
// Provider: Azure AI Speech when AZURE_SPEECH_KEY/AZURE_SPEECH_REGION are set,
// else Edge's unofficial read-aloud endpoint (demo grade); TTS=off disables.
import { tts, type TtsHandlerEnv } from '../../server/tts/handler';
import { EdgeCache, limiter, pages, workers_connect } from '../../server/workers';

type Env = TtsHandlerEnv & { RATE_LIMITS?: string };

export const onRequest = pages<Env>('tts', ['POST'], ({ request, env }, note) =>
  tts(request, env, { connect: workers_connect, cache: new EdgeCache(new URL(request.url).origin, 'mathnim'), limiter: limiter('tts', env) }, note));
