import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../server/http';
import { tts, tts_cache_key } from '../server/tts/handler';
import { js_date, parse_binary_frame, parse_text_frame, parse_word_boundaries, synthesize_ws } from '../server/tts/protocol';
import { azure_messages, choose_provider, edge_messages, edge_url, sec_ms_gec, tts_mode } from '../server/tts/providers';
import { build_ssml, clean_text, estimate_words, escape_xml, parse_tts_request, ssml_text, MAX_TTS_CHARS } from '../server/tts/text';
import { MemoryCache } from '../server/dev';
import { audio_msg, post, scripted, text_msg, word_msg } from './fakes';

describe('text and SSML', () => {
  it('escapes and cleans', () => {
    expect(escape_xml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(clean_text('a\u000bb\u0000c\nd')).toBe('a b c\nd');
    expect(ssml_text('AB < 9 m')).toBe('A-B &lt; 9 meters');
  });
  it('builds SSML like edge-tts', () => {
    expect(build_ssml('Hi &amp; bye')).toBe(
      "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='en-US-AndrewMultilingualNeural'>" +
        "<prosody pitch='+0Hz' rate='+0%' volume='+0%'>Hi &amp; bye</prosody></voice></speak>",
    );
  });
  it('validates requests', () => {
    expect(parse_tts_request('{"text":"Hello."}')).toEqual({ ok: true, value: { text: 'Hello.' } });
    expect(parse_tts_request('nope')).toMatchObject({ ok: false, status: 400 });
    expect(parse_tts_request('{"text":"  "}')).toMatchObject({ ok: false, status: 400 });
    expect(parse_tts_request('{"text":5}')).toMatchObject({ ok: false, status: 400 });
    expect(parse_tts_request(JSON.stringify({ text: 'x'.repeat(MAX_TTS_CHARS + 1) }))).toMatchObject({ ok: false, status: 413 });
  });
  it('estimates word times inside the audio', () => {
    const w = estimate_words('Hello, big world!', 2);
    expect(w.map((x) => x[2])).toEqual(['Hello', 'big', 'world']);
    for (let i = 0; i < w.length; i++) {
      expect(w[i][0]).toBeLessThan(w[i][1]);
      if (i) expect(w[i][0]).toBeGreaterThanOrEqual(w[i - 1][1]);
    }
    expect(w[w.length - 1][1]).toBeLessThanOrEqual(2);
  });
});

describe('speech protocol', () => {
  it('parses text frames', () => {
    const f = parse_text_frame('X-RequestId:1\r\nPath:turn.end\r\n\r\n{}');
    expect(f).toEqual({ headers: { 'X-RequestId': '1', Path: 'turn.end' }, body: '{}' });
  });
  it('parses binary frames', () => {
    const f = parse_binary_frame(new Uint8Array(audio_msg([1, 2, 3])));
    expect(f.headers.Path).toBe('audio');
    expect([...f.data]).toEqual([1, 2, 3]);
    expect(() => parse_binary_frame(new Uint8Array([0, 50, 1]))).toThrow();
  });
  it('parses word boundaries (seconds, unescaped, punctuation skipped)', () => {
    const body = JSON.stringify({
      Metadata: [
        { Type: 'WordBoundary', Data: { Offset: 1_000_000, Duration: 2_500_000, text: { Text: 'Tom&amp;Jerry', BoundaryType: 'WordBoundary' } } },
        { Type: 'WordBoundary', Data: { Offset: 3_500_000, Duration: 500_000, text: { Text: ',', BoundaryType: 'PunctuationBoundary' } } },
        { Type: 'SessionEnd', Data: { Offset: 0 } },
      ],
    });
    expect(parse_word_boundaries(body)).toEqual([[0.1, 0.35, 'Tom&Jerry']]);
  });
  it('formats the JS date Edge expects', () => {
    expect(js_date(new Date(Date.UTC(2026, 8, 30, 1, 2, 3)))).toBe('Wed Sep 30 2026 01:02:03 GMT+0000 (Coordinated Universal Time)');
  });
  it('computes Sec-MS-GEC like edge-tts', async () => {
    // edge_tts.drm.DRM.generate_sec_ms_gec() at unix time 1790000123.456
    expect(await sec_ms_gec(1_790_000_123_456)).toBe('8FD81A00C2EAEDB004963D5A0BD37C00DAF969A0A8FB3B08C469C9BEF94498F2');
    expect(await edge_url()).toMatch(/^wss:\/\/speech\.platform\.bing\.com\/.*TrustedClientToken=\w+&ConnectionId=[0-9a-f]{32}&Sec-MS-GEC=[0-9A-F]{64}&Sec-MS-GEC-Version=1-/);
  });
  it('builds the Edge and Azure messages', () => {
    const [config, ssml] = edge_messages('<speak/>', new Date(0));
    expect(config).toContain('Path:speech.config\r\n\r\n');
    expect(config).toContain('"wordBoundaryEnabled":"true"');
    expect(ssml).toMatch(/^X-RequestId:[0-9a-f]{32}\r\nContent-Type:application\/ssml\+xml\r\nX-Timestamp:Thu Jan 01 1970 00:00:00 GMT\+0000 \(Coordinated Universal Time\)Z\r\nPath:ssml\r\n\r\n<speak\/>$/);
    const az = azure_messages('<speak/>', 'r1');
    expect(az.map((m) => parse_text_frame(m).headers.Path)).toEqual(['speech.config', 'synthesis.context', 'ssml']);
    expect(az.every((m) => parse_text_frame(m).headers['X-RequestId'] === 'r1')).toBe(true);
  });
  it('collects audio and words until turn.end', async () => {
    const { connect, calls } = scripted([text_msg('turn.start'), word_msg('Hi', 1_000_000, 2_000_000), audio_msg([1, 2]), audio_msg([3]), text_msg('turn.end')]);
    const r = await synthesize_ws({ connect, url: 'wss://x', headers: { a: 'b' }, messages: ['m1', 'm2'] });
    expect([...r.audio]).toEqual([1, 2, 3]);
    expect(r.words).toEqual([[0.1, 0.3, 'Hi']]);
    expect(calls[0]).toMatchObject({ url: 'wss://x', headers: { a: 'b' }, sent: ['m1', 'm2'] });
  });
  it('reads Blob audio frames in order (workerd)', async () => {
    const { connect } = scripted([new Blob([audio_msg([1])]), audio_msg([2]), new Blob([audio_msg([3, 4])]), text_msg('turn.end')]);
    const r = await synthesize_ws({ connect, url: 'wss://x', headers: {}, messages: ['m1', 'm2'] });
    expect([...r.audio]).toEqual([1, 2, 3, 4]);
  });
  it('fails when the socket closes early or sends no audio', async () => {
    await expect(synthesize_ws({ connect: scripted([{ close: 1006 }]).connect, url: 'wss://x', headers: {}, messages: ['a', 'b'] })).rejects.toThrow(/closed/);
    await expect(synthesize_ws({ connect: scripted([text_msg('turn.end')]).connect, url: 'wss://x', headers: {}, messages: ['a', 'b'] })).rejects.toThrow(/no audio/);
  });
});

describe('provider choice', () => {
  it('prefers Azure when configured, Edge otherwise, none when off', () => {
    expect(tts_mode({})).toBe('edge');
    expect(tts_mode({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastus' })).toBe('azure');
    expect(tts_mode({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'east us!' })).toBe('edge');
    expect(tts_mode({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastus', TTS: 'edge' })).toBe('edge');
    expect(tts_mode({ TTS: 'azure' })).toBe(null);
    expect(tts_mode({ TTS: 'off' })).toBe(null);
  });
  it('falls back to Azure REST with estimated timing when the socket fails', async () => {
    const fetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
      expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('k');
      return new Response(new Uint8Array(12_000));
    }) as unknown as typeof globalThis.fetch;
    const p = choose_provider({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastus' }, { connect: async () => Promise.reject(new Error('no')), fetch })!;
    const r = await p.synthesize('Two words', 'Two words', { voice: 'v', rate: '+0%' });
    expect(r.timing).toBe('estimated');
    expect(r.words.map((w) => w[2])).toEqual(['Two', 'words']);
    expect(r.words[1][1]).toBeLessThanOrEqual(2);
  });
});

describe('POST /api/tts', () => {
  const script = () => scripted([word_msg('Hello', 1_000_000, 2_500_000), audio_msg(new Array(6000).fill(7)), text_msg('turn.end')]);
  it('returns a recording and caches it', async () => {
    const s = script();
    const cache = new MemoryCache();
    const note = {};
    const res = await tts(post('/api/tts', { text: 'Hello.' }), {}, { connect: s.connect, cache, limiter: null }, note);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-mathnim-cache')).toBe('miss');
    const r = await res.json();
    expect(r).toMatchObject({ text: 'Hello.', voice: 'en-US-AndrewMultilingualNeural', provider: 'edge', words: [[0.1, 0.35, 'Hello']], duration: 0.6, audio_duration: 1, timing: 'measured' });
    expect(atob(r.audio).length).toBe(6000);
    expect(s.calls[0].headers.Origin).toMatch(/^chrome-extension:/);
    await (note as { after?: Promise<unknown> }).after;
    expect(await cache.get(await tts_cache_key('Hello.'))).toBeTruthy();
    const again = await tts(post('/api/tts', { text: 'Hello.' }), {}, { connect: s.connect, cache, limiter: null }, {});
    expect(again.headers.get('x-mathnim-cache')).toBe('hit');
    expect(s.calls.length).toBe(1);
  });
  it('guards origin, method, body and rate', async () => {
    const deps = { connect: script().connect, cache: null, limiter: new RateLimiter({ per_window: 1, per_day: 5 }) };
    expect((await tts(post('/api/tts', { text: 'x' }, { origin: 'https://evil.example' }), {}, deps, {})).status).toBe(403);
    expect((await tts(post('/api/tts', { text: 'x' }, { origin: 'https://evil.example' }), { ALLOWED_ORIGINS: 'https://evil.example' }, deps, {})).status).toBe(200);
    expect((await tts(post('/api/tts', { text: 'y' }), {}, deps, {})).status).toBe(429);
    expect((await tts(new Request('https://mathnim.pages.dev/api/tts'), {}, deps, {})).status).toBe(405);
    expect((await tts(post('/api/tts', 'x'.repeat(9000)), {}, deps, {})).status).toBe(413);
    expect((await tts(post('/api/tts', { text: 'x' }), { TTS: 'off' }, deps, {})).status).toBe(503);
  });
  it('reports a failing service as 502', async () => {
    const note: { error?: string } = {};
    const res = await tts(post('/api/tts', { text: 'x' }), {}, { connect: scripted([{ close: 1006 }]).connect, cache: null, limiter: null }, note);
    expect(res.status).toBe(502);
    expect(note.error).toMatch(/closed/);
  });
});
