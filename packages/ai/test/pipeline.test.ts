import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { lint_timeline } from 'manim-web/ext/lint';
import { ask, parse_answer } from '../src/pipeline';
import { LocalBackend } from '../src/local_backend';
import type { Provider } from '../src/provider';
import { compile_answer, load_answer, run_checks } from '../src/run';
import type { Validator } from '../src/sandbox';
import { apply_white } from '../src/theme';

/** Same checks as the worker, in-process (node). */
const inline: Validator = async (code) => {
  try {
    const player = await load_answer(compile_answer(code), createCanvas(480, 270) as any, apply_white);
    return { ok: true, issues: lint_timeline(player), ms: 0 };
  } catch (e: any) {
    return { ok: false, error: e.message, issues: [], ms: 0 };
  }
};
const good = `class Answer extends Scene { construct() { const c = Circle({ radius: 1.5, color: C.accent }); this.play(Create(c)); this.wait(0.5); } }`;
const offscreen = `class Answer extends Scene { construct() { this.add(Square({ color: C.ink }).shift([9, 0, 0])); this.wait(0.2); } }`;
const broken = `class Answer extends Scene { construct() { this.play(Creat(Circle())); } }`;
const reply = (code: string, checks: any[] = []) => JSON.stringify({ title: 't', explanation: 'e', code, checks, followups: [] });

describe('ask pipeline', () => {
  it('parses fenced JSON', () => {
    expect(parse_answer('Here:\n```json\n{"title":"a","explanation":"b","code":"c"}\n```').title).toBe('a');
  });
  it('repairs until the scene runs, fits the frame and the numbers check out', async () => {
    const replies = ['not json at all', reply(broken), reply(offscreen), reply(good, [{ label: 'x', value: 3, expr: '1+1' }]), reply(good, [{ label: 'x', value: 2, expr: '1+1' }])];
    const seen: string[] = [];
    const provider: Provider = {
      name: 'fake',
      async complete(req) {
        seen.push(req.messages[req.messages.length - 1].content);
        return replies.shift()!;
      },
    };
    const r = await ask('draw a circle', { backend: new LocalBackend(provider), validate: inline, max_attempts: 5 });
    expect(r.verified).toBe(true);
    expect(r.attempts).toBe(5);
    expect(seen[1]).toMatch(/could not be parsed/);
    expect(seen[2]).toMatch(/Creat is not defined/);
    expect(seen[3]).toMatch(/off-frame|outside the frame/);
    expect(seen[4]).toMatch(/"x" is 3/);
  });
  it('re-computes numeric claims', () => {
    expect(run_checks([{ label: 'sqrt', value: 12, expr: 'Math.sqrt(144)' }])[0].ok).toBe(true);
    expect(run_checks([{ label: 'wrong claim', value: 1, expr: '2' }])[0].ok).toBe(false);
    expect(run_checks([{ label: 'not math', value: 1, expr: 'nope(' }])[0].ok).toBe(false);
  });
});
