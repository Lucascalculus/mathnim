// Test doubles: a scripted speech websocket, an in-memory KV, a log collector.
import type { KVLike, LogLine } from '../server/http';
import { set_log_sink } from '../server/http';
import type { Connect, WsLike } from '../server/tts/protocol';

export function text_msg(path: string, body = ''): string {
  return `X-RequestId:abc\r\nContent-Type:application/json; charset=utf-8\r\nPath:${path}\r\n\r\n${body}`;
}
export function audio_msg(bytes: number[]): ArrayBuffer {
  const head = new TextEncoder().encode('X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nX-StreamId:1\r\nPath:audio\r\n');
  const out = new Uint8Array(2 + head.length + bytes.length);
  out[0] = head.length >> 8;
  out[1] = head.length & 0xff;
  out.set(head, 2);
  out.set(bytes, 2 + head.length);
  return out.buffer;
}
export const word_msg = (text: string, offset: number, duration: number, type = 'WordBoundary') =>
  text_msg('audio.metadata', JSON.stringify({ Metadata: [{ Type: 'WordBoundary', Data: { Offset: offset, Duration: duration, text: { Text: text, Length: text.length, BoundaryType: type } } }] }));

/** A connect() whose socket answers any sent message with `script` (once all `expect_sends` arrived). */
export function scripted(script: (string | ArrayBuffer | Blob | { close: number })[], expect_sends = 2) {
  const calls: { url: string; headers: Record<string, string>; sent: string[] }[] = [];
  const connect: Connect = async (url, headers) => {
    const call = { url, headers, sent: [] as string[] };
    calls.push(call);
    const fns: Record<string, ((e: { data?: unknown; code?: number; reason?: string }) => void)[]> = {};
    const ws: WsLike = {
      send(data) {
        call.sent.push(data);
        if (call.sent.length === expect_sends)
          queueMicrotask(() => {
            for (const m of script) {
              if (typeof m === 'object' && 'close' in m) fns.close?.forEach((f) => f({ code: m.close, reason: 'bye' }));
              else fns.message?.forEach((f) => f({ data: m }));
            }
          });
      },
      close() {},
      addEventListener(type, fn) {
        (fns[type] ??= []).push(fn);
      },
    };
    return ws;
  };
  return { connect, calls };
}

export class MemoryKV implements KVLike {
  m = new Map<string, string>();
  async get(k: string) {
    return this.m.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.m.set(k, v);
  }
  async delete(k: string) {
    this.m.delete(k);
  }
  async list(o: { prefix?: string; limit?: number; cursor?: string } = {}) {
    const keys = [...this.m.keys()].filter((k) => k.startsWith(o.prefix ?? '')).sort();
    const start = Number(o.cursor ?? 0), end = start + (o.limit ?? 1000);
    return { keys: keys.slice(start, end).map((name) => ({ name })), list_complete: end >= keys.length, cursor: end < keys.length ? String(end) : undefined };
  }
}

export function capture_logs(): LogLine[] {
  const lines: LogLine[] = [];
  set_log_sink((l) => lines.push(l));
  return lines;
}

export const SITE = 'https://mathnim.pages.dev';
export const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}${path}`, {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
