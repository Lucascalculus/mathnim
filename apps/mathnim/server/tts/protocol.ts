// The websocket speech protocol spoken by Azure's text-to-speech service and
// by Edge's read-aloud front end to it: text frames are "Header:value" lines,
// a blank line and a body; binary frames carry a 2-byte header length, the
// headers, then audio. A turn ends with a "turn.end" text frame. Word
// boundaries arrive as "audio.metadata" frames (offsets in 100 ns ticks).
import { unescape_xml, r3 } from './text';

export type Word = [number, number, string];

/** An open websocket (Node's global WebSocket, or a Workers socket after accept()). */
export interface WsLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'message' | 'close' | 'error', fn: (e: { data?: unknown; code?: number; reason?: string; message?: string }) => void): void;
}
/** Opens a websocket with request headers (browsers cannot; Node and Workers can). */
export type Connect = (url: string, headers: Record<string, string>) => Promise<WsLike>;

export const uuid_hex = () => crypto.randomUUID().replace(/-/g, '');

/** A text frame: headers, blank line, body. */
export const text_frame = (headers: [string, string][], body: string) => `${headers.map(([k, v]) => `${k}:${v}`).join('\r\n')}\r\n\r\n${body}`;

export function parse_headers(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\r\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
export function parse_text_frame(s: string): { headers: Record<string, string>; body: string } {
  const i = s.indexOf('\r\n\r\n');
  return i < 0 ? { headers: parse_headers(s), body: '' } : { headers: parse_headers(s.slice(0, i)), body: s.slice(i + 4) };
}
export function parse_binary_frame(buf: Uint8Array): { headers: Record<string, string>; data: Uint8Array } {
  if (buf.length < 2) throw new Error('binary frame without header length');
  const n = (buf[0] << 8) | buf[1];
  if (n + 2 > buf.length) throw new Error('binary frame header longer than the frame');
  return { headers: parse_headers(new TextDecoder().decode(buf.subarray(2, 2 + n))), data: buf.subarray(2 + n) };
}

/** Word boundaries in an audio.metadata body -> [start s, end s, word]. Punctuation and sentence boundaries are skipped. */
export function parse_word_boundaries(body: string, offset_ticks = 0): Word[] {
  const out: Word[] = [];
  const items = (JSON.parse(body) as { Metadata?: { Type?: string; Data?: { Offset?: number; Duration?: number; text?: { Text?: string; BoundaryType?: string } } }[] }).Metadata ?? [];
  for (const m of items) {
    if (m.Type !== 'WordBoundary' || !m.Data) continue;
    const bt = m.Data.text?.BoundaryType;
    if (bt && bt !== 'WordBoundary') continue;
    const s = ((m.Data.Offset ?? 0) + offset_ticks) / 1e7;
    out.push([r3(s), r3(s + (m.Data.Duration ?? 0) / 1e7), unescape_xml(m.Data.text?.Text ?? '')]);
  }
  return out;
}

/** JavaScript-style UTC date, as Edge sends it in X-Timestamp. */
export function js_date(d = new Date()): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

/** Binary message data as bytes: ArrayBuffer, a view, or a Blob (workerd's default binaryType). */
async function as_bytes(d: unknown): Promise<Uint8Array | null> {
  if (d instanceof ArrayBuffer) return new Uint8Array(d);
  if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  if (typeof Blob !== 'undefined' && d instanceof Blob) return new Uint8Array(await d.arrayBuffer());
  return null;
}

/** Open a socket, send the messages, collect audio and word boundaries until turn.end. */
export async function synthesize_ws(o: { connect: Connect; url: string; headers: Record<string, string>; messages: string[]; timeout_ms?: number }): Promise<{ audio: Uint8Array; words: Word[] }> {
  const ws = await o.connect(o.url, o.headers);
  // binary messages may need an async read (Blob): keep them in arrival order
  const chunks: Promise<Uint8Array | null>[] = [];
  const words: Word[] = [];
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close(1000);
      } catch {
        /* already closed */
      }
      if (err) return reject(err);
      Promise.all(chunks).then((all) => {
        const parts = all.filter((c): c is Uint8Array => !!c?.length);
        if (!parts.length) return reject(new Error('no audio received'));
        const audio = new Uint8Array(parts.reduce((n, c) => n + c.length, 0));
        let at = 0;
        for (const c of parts) {
          audio.set(c, at);
          at += c.length;
        }
        resolve({ audio, words });
      }, reject);
    };
    const timer = setTimeout(() => finish(new Error('speech service timed out')), o.timeout_ms ?? 20_000);
    ws.addEventListener('message', (e) => {
      try {
        if (typeof e.data === 'string') {
          const f = parse_text_frame(e.data);
          const path = f.headers.Path;
          if (path === 'audio.metadata') words.push(...parse_word_boundaries(f.body));
          else if (path === 'turn.end') finish();
          return;
        }
        chunks.push(
          as_bytes(e.data).then((bytes) => {
            if (!bytes) return null;
            const f = parse_binary_frame(bytes);
            return f.headers.Path === 'audio' ? f.data.slice() : null;
          }),
        );
      } catch (err) {
        finish(err as Error);
      }
    });
    ws.addEventListener('close', (e) => finish(new Error(`speech service closed the connection (${e.code ?? '?'} ${e.reason ?? ''})`.trim())));
    ws.addEventListener('error', (e) => finish(new Error(`speech service socket error${e.message ? `: ${e.message}` : ''}`)));
    for (const m of o.messages) ws.send(m);
  });
}
