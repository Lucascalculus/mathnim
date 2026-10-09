// The Narrator with stubbed browser pieces: recorded lines first, then live
// narration from /api/tts, then captions only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cue, TtsReply } from '../../../packages/core/src/narration';

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
function reply(text: string, bytes: number[], words: [number, number, string][]): TtsReply {
  return { key: 'k', text, voice: 'v', provider: 'edge', duration: 1, words, audio: b64(bytes), audio_duration: bytes.length / 6000, timing: 'measured' };
}

let calls: { url: string; body?: string }[];
let tts_on: boolean;
let played: string[];

beforeEach(() => {
  vi.resetModules(); // the Narrator module keeps per-page state (availability, takes)
  calls = [];
  tts_on = true;
  played = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as string | undefined });
    if (url === '/api/providers') return Response.json({ anthropic: false, deepseek: true, tts: tts_on });
    if (url.startsWith('narration/')) return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }); // SPA fallback
    if (url === '/api/tts') {
      const { text } = JSON.parse(init!.body as string);
      const n = text.length % 7 + 1;
      return Response.json(reply(text, new Array(n).fill(n), [[0.1, 0.2, text.split(' ')[0]]]));
    }
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 1) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (h: number) => clearTimeout(h));
  vi.stubGlobal(
    'Audio',
    class {
      currentTime = 0;
      playbackRate = 1;
      paused = true;
      ended = false;
      onended: (() => void) | null = null;
      constructor(public src: string) {}
      play() {
        played.push(this.src);
        this.paused = false;
        setTimeout(() => {
          this.currentTime = 0.15;
          setTimeout(() => {
            this.ended = true;
            this.onended?.();
          }, 5);
        }, 5);
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

async function narrator() {
  const { Narrator } = await import('../../../packages/present/src/narrator');
  const caption = { textContent: '' } as HTMLElement;
  const n = new Narrator(caption);
  const cues: [Cue[], number][] = [];
  n.on_cue = (c, i) => cues.push([c, i]);
  return { n, caption, cues };
}

describe('Narrator with live narration', () => {
  it('speaks a line without a recording through /api/tts, with cues', async () => {
    const { n, cues } = await narrator();
    await n.say('Drag P along the circle.');
    expect(calls.map((c) => c.url)).toEqual(['narration/' + (await import('../../../packages/core/src/narration')).narration_key('Drag P along the circle.') + '.json', '/api/providers', '/api/tts']);
    expect(JSON.parse(calls[2].body!)).toEqual({ text: 'Drag P along the circle.' });
    expect(played[0]).toMatch(/^data:audio\/mpeg;base64,/);
    expect(cues.at(-1)![1]).toBe(cues.at(-1)![0].length); // finished
    // the same line again: no new request, providers asked once
    await n.say('Drag P along the circle.');
    expect(calls.filter((c) => c.url === '/api/tts')).toHaveLength(1);
    expect(calls.filter((c) => c.url === '/api/providers')).toHaveLength(1);
  });
  it('synthesises a long line in parts and plays them as one', async () => {
    const { n } = await narrator();
    const long = Array.from({ length: 6 }, (_, i) => `Sentence number ${i + 1} is here to make the line long enough for two parts, surely.`).join(' ');
    await n.say(long);
    const parts = calls.filter((c) => c.url === '/api/tts').map((c) => JSON.parse(c.body!).text as string);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(long);
    expect(played).toHaveLength(1);
    const bytes = atob(played[0].split(',')[1]).length;
    expect(bytes).toBe(parts.reduce((s, p) => s + (p.length % 7) + 1, 0));
  });
  it('shows captions only when the server has no live narration', async () => {
    tts_on = false;
    const { n, caption } = await narrator();
    await n.say('Just a caption.');
    expect(caption.textContent).toBe('Just a caption.');
    expect(calls.some((c) => c.url === '/api/tts')).toBe(false);
    expect(played).toHaveLength(0);
  });
  it('does nothing audible when narration is off', async () => {
    const { n, caption } = await narrator();
    n.enabled = false;
    await n.say('Quiet.');
    expect(caption.textContent).toBe('Quiet.');
    expect(calls).toHaveLength(0);
  });
});
