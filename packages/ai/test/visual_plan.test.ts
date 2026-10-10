import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { get_visual, list_visuals } from '@mathnim/visuals';
import { OpenAICompatibleProvider, type CompletionRequest, type Provider } from '../src/provider';
import { answer_language, catalog_text, check_visual_plan, decide, load_visual, offer, parse_visual_plan, plan_repair_message, plan_system, plan_user, plan_visual, type PlanResult } from '../src/visual_plan';

const plan = (o: Record<string, unknown>) => JSON.stringify({ visual: 'circle_slices', params: {}, caption: 'Watch the slices.', followups: ['a?', 'b?'], ...o });

/** A provider that replies from a list and records the requests. */
function scripted(replies: string[]): Provider & { seen: CompletionRequest[] } {
  const seen: CompletionRequest[] = [];
  return {
    name: 'fake',
    seen,
    async complete(req) {
      seen.push(JSON.parse(JSON.stringify({ ...req, on_usage: undefined })));
      const r = replies.shift();
      if (r === undefined) throw new Error('no more replies');
      return r;
    },
  };
}

describe('parse_visual_plan', () => {
  it('reads plain and fenced JSON', () => {
    expect(parse_visual_plan(plan({ params: { n: 12 } }))).toMatchObject({ visual: 'circle_slices', params: { n: 12 }, caption: 'Watch the slices.', followups: ['a?', 'b?'] });
    expect(parse_visual_plan('Sure:\n```json\n{"visual":"eigen_hunt","params":{"A":[[2,1],[1,2]]}}\n```').visual).toBe('eigen_hunt');
  });
  it('treats a missing, empty or null visual as no ready-made visual (a custom picture)', () => {
    expect(parse_visual_plan('{"params":{}}')).toMatchObject({ visual: null });
    expect(parse_visual_plan('{"visual":"null"}').none).toBeUndefined();
    expect(parse_visual_plan('{"visual":null,"caption":""}').visual).toBeNull();
  });
  it('reads "none" as no picture at all', () => {
    expect(parse_visual_plan('{"visual":"None","followups":["x"]}')).toMatchObject({ visual: null, none: true, followups: ['x'] });
    expect(parse_visual_plan('{"visual":"none"}').none).toBe(true);
  });
  it('normalises the check question and the follow-ups', () => {
    expect(parse_visual_plan(plan({ check: 'What is the height?' })).check).toEqual({ question: 'What is the height?' });
    expect(parse_visual_plan(plan({ check: { q: 'Height?', a: 'r' } })).check).toEqual({ question: 'Height?', answer: 'r' });
    expect(parse_visual_plan(plan({ check: {} })).check).toBeUndefined();
    expect(parse_visual_plan(plan({ followups: [' x ', 3, '', 'y', 'z', 'w'] })).followups).toEqual(['x', 'y', 'z']);
  });
  it('rejects replies it cannot use', () => {
    expect(() => parse_visual_plan('')).toThrow(/empty/);
    expect(() => parse_visual_plan('I would pick circle_slices.')).toThrow(/no JSON/);
    expect(() => parse_visual_plan('{"visual": circle}')).toThrow(/could not be parsed/);
    expect(() => parse_visual_plan('{"visual": 3}')).toThrow(/"visual"/);
    expect(() => parse_visual_plan('{"visual": "circle_slices", "params": [1, 2]}')).toThrow(/"params"/);
  });
});

describe('check_visual_plan', () => {
  it('clamps numbers and fills defaults through check_params', () => {
    const c = check_visual_plan(parse_visual_plan(plan({ params: { n: 500 } })));
    expect(c.visual?.name).toBe('circle_slices');
    expect(c.errors).toEqual([]);
    expect(c.params.n).toBe(60);
    expect(c.params.r).toBe(get_visual('circle_slices')!.params.r.default);
    expect(c.notes.join(' ')).toMatch(/outside/);
  });
  it('reports unknown visuals and parameters, and wrong shapes', () => {
    expect(check_visual_plan(parse_visual_plan(plan({ visual: 'pizza_cutter' }))).errors[0]).toMatch(/no visual "pizza_cutter"/);
    expect(check_visual_plan(parse_visual_plan(plan({ params: { radius: 2 } }))).errors[0]).toMatch(/radius: circle_slices has no such parameter/);
    const m = check_visual_plan(parse_visual_plan(JSON.stringify({ visual: 'eigen_hunt', params: { A: [2, 1, 1, 2] } })));
    expect(m.visual?.name).toBe('eigen_hunt');
    expect(m.errors[0]).toMatch(/2x2 matrix/);
  });
  it('accepts no visual without errors', () => {
    expect(check_visual_plan(parse_visual_plan('{"visual": null}'))).toEqual({ visual: null, params: {}, notes: [], errors: [] });
  });
});

describe('prompts', () => {
  it('builds the repair message from the problems and the offered names', () => {
    const m = plan_repair_message(['there is no visual "x" in the CATALOG', 'A: expected a 2x2 matrix'], ['circle_slices', 'eigen_hunt']);
    expect(m).toContain('- there is no visual "x"');
    expect(m).toContain('- A: expected a 2x2 matrix');
    expect(m).toContain('circle_slices, eigen_hunt (or "none" for no picture, or null)');
  });
  it('puts the catalog in the system prompt and the context in the user message', () => {
    const s = plan_system(list_visuals());
    expect(s).toContain('JSON');
    for (const v of list_visuals()) expect(s).toContain(`${v.name} - `);
    const u = plan_user('why λ = 3?', { level: 'university', step: 'Find both (explore)', on_screen: 'x'.repeat(5000) }, 'thinks eigenvectors are the columns');
    expect(u).toContain('Level: university');
    expect(u).toContain('What the student most likely needs: thinks eigenvectors are the columns');
    expect(u).toContain('QUESTION: why λ = 3?');
    expect(u.length).toBeLessThan(2200); // the screen description is capped
  });
  it('names the language to write in', () => {
    expect(answer_language('Why is the rectangle r tall?')).toBe('English');
    expect(answer_language('为什么特征值是 det(A-λI)=0 的根?')).toBe('Chinese');
    expect(answer_language('¿Por qué el área es πr²?')).toBe('the language of the QUESTION');
    expect(answer_language('why?', { language: 'German' })).toBe('German');
    expect(plan_user('Why is the rectangle r tall?', {})).toContain('in English. Reply with the JSON object.');
  });
  it('offers the whole registry while it fits, else the most relevant visuals', () => {
    const all = list_visuals();
    expect(offer('anything', {}, { max_chars: 1e6 })).toEqual(all);
    const budget = catalog_text(all.filter((v) => v.name === 'eigen_hunt' || v.name === 'lambda_sweep')).length + 2;
    const some = offer('How do I find the eigenvectors of this matrix?', { lesson: 'Eigenvalues and eigenvectors' }, { max_chars: budget }).map((v) => v.name);
    expect(some.length).toBeGreaterThan(0);
    expect(some).not.toContain('circle_slices');
    expect(some.every((n) => /eigen|lambda|matrix|rotation|symmetric/.test(n))).toBe(true);
    expect(offer('Why is the area of a pizza πr²?', { topics: ['circles'] }, { max_chars: catalog_text([get_visual('circle_slices')!]).length + 1 }).map((v) => v.name)).toEqual(['circle_slices']);
  });
});

describe('plan_visual', () => {
  it('asks once in JSON mode with thinking off when the plan is good', async () => {
    const p = scripted([plan({ params: { n: 16 } })]);
    const r = await plan_visual('Why is it πr²?', { provider: p, context: { level: 'grades 7-9' } });
    expect(r.visual?.name).toBe('circle_slices');
    expect(r.params.n).toBe(16);
    expect(r.repaired).toBe(false);
    expect(r.calls).toHaveLength(1);
    expect(p.seen[0]).toMatchObject({ json: true, reasoning: 'off' });
    expect(p.seen[0].system).toContain('CATALOG');
  });
  it('repairs an unknown visual once, telling the model what was wrong', async () => {
    const p = scripted([plan({ visual: 'eigenvector_search' }), JSON.stringify({ visual: 'eigen_hunt', params: { A: [[2, 1], [1, 2]] }, caption: 'Drag v.' })]);
    const r = await plan_visual('Where are the eigenvectors?', { provider: p });
    expect(r.repaired).toBe(true);
    expect(r.visual?.name).toBe('eigen_hunt');
    expect(r.params.A).toEqual([[2, 1], [1, 2]]);
    const last = p.seen[1].messages;
    expect(last).toHaveLength(3);
    expect(last[1].role).toBe('assistant');
    expect(last[2].content).toMatch(/no visual "eigenvector_search"/);
  });
  it('gives up after one repair (and the caller falls back)', async () => {
    const p = scripted(['not json', 'still not json']);
    const r = await plan_visual('?', { provider: p });
    expect(r.calls).toHaveLength(2);
    expect(r.plan).toBeNull();
    expect(decide(r)).toMatchObject({ kind: 'freeform', reason: 'invalid' });
  });
  it('does not repair "no visual"', async () => {
    const p = scripted(['{"visual": null, "params": {}, "caption": "", "followups": ["x"]}']);
    const r = await plan_visual('Who won the 1998 world cup?', { provider: p });
    expect(r.calls).toHaveLength(1);
    expect(decide(r)).toEqual({ kind: 'freeform', reason: 'no_visual' });
  });
  it('does not repair "none": the answer has no picture', async () => {
    const p = scripted(['{"visual": "none", "params": {}, "caption": "", "followups": ["x"]}']);
    const r = await plan_visual('What does low-rank mean?', { provider: p });
    expect(r.calls).toHaveLength(1);
    expect(r.errors).toEqual([]);
    expect(decide(r)).toEqual({ kind: 'none' });
  });
  it('keeps a known visual with defaulted parameters when there is no time to repair', async () => {
    const p = scripted([JSON.stringify({ visual: 'eigen_hunt', params: { A: 'two by two' } })]);
    const r = await plan_visual('?', { provider: p, repair_budget_ms: 0 });
    expect(r.calls).toHaveLength(1);
    expect(r.errors[0]).toMatch(/matrix/);
    expect(decide(r)).toMatchObject({ kind: 'visual' });
  });
  it('keeps the first visual when the repair loses it', async () => {
    const p = scripted([JSON.stringify({ visual: 'eigen_hunt', params: { B: 1 } }), plan({ visual: 'nope' })]);
    const r = await plan_visual('?', { provider: p });
    expect(r.repaired).toBe(true);
    expect(r.visual?.name).toBe('eigen_hunt');
  });
  it('times out a slow call', async () => {
    const slow: Provider = { name: 'slow', complete: (_req, signal) => new Promise((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted')))) };
    await expect(plan_visual('?', { provider: slow, timeout_ms: 20 })).rejects.toThrow(/longer than/);
  });
});

describe('decide', () => {
  const base: PlanResult = { plan: null, visual: null, params: {}, notes: [], errors: [], repaired: false, calls: [], offered: [], ms: 0 };
  it('follows the fallback ladder', () => {
    const v = get_visual('circle_slices')!;
    expect(decide({ ...base, plan: parse_visual_plan(plan({})), visual: v, params: { n: 8 } })).toEqual({ kind: 'visual', visual: v, params: { n: 8 } });
    expect(decide({ ...base, plan: parse_visual_plan('{"visual":null}') })).toEqual({ kind: 'freeform', reason: 'no_visual' });
    expect(decide({ ...base, plan: parse_visual_plan('{"visual":"none"}') })).toEqual({ kind: 'none' });
    expect(decide({ ...base, plan: parse_visual_plan(plan({ visual: 'nope' })), errors: ['there is no visual "nope"'] })).toMatchObject({ kind: 'freeform', reason: 'invalid', detail: 'there is no visual "nope"' });
    expect(decide(null, new Error('deepseek API 503'))).toEqual({ kind: 'freeform', reason: 'failed', detail: 'deepseek API 503' });
  });
});

describe('OpenAI-compatible request options', () => {
  afterEach(() => vi.unstubAllGlobals());
  const req = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }] };
  it('maps json and reasoning onto DeepSeek fields', () => {
    const p = new OpenAICompatibleProvider({ base_url: '/api/deepseek', model: 'deepseek-flash' });
    expect(p.body(req, false)).not.toHaveProperty('thinking');
    expect(p.body({ ...req, json: true, reasoning: 'off' }, false)).toMatchObject({ response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    expect(p.body({ ...req, reasoning: 'low' }, false)).toMatchObject({ reasoning_effort: 'low' });
    expect(p.body({ ...req, on_usage: () => {} }, true)).toMatchObject({ stream_options: { include_usage: true } });
  });
  it('asks again without them when a server rejects them, and reports usage', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      bodies.push(b);
      if (b.thinking) return new Response('{"error":"unknown field thinking"}', { status: 422 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 9, completion_tokens: 3, prompt_cache_hit_tokens: 8, completion_tokens_details: { reasoning_tokens: 0 } } }));
    }));
    const p = new OpenAICompatibleProvider({ base_url: '/x', model: 'm' });
    let usage: any;
    expect(await p.complete({ ...req, reasoning: 'off', on_usage: (u) => (usage = u) })).toBe('{}');
    expect(usage).toEqual({ prompt_tokens: 9, completion_tokens: 3, reasoning_tokens: 0, cached_tokens: 8 });
    await p.complete({ ...req, reasoning: 'off' });
    expect(bodies.map((b) => !!b.thinking)).toEqual([true, false, false]);
  });
});

describe('load_visual', () => {
  it('builds a checked visual from the registry headlessly', async () => {
    const v = get_visual('circle_slices')!;
    const player = await load_visual(v, check_visual_plan(parse_visual_plan(plan({ params: { n: 8 } }))).params, createCanvas(480, 270) as any);
    expect(player.duration).toBeGreaterThan(5);
  }, 30000);
});
