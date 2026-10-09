// GET /api/providers: which model providers this deployment holds a key for
// (names only, never keys), and whether live narration (/api/tts) is on.
import { json } from './http';
import { tts_mode, type TtsEnv } from './tts/providers';

export interface ProvidersEnv extends TtsEnv {
  DEEPSEEK_API_KEY?: string;
}
export interface ProvidersReply {
  anthropic: boolean;
  deepseek: boolean;
  tts: boolean;
}
/** `anthropic`: whether an Anthropic proxy exists (only the dev server has one). */
export const providers_reply = (env: ProvidersEnv, anthropic = false): ProvidersReply => ({
  anthropic,
  deepseek: !!env.DEEPSEEK_API_KEY,
  tts: tts_mode(env) !== null,
});
export const providers = (env: ProvidersEnv, anthropic = false) => json(200, providers_reply(env, anthropic));
