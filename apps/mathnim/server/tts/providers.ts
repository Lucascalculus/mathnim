// Speech providers behind one interface.
//
//  - azure: Azure AI Speech (the official service; the same Andrew
//    Multilingual voice). Used when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION
//    are set.
//  - edge:  Edge's read-aloud endpoint, the one the edge-tts Python package
//    (and our pre-generated narration) uses. DEV / DEMO GRADE: unofficial and
//    undocumented, may change or refuse traffic at any time, no SLA, and its
//    terms do not cover production use. Fine for local development and a demo;
//    set the Azure variables before real students depend on it.
import { sha256_hex } from '../http';
import { build_ssml, estimate_words, MP3_BYTES_PER_SECOND, OUTPUT_FORMAT, type Voice } from './text';
import { js_date, synthesize_ws, text_frame, uuid_hex, type Connect, type Word } from './protocol';

export interface Synthesis {
  /** MP3, OUTPUT_FORMAT. */
  audio: Uint8Array;
  words: Word[];
  timing: 'measured' | 'estimated';
}
export interface TtsProvider {
  name: 'edge' | 'azure';
  /** `escaped` is the spoken text, XML-escaped (see ssml_text); `spoken` the same unescaped. */
  synthesize(escaped: string, spoken: string, v: Voice): Promise<Synthesis>;
}
export interface TtsEnv {
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  /** "off" disables live narration; "edge" or "azure" forces a provider (default: azure when configured, else edge). */
  TTS?: string;
}
export interface TtsDeps {
  connect: Connect;
  fetch?: typeof fetch;
}

/** Which provider the environment selects (null: live narration off). */
export function tts_mode(env: TtsEnv): TtsProvider['name'] | null {
  const mode = (env.TTS ?? '').trim().toLowerCase();
  if (mode === 'off' || mode === 'false' || mode === '0') return null;
  const azure_ok = !!env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/.test(env.AZURE_SPEECH_REGION ?? '');
  if (mode === 'azure') return azure_ok ? 'azure' : null;
  return mode !== 'edge' && azure_ok ? 'azure' : 'edge';
}
export function choose_provider(env: TtsEnv, deps: TtsDeps): TtsProvider | null {
  const mode = tts_mode(env);
  if (mode === 'azure') return azure_provider(env.AZURE_SPEECH_KEY!, env.AZURE_SPEECH_REGION!, deps);
  return mode === 'edge' ? edge_provider(deps) : null;
}

// ---------------------------------------------------------------- Edge read-aloud (unofficial)
// Constants as in edge-tts 7.2.8 (reference/.venv/.../edge_tts/constants.py);
// when Microsoft rejects the handshake, compare with the newest edge-tts.
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

/** The Sec-MS-GEC token: SHA-256 of the Windows file time (rounded down to 5 minutes) and the client token. */
export async function sec_ms_gec(now_ms = Date.now()): Promise<string> {
  const s = Math.floor(now_ms / 1000) + 11_644_473_600;
  const ticks = BigInt(s - (s % 300)) * 10_000_000n;
  return (await sha256_hex(`${ticks}${TRUSTED_CLIENT_TOKEN}`)).toUpperCase();
}
export async function edge_url(now_ms = Date.now()): Promise<string> {
  return `${EDGE_WSS}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${uuid_hex()}&Sec-MS-GEC=${await sec_ms_gec(now_ms)}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;
}
export function edge_headers(): Record<string, string> {
  const muid = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return {
    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
    'Accept-Language': 'en-US,en;q=0.9',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    Cookie: `muid=${muid};`,
  };
}
export function edge_messages(ssml: string, now = new Date()): string[] {
  const ts = js_date(now);
  return [
    text_frame([['X-Timestamp', ts], ['Content-Type', 'application/json; charset=utf-8'], ['Path', 'speech.config']],
      `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"${OUTPUT_FORMAT}"}}}}\r\n`),
    // the trailing "Z" after a JS date is what Edge itself sends
    text_frame([['X-RequestId', uuid_hex()], ['Content-Type', 'application/ssml+xml'], ['X-Timestamp', `${ts}Z`], ['Path', 'ssml']], ssml),
  ];
}
export function edge_provider(deps: TtsDeps): TtsProvider {
  return {
    name: 'edge',
    async synthesize(escaped, _spoken, v) {
      const r = await synthesize_ws({ connect: deps.connect, url: await edge_url(), headers: edge_headers(), messages: edge_messages(build_ssml(escaped, v)) });
      return { ...r, timing: 'measured' };
    },
  };
}

// ---------------------------------------------------------------- Azure AI Speech (official)
// Word boundaries come from the service's websocket API (the one the Speech
// SDK uses); if that fails, the documented REST API gives the audio and the
// word times are estimated.
export function azure_messages(ssml: string, request_id = uuid_hex(), now = new Date()): string[] {
  const h = (path: string, type: string): [string, string][] => [['Path', path], ['X-RequestId', request_id], ['X-Timestamp', now.toISOString()], ['Content-Type', type]];
  return [
    text_frame(h('speech.config', 'application/json'), JSON.stringify({ context: { system: { name: 'SpeechSDK', version: '1.40.0', build: 'JavaScript', lang: 'JavaScript' }, os: { platform: 'Server', name: 'mathnim', version: '1' } } })),
    text_frame(h('synthesis.context', 'application/json'), JSON.stringify({
      synthesis: {
        audio: {
          metadataOptions: { bookmarkEnabled: false, punctuationBoundaryEnabled: 'false', sentenceBoundaryEnabled: false, sessionEndEnabled: true, visemeEnabled: false, wordBoundaryEnabled: 'true' },
          outputFormat: OUTPUT_FORMAT,
        },
        language: { autoDetection: false },
      },
    })),
    text_frame(h('ssml', 'application/ssml+xml'), ssml),
  ];
}
export function azure_provider(key: string, region: string, deps: TtsDeps): TtsProvider {
  const f = deps.fetch ?? fetch;
  return {
    name: 'azure',
    async synthesize(escaped, spoken, v) {
      const ssml = build_ssml(escaped, v);
      const id = uuid_hex();
      try {
        const r = await synthesize_ws({
          connect: deps.connect,
          url: `wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?X-ConnectionId=${id}`,
          headers: { 'Ocp-Apim-Subscription-Key': key, 'X-ConnectionId': id },
          messages: azure_messages(ssml, id),
        });
        return { ...r, timing: 'measured' };
      } catch {
        const res = await f(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': OUTPUT_FORMAT, 'User-Agent': 'mathnim' },
          body: ssml,
        });
        if (!res.ok) throw new Error(`azure speech ${res.status}`);
        const audio = new Uint8Array(await res.arrayBuffer());
        return { audio, words: estimate_words(spoken, audio.length / MP3_BYTES_PER_SECOND), timing: 'estimated' };
      }
    },
  };
}
