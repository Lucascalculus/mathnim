// Print a lesson's learner-facing text in one language as Markdown, step by
// step, to review the writing as a student would read it.
//   node tools/lesson_text.mjs <lesson-id> [en|zh]
import { tr, type Block, type Lang, type Lesson, type Step } from '@mathnim/core';
import { all_lessons, load_all_lessons } from '../src/course';

// the fine-tuning lessons are loaded on demand in the app; the tools check them all
await load_all_lessons();

const [id, lang_arg] = process.argv.slice(2);
const lang: Lang = lang_arg === 'en' ? 'en' : 'zh';
const cl = all_lessons().find((l) => l.id === id);
if (!cl?.lesson) {
  console.error(`no authored lesson '${id}'. Lessons: ${all_lessons().filter((l) => l.lesson).map((l) => l.id).join(', ')}`);
  process.exit(1);
}
const L = (s: unknown): string => tr(s as never, lang);
const out: string[] = [];

function blocks(bs: Block[], depth = 0): void {
  const pad = '  '.repeat(depth);
  for (const b of bs) {
    switch (b.type) {
      case 'h': out.push(`${pad}${'#'.repeat((b.level ?? 2) + 2)} ${L(b.text)}`); break;
      case 'p': out.push(`${pad}${L(b.text)}`); break;
      case 'list': b.items.forEach((it, i) => out.push(`${pad}${b.ordered ? `${i + 1}.` : '-'} ${L(it)}`)); break;
      case 'math': out.push(`${pad}$$ ${b.tex} $$`); break;
      case 'code': out.push(`${pad}[code ${b.lang}${b.tabs ? ` +tabs ${b.tabs.map((t) => t.label).join('/')}` : ''}: ${b.code.split('\n').length} lines]${b.caption ? ' ' + L(b.caption) : ''}`); break;
      case 'figure': out.push(`${pad}[figure ${L(b.src)}] ${L(b.caption ?? b.alt)}`); break;
      case 'svg': out.push(`${pad}[drawing] ${L(b.caption ?? b.alt)}`); break;
      case 'visual': out.push(`${pad}[visual ${b.name}${b.explore ? ' (explore)' : ''}] ${L(b.caption)}`); break;
      case 'callout': out.push(`${pad}> **${b.kind}${b.title ? ': ' + L(b.title) : ''}** ${L(b.body)}`); break;
      case 'details': out.push(`${pad}<details> ${L(b.summary)}`); blocks(b.blocks, depth + 1); break;
      case 'table': out.push(`${pad}| ${b.head.map(L).join(' | ')} |`); for (const r of b.rows) out.push(`${pad}| ${r.map(L).join(' | ')} |`); break;
      case 'cite': out.push(`${pad}[^${b.key}]: ${L(b.text)}`); break;
    }
  }
}

function step(s: Step, i: number): void {
  const any = s as any;
  out.push(`\n## ${i + 1}. [${s.kind}] ${L(any.title) || s.id}`);
  if (any.narration) out.push(`🔊 ${L(any.narration)}`);
  switch (s.kind) {
    case 'read': blocks(s.blocks); break;
    case 'derive':
      if (s.intro) out.push(L(s.intro));
      s.lines.forEach((l, j) => out.push(`${j === s.blank?.line ? '▢ ' : ''}$$ ${l.tex} $$${l.why ? '  — ' + L(l.why) : ''}`));
      if (s.blank?.prompt) out.push(`(blank) ${L(s.blank.prompt)}`);
      if (s.outro) out.push(L(s.outro));
      break;
    case 'code':
      if (s.intro) out.push(L(s.intro));
      out.push(`[code ${s.lang}: ${s.code.split('\n').length} lines]`);
      for (const n of s.notes) out.push(`- L${n.lines[0]}-${n.lines[1]}: ${L(n.text)}${n.shapes ? ` (${n.shapes})` : ''}`);
      break;
    case 'checkpoint': {
      if (any.group) out.push(`[case ${L(any.group.title)}]`);
      out.push(`Q: ${L(any.prompt)}`);
      const q = any.question;
      if (q?.type === 'choice') q.options.forEach((o: any, j: number) => out.push(`  ${o.correct ? '✓' : ' '} ${j + 1}. ${L(o.label ?? o.text)}${o.feedback ? '  → ' + L(o.feedback) : ''}`));
      else if (q?.type === 'text') q.rubric.key_points.forEach((k: unknown) => out.push(`  • ${L(k)}`));
      else if (q) out.push(`  (${q.type})`);
      if (any.explain) out.push(`  explain: ${L(any.explain)}`);
      break;
    }
    case 'explore':
      out.push(`prompt: ${L(s.prompt)}`);
      for (const g of s.goals ?? []) out.push(`  goal ${g.id}: ${L(g.message)}`);
      for (const l of s.lines ?? []) out.push(`  line (${typeof l.when === 'string' ? l.when : JSON.stringify(l.when)}): ${L(l.text)}`);
      for (const h of s.hints ?? []) out.push(`  hint: ${L(h)}`);
      break;
    case 'scene': break;
  }
}

const lesson: Lesson = cl.lesson;
out.push(`# ${L(cl.title)} (${lesson.id})\n${L(cl.summary)}`);
lesson.steps.forEach(step);
console.log(out.join('\n'));
