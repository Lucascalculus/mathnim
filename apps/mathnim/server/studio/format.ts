// The lesson format a generated course is written in: Mathnim's own lesson
// data (packages/core schema.ts, content.ts) without the parts that need code
// (scenes, worlds, visuals) or project files (figures). It is told to the
// model (LESSON_FORMAT) and every reply is checked against it (check_lesson)
// before it is stored; the errors go back to the model for one repair.
import type { Block, CheckpointStep, Lesson, Step } from '@mathnim/core';

export const LESSON_FORMAT = `A lesson is ONE JSON object (no comments, no trailing commas):
{
  "title": string,                 // the lesson's own title
  "description": string,           // one line: what the learner will understand
  "minutes": number,               // honest reading-and-doing time, 10-60
  "skills": [{"id": string, "name": string}],   // the knowledge points taught; ids are given to you
  "misconceptions": [{"id": string, "description": string}],  // real mistakes learners make (optional)
  "steps": [Step, ...]             // 6-30 steps
}
Step is one of:
  {"kind": "read", "id": string, "chapter"?: string, "title": string, "blocks": [Block, ...]}
      A text page: one idea per page. "chapter" starts a new chapter (later steps inherit it).
  {"kind": "derive", "id": string, "chapter"?: string, "title": string, "intro"?: string,
   "lines": [{"tex": string, "say"?: string, "why"?: string}, ...], "outro"?: string}
      A derivation revealed line by line. "say" puts the step in words above the line (what it does,
      what its symbols mean); "why" gives a further reason, shown on request.
  {"kind": "checkpoint", "id": string, "chapter"?: string, "title": string, "skill": string,
   "purpose": "predict" | "practice" | "check", "prompt": string, "question": Question,
   "hints"?: [string, ...], "explain"?: string, "auto_advance"?: boolean}
      A question. "predict" comes BEFORE the idea is taught (not graded; a guess that makes the
      learner curious); "practice"/"check" come after. "skill" is one of the lesson's skill ids.
      "explain" is shown after answering: why the right answer is right.
Question is one of:
  {"type": "choice", "options": [{"id": string, "label": string, "correct"?: true,
     "feedback"?: string, "misconception"?: string}, ...]}      // 2-6 options, at least one correct;
     // a wrong option's feedback names the misconception behind it, in one or two sentences
  {"type": "number", "answer": number, "tolerance"?: number, "unit"?: string}
  {"type": "text", "rubric": {"key_points": [string, ...], "model_answer": string, "min_points"?: number}}
     // a free answer in the learner's words, marked against 1-5 key points
Block is one of:
  {"type": "h", "text": string, "level"?: 2 | 3}
  {"type": "p", "text": string}
  {"type": "list", "items": [string, ...], "ordered"?: boolean}
  {"type": "math", "tex": string}                      // a displayed formula (TeX, no $ signs)
  {"type": "table", "head": [string, ...], "rows": [[string, ...], ...]}
  {"type": "code", "lang": string, "code": string, "caption"?: string}
  {"type": "callout", "kind": "note" | "warning" | "misconception" | "open", "title"?: string, "body": string}
  {"type": "details", "summary": string, "blocks": [Block, ...]}   // collapsed: details on demand
  {"type": "svg", "svg": string, "alt": string, "caption"?: string}
     // a diagram you draw: complete <svg viewBox="..."> markup, at most ~12 KB, light background,
     // dark strokes, font-family="sans-serif", text at least 14 units high; no scripts, no links,
     // no images, no foreignObject. Draw structures (packet headers, timelines, state machines,
     // topologies, trees) when a picture explains better than words.
Text in strings: inline TeX between $...$ (escape a literal dollar as \\$), **bold**, *italic*, \`code\`.
In JSON, every backslash in TeX is written twice ("$\\\\frac{a}{b}$").`;

export interface Checked {
  lesson: Lesson | null;
  errors: string[];
  /** The lesson's length in characters of JSON (to keep a reply within bounds). */
  size: number;
}

const ID = /^[a-z0-9][a-z0-9._-]{0,47}$/i;
const BLOCKS = new Set(['h', 'p', 'list', 'math', 'table', 'code', 'callout', 'details', 'svg']);
const CALLOUTS = new Set(['note', 'warning', 'misconception', 'open']);
const MAX_SVG = 24_000;
const MAX_LESSON = 400_000;

/** Pull the JSON object out of a model reply (code fences and stray prose around it are tolerated). */
export function json_of(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced && fenced[1].trim().startsWith('{') ? fenced[1] : text;
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the reply');
  return JSON.parse(raw.slice(start, end + 1));
}

/** Unescaped $ signs must pair up, or the page's formulas run into the text. */
function dollars_ok(s: string): boolean {
  const n = s.replace(/\\\$/g, '').split('$').length - 1;
  return n % 2 === 0;
}

/** Check a generated lesson against the format; `skills` limits which skill ids it may use. */
export function check_lesson(data: unknown, o: { id: string; skills?: string[] }): Checked {
  const errors: string[] = [];
  const size = JSON.stringify(data ?? null).length;
  const err = (where: string, what: string) => errors.length < 60 && errors.push(`${where}: ${what}`);
  const str = (v: unknown, where: string, required = true): v is string => {
    if (typeof v === 'string' && v.trim()) {
      if (!dollars_ok(v)) err(where, 'unpaired $ (inline TeX needs an opening and a closing $; write \\$ for a dollar sign)');
      return true;
    }
    if (required || v !== undefined) err(where, 'a non-empty string is required');
    return false;
  };
  const cell = (v: unknown, where: string) => {
    if (typeof v !== 'string') return err(where, 'a string');
    if (v.trim()) str(v, where);
  };
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(data)) return { lesson: null, errors: ['the reply is not a JSON object'], size };
  if (size > MAX_LESSON) err('lesson', `too long (${size} characters of JSON; at most ${MAX_LESSON})`);
  const d = data;
  str(d.title, 'title');
  str(d.description, 'description');
  if (typeof d.minutes !== 'number' || d.minutes < 3 || d.minutes > 120) err('minutes', 'a number between 3 and 120');
  const skills = Array.isArray(d.skills) ? (d.skills as unknown[]) : [];
  if (!skills.length) err('skills', 'at least one skill');
  const skill_ids = new Set<string>();
  skills.forEach((s, i) => {
    if (!obj(s) || typeof s.id !== 'string' || !ID.test(s.id)) return err(`skills[${i}]`, 'needs an id (letters, digits, . _ -)');
    if (o.skills && !o.skills.includes(s.id)) err(`skills[${i}]`, `unknown skill id '${s.id}' (use only: ${o.skills.join(', ')})`);
    skill_ids.add(s.id);
    str(s.name, `skills[${i}].name`);
  });
  const mis = Array.isArray(d.misconceptions) ? (d.misconceptions as unknown[]) : [];
  const mis_ids = new Set<string>();
  mis.forEach((m, i) => {
    if (!obj(m) || typeof m.id !== 'string' || !ID.test(m.id)) return err(`misconceptions[${i}]`, 'needs an id');
    mis_ids.add(m.id);
    str(m.description, `misconceptions[${i}].description`);
  });
  const steps = Array.isArray(d.steps) ? (d.steps as unknown[]) : [];
  if (steps.length < 3) err('steps', 'at least 3 steps');
  const step_ids = new Set<string>();

  const blocks = (bs: unknown, where: string, depth = 0) => {
    if (!Array.isArray(bs) || !bs.length) return err(where, 'a non-empty array of blocks');
    bs.forEach((b, i) => {
      const at = `${where}[${i}]`;
      if (!obj(b) || typeof b.type !== 'string' || !BLOCKS.has(b.type)) return err(at, `unknown block type (one of ${[...BLOCKS].join(', ')})`);
      switch (b.type) {
        case 'h': case 'p': return void str(b.text, `${at}.text`);
        case 'list':
          if (!Array.isArray(b.items) || !b.items.length) return err(at, 'items: a non-empty array');
          return b.items.forEach((x, k) => str(x, `${at}.items[${k}]`));
        case 'math':
          if (typeof b.tex !== 'string' || !b.tex.trim()) return err(at, 'tex is required');
          if (/^\s*\$|\$\s*$/.test(b.tex)) err(at, 'a math block has no $ signs');
          return;
        case 'table':
          // (a cell may be empty: the corner of a table with row labels, a blank in a comparison)
          if (!Array.isArray(b.head) || !b.head.length) return err(at, 'head: a non-empty array');
          (b.head as unknown[]).forEach((x, k) => cell(x, `${at}.head[${k}]`));
          if (!Array.isArray(b.rows) || !b.rows.length) return err(at, 'rows: a non-empty array');
          return (b.rows as unknown[]).forEach((r, k) => {
            if (!Array.isArray(r) || r.length !== (b.head as unknown[]).length) return err(`${at}.rows[${k}]`, 'one cell per column');
            r.forEach((x, j) => cell(x, `${at}.rows[${k}][${j}]`));
          });
        case 'code':
          if (typeof b.code !== 'string' || !b.code.trim()) err(at, 'code is required');
          if (typeof b.lang !== 'string') b.lang = 'text';
          return void str(b.caption, `${at}.caption`, false);
        case 'callout':
          if (typeof b.kind !== 'string' || !CALLOUTS.has(b.kind)) err(at, `kind: one of ${[...CALLOUTS].join(', ')}`);
          str(b.title, `${at}.title`, false);
          return void str(b.body, `${at}.body`);
        case 'details':
          if (depth > 0) return err(at, 'details inside details');
          str(b.summary, `${at}.summary`);
          return blocks(b.blocks, `${at}.blocks`, depth + 1);
        case 'svg': {
          const svg = b.svg;
          if (typeof svg !== 'string' || !/^\s*<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return err(at, 'svg: complete <svg ...>...</svg> markup');
          if (svg.length > MAX_SVG) err(at, `svg too large (${svg.length} characters; at most ${MAX_SVG})`);
          if (/<script|<foreignObject|<image|\son[a-z]+\s*=|javascript:/i.test(svg)) err(at, 'svg must not contain scripts, event handlers, images or foreignObject');
          if (!/viewBox=/i.test(svg)) err(at, 'svg needs a viewBox');
          str(b.alt, `${at}.alt`);
          return void str(b.caption, `${at}.caption`, false);
        }
      }
    });
  };

  const question = (q: unknown, at: string) => {
    if (!obj(q)) return err(at, 'a question object is required');
    if (q.type === 'choice') {
      const opts = Array.isArray(q.options) ? (q.options as unknown[]) : [];
      if (opts.length < 2 || opts.length > 6) err(at, '2-6 options');
      const ids = new Set<string>();
      let correct = 0;
      opts.forEach((op, k) => {
        const w = `${at}.options[${k}]`;
        if (!obj(op)) return err(w, 'an option object');
        if (typeof op.id !== 'string' || !op.id.trim() || ids.has(op.id)) err(w, 'a unique id');
        ids.add(String(op.id));
        str(op.label, `${w}.label`);
        str(op.feedback, `${w}.feedback`, false);
        if (op.correct === true) correct++;
        else delete op.correct;
        // an unknown misconception is dropped rather than refused: the feedback still says it
        if (op.misconception !== undefined && (typeof op.misconception !== 'string' || !mis_ids.has(op.misconception))) delete op.misconception;
      });
      if (!correct) err(at, 'at least one option needs "correct": true');
    } else if (q.type === 'number') {
      if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) err(at, 'answer: a number');
      if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || q.tolerance < 0)) err(at, 'tolerance: a number >= 0');
      str(q.unit, `${at}.unit`, false);
    } else if (q.type === 'text') {
      const r = q.rubric;
      if (!obj(r)) return err(at, 'rubric is required');
      const kp = Array.isArray(r.key_points) ? (r.key_points as unknown[]) : [];
      if (!kp.length || kp.length > 6) err(`${at}.rubric`, 'key_points: 1-6 strings');
      kp.forEach((x, k) => str(x, `${at}.rubric.key_points[${k}]`));
      str(r.model_answer, `${at}.rubric.model_answer`);
      if (r.min_points !== undefined && (typeof r.min_points !== 'number' || r.min_points < 1 || r.min_points > kp.length)) delete r.min_points;
    } else err(at, 'type: choice, number or text');
  };

  steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!obj(s)) return err(at, 'a step object');
    if (typeof s.id !== 'string' || !ID.test(s.id)) err(at, 'id: letters, digits, . _ - (at most 48)');
    else if (step_ids.has(s.id)) err(at, `id '${s.id}' is used twice`);
    step_ids.add(String(s.id));
    str(s.title, `${at}.title`);
    str(s.chapter, `${at}.chapter`, false);
    if (s.kind === 'read') blocks(s.blocks, `${at}.blocks`);
    else if (s.kind === 'derive') {
      str(s.intro, `${at}.intro`, false);
      str(s.outro, `${at}.outro`, false);
      const lines = Array.isArray(s.lines) ? (s.lines as unknown[]) : [];
      if (lines.length < 2) err(at, 'lines: at least 2');
      lines.forEach((l, k) => {
        if (!obj(l) || typeof l.tex !== 'string' || !l.tex.trim()) return err(`${at}.lines[${k}]`, 'tex is required');
        str(l.say, `${at}.lines[${k}].say`, false);
        str(l.why, `${at}.lines[${k}].why`, false);
      });
      delete s.blank;
    } else if (s.kind === 'checkpoint') {
      if (typeof s.skill !== 'string' || !skill_ids.has(s.skill)) err(at, `skill: one of the lesson's skill ids (${[...skill_ids].join(', ')})`);
      if (!['predict', 'practice', 'check'].includes(String(s.purpose))) err(at, 'purpose: predict, practice or check');
      str(s.prompt, `${at}.prompt`);
      str(s.explain, `${at}.explain`, false);
      if (s.hints !== undefined) {
        if (!Array.isArray(s.hints)) err(at, 'hints: an array of strings');
        else s.hints.forEach((h, k) => str(h, `${at}.hints[${k}]`));
      }
      if (s.auto_advance !== undefined && typeof s.auto_advance !== 'boolean') delete s.auto_advance;
      question(s.question, `${at}.question`);
    } else err(at, 'kind: read, derive or checkpoint');
  });
  if (errors.length) return { lesson: null, errors, size };
  const lesson = { ...(d as unknown as Lesson), id: o.id, mode: 'essay' as const };
  return { lesson, errors, size };
}

/** A lesson's text for a reviewer (and the coverage check): pages, derivations and questions in order. */
export function lesson_digest(l: Lesson): string {
  const out: string[] = [`# ${l.title}`, String(l.description ?? '')];
  const blocks = (bs: Block[], pad = '') => {
    for (const b of bs) {
      switch (b.type) {
        case 'h': out.push(`${pad}## ${b.text}`); break;
        case 'p': out.push(pad + b.text); break;
        case 'list': out.push(b.items.map((x) => `${pad}- ${x}`).join('\n')); break;
        case 'math': out.push(`${pad}$$${b.tex}$$`); break;
        case 'table': out.push([b.head, ...b.rows].map((r) => pad + r.join(' | ')).join('\n')); break;
        case 'code': out.push(`${pad}[code ${b.lang}]\n${b.code}`); break;
        case 'callout': out.push(`${pad}[${b.kind}] ${b.title ? `${b.title}: ` : ''}${b.body}`); break;
        case 'details': out.push(`${pad}[details: ${b.summary}]`); blocks(b.blocks, pad + '  '); break;
        case 'svg': out.push(`${pad}[diagram: ${b.alt}]${b.caption ? ` ${b.caption}` : ''}`); break;
        default: break;
      }
    }
  };
  for (const s of l.steps as Step[]) {
    out.push(`\n### [${s.id}] ${s.kind}${s.chapter ? ` · chapter: ${s.chapter}` : ''} · ${s.title ?? ''}`);
    if (s.kind === 'read') blocks(s.blocks);
    else if (s.kind === 'derive') {
      if (s.intro) out.push(String(s.intro));
      s.lines.forEach((x, i) => out.push(`(${i + 1}) ${x.say ? `${x.say} ` : ''}$$${x.tex}$$${x.why ? ` - ${x.why}` : ''}`));
      if (s.outro) out.push(String(s.outro));
    } else if (s.kind === 'checkpoint') {
      const c = s as CheckpointStep;
      out.push(`(${c.purpose}, skill ${c.skill}) ${c.prompt}`);
      const q = c.question;
      if (q.type === 'choice') for (const op of q.options) out.push(`  ${op.correct ? '[x]' : '[ ]'} ${op.label}${op.feedback ? ` -> ${op.feedback}` : ''}`);
      else if (q.type === 'number') out.push(`  answer: ${q.answer}${q.unit ? ` ${q.unit}` : ''}`);
      else if (q.type === 'text') out.push(`  key points: ${q.rubric.key_points.join(' / ')}\n  model answer: ${q.rubric.model_answer}`);
      if (c.explain) out.push(`  explain: ${c.explain}`);
    }
  }
  return out.join('\n');
}
