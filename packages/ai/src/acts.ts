// The tutor acting in the figure on the learner's screen (docs/design/ENGINE.md §10), on the model's side: the
// figure's manifest (what is on screen, what the learner can move) goes into the prompt, the model may end its answer
// with a few ACT lines, and they are parsed out of the text and checked against the manifest here. The figure checks
// them again against itself before it moves (packages/engine/src/kernel/acts.ts): the tutor can only do what the learner can.
// (The types are the engine's, written out: this module also runs on the server, which does not load the engine.)

export type FigureAct =
  | { op: 'point'; id: string }
  | { op: 'set'; param: string; to: number }
  | { op: 'note'; id: string; text: string }
  | { op: 'reset' };
export interface FigureManifest {
  things: { id: string; kind: string; says?: string; text?: string }[];
  params: { name: string; value: number; range?: [number, number]; step?: number; doc?: string }[];
}
/** At most this many acts follow an answer (more is a show, not help). */
export const MAX_ACTS = 3;
const NOTE_MAX = 60;

/** The figure in the prompt: its things and what the learner can move. */
export function figure_block(m: FigureManifest): string {
  const things = m.things.slice(0, 60).map((t) => `- ${t.id} (${t.kind})${t.says ? `: ${t.says}` : ''}${t.text ? ` "${t.text}"` : ''}`);
  const params = m.params.map((p) => `- ${p.name} = ${p.value}${p.range ? ` (from ${p.range[0]} to ${p.range[1]})` : ''}${p.doc ? `: ${p.doc}` : ''}`);
  return [
    'FIGURE ON SCREEN (you can act in it, as the student can)',
    'Things (id: what it is):', ...things,
    params.length ? 'What the student can move (name = now):' : 'The student cannot move anything here.', ...params,
  ].join('\n');
}

export const ACT_RULES = `You may act in that figure, as the student could, when seeing it helps more than words: after the answer, on lines of their own, write at most ${MAX_ACTS} of
ACT: point <id>            (light up one thing while the student reads)
ACT: set <name> <number>   (move something the student can move, to show a case)
ACT: note <id> <2 to 6 words, in the answer's language>   (a short label on one thing)
ACT: reset                 (put back what you moved)
Use only the ids and names listed under FIGURE ON SCREEN. Never act to do an exercise for the student. In the answer itself, still name things by what they look like, never by id.`;

/** The tutor's user message with the figure and its act rules (none on a question the student has not answered yet). */
export function acts_prompt(ctx: { figure?: FigureManifest; unanswered?: boolean }): string {
  if (!ctx.figure || ctx.unanswered) return '';
  return `\n\n${figure_block(ctx.figure)}\n\n${ACT_RULES}`;
}

const ACT_LINE = /^\s*ACT\s*[:：]\s*(\S+)\s*(.*?)\s*$/i;
/** The acts at the end of a reply (in order), and the reply without them. */
export function parse_acts(reply: string): { text: string; acts: FigureAct[]; bad: string[] } {
  const acts: FigureAct[] = [], bad: string[] = [], keep: string[] = [];
  for (const line of reply.split('\n')) {
    const m = ACT_LINE.exec(line);
    if (!m) {
      keep.push(line);
      continue;
    }
    const op = m[1].toLowerCase(), rest = m[2].replace(/^[`"']|[`"']$/g, '');
    if (op === 'point' && rest) acts.push({ op, id: rest.split(/\s+/)[0] });
    else if (op === 'set') {
      const [name, num] = rest.split(/\s+/);
      const to = Number((num ?? '').replace('−', '-'));
      if (name && Number.isFinite(to)) acts.push({ op, param: name, to });
      else bad.push(line.trim());
    } else if (op === 'note') {
      const sp = rest.search(/\s/);
      if (sp > 0) acts.push({ op, id: rest.slice(0, sp), text: rest.slice(sp + 1).trim().replace(/^["“]|["”]$/g, '') });
      else bad.push(line.trim());
    } else if (op === 'reset') acts.push({ op });
    else bad.push(line.trim());
  }
  return { text: keep.join('\n').trimEnd(), acts, bad };
}

/** The acts the manifest allows (ids and names it lists, numbers in range, short notes, at most MAX_ACTS), and the rest with why. */
export function validate_acts(acts: FigureAct[], m: FigureManifest): { ok: FigureAct[]; rejected: { act: FigureAct; why: string }[] } {
  const ok: FigureAct[] = [], rejected: { act: FigureAct; why: string }[] = [];
  const ids = new Set(m.things.map((t) => t.id)), seen = new Set<string>();
  for (const a of acts) {
    const key = JSON.stringify(a);
    let why = '';
    if (seen.has(key)) why = 'a repeat';
    else if (ok.length >= MAX_ACTS) why = `more than ${MAX_ACTS} acts`;
    else if ((a.op === 'point' || a.op === 'note') && !ids.has(a.id)) why = `no thing '${a.id}' on screen`;
    else if (a.op === 'note' && (!a.text || a.text.length > NOTE_MAX)) why = `a note must be 1 to ${NOTE_MAX} characters`;
    else if (a.op === 'set') {
      const p = m.params.find((q) => q.name === a.param);
      if (!p) why = `'${a.param}' is not something the student can move`;
      else if (p.range) a.to = Math.max(p.range[0], Math.min(p.range[1], a.to));
    }
    seen.add(key);
    if (why) rejected.push({ act: a, why });
    else ok.push(a);
  }
  return { ok, rejected };
}

/** While the reply streams: hide its ACT lines, and a last line that may be the start of one. */
export function hide_acts(sofar: string): string {
  const lines = sofar.split('\n');
  const last = lines[lines.length - 1];
  if (/^\s*(A|AC|ACT|ACT\s*[:：].*)$/i.test(last)) lines.pop();
  return lines.filter((l) => !ACT_LINE.test(l)).join('\n');
}

/** What an act did, in a few words for the history under the answer (names as the figure says them). */
export function act_words(a: FigureAct, m: FigureManifest | undefined, lang: 'en' | 'zh'): string {
  const name = (id: string) => m?.things.find((t) => t.id === id)?.says ?? m?.params.find((p) => p.name === id)?.doc ?? id;
  const zh = lang === 'zh';
  switch (a.op) {
    case 'point': return zh ? `指出：${name(a.id)}` : `pointed at ${name(a.id)}`;
    case 'set': return zh ? `把 ${name(a.param)} 设为 ${+a.to.toFixed(3)}` : `set ${name(a.param)} to ${+a.to.toFixed(3)}`;
    case 'note': return zh ? `在“${name(a.id)}”上标注“${a.text}”` : `noted “${a.text}” on ${name(a.id)}`;
    case 'reset': return zh ? '放回原样' : 'put it back';
  }
}
