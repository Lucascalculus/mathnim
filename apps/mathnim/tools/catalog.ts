// Write docs/CAPABILITIES.md: what the libraries offer a lesson author (step
// kinds and their fields, text-page blocks, every visual with its parameters
// and the lessons that use it, the manim-web extensions, the lesson view, the
// AI pieces and the authoring commands). Everything is read from the code, so
// the catalog cannot drift from it.
//   node tools/catalog.mjs          write the file
//   node tools/catalog.mjs --check  fail if the file is not up to date
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { list_visuals } from '@mathnim/visuals';
import { describe_param } from '../../../packages/visuals/src/params';
import '@mathnim/visuals/linalg';
import '@mathnim/visuals/mpc';
import '@mathnim/visuals/econ';
import '../../../packages/visuals/src/ft/a/index';
import '../../../packages/visuals/src/ft/b/index';
import '../../../packages/visuals/src/ft/c/index';
import '../../../packages/visuals/src/ft/d/index';
import '../../../packages/visuals/src/ft/e/index';
import '../../../packages/visuals/src/ft/f/index';

const root = path.resolve(process.env.MATHNIM_PUBLIC!, '../../..');
const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
const read = (p: string) => fs.readFileSync(p, 'utf8');
const files = (dir: string, re = /\.ts$/): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' || d.name.startsWith('__') ? [] : files(p, re);
    return re.test(d.name) && !/\.(test|generated)\.ts$/.test(d.name) ? [p] : [];
  });
const one_line = (s: string) => s.replace(/\s+/g, ' ').trim();
const cell = (s: string) => one_line(s).replace(/\|/g, '\\|');
/** The comment a file starts with (its "what this is"), as one paragraph. */
function header(p: string): string {
  const lines: string[] = [];
  for (const l of read(p).split('\n')) {
    const m = /^\s*\/\/ ?(.*)$/.exec(l);
    if (!m) break;
    lines.push(m[1]);
  }
  // the first paragraph only; usage lines (indented commands) are left out
  const para: string[] = [];
  for (const l of lines) {
    if (!l.trim() || /^\s{2,}\S/.test(l)) break;
    para.push(l);
  }
  return one_line(para.join(' '));
}
const exported = (p: string) => [...read(p).matchAll(/^export (?:async )?(?:class|function|const|interface|type|enum) (\w+)/gm)].map((m) => m[1]);

// ---------------------------------------------------------------- types (step kinds, content blocks)
const SCHEMA = path.join(root, 'packages/core/src/schema.ts');
const CONTENT = path.join(root, 'packages/core/src/content.ts');
// (parsed with parent links, so a node's text can be read)
const sources = [SCHEMA, CONTENT].map((f) => ts.createSourceFile(f, read(f), ts.ScriptTarget.ES2022, true));
interface Field {
  name: string;
  type: string;
  optional: boolean;
  doc: string;
}
function decl(name: string): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined {
  for (const sf of sources) {
    for (const s of sf.statements) if ((ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) && s.name.text === name) return s;
  }
  return undefined;
}
const jsdoc = (n: ts.Node) => one_line(ts.getJSDocCommentsAndTags(n).map((d) => (ts.isJSDoc(d) ? ts.getTextOfJSDocComment(d.comment) ?? '' : '')).join(' '));
function fields(name: string): Field[] {
  const d = decl(name);
  if (!d) return [];
  const members = ts.isInterfaceDeclaration(d) ? d.members : ts.isTypeLiteralNode(d.type) ? d.type.members : ts.factory.createNodeArray<ts.TypeElement>();
  const own = members.filter(ts.isPropertySignature).map((m) => ({
    name: m.name.getText(),
    type: m.type ? one_line(m.type.getText()).slice(0, 90) : '',
    optional: !!m.questionToken,
    doc: jsdoc(m),
  }));
  return own;
}
const doc_of = (name: string) => (decl(name) ? jsdoc(decl(name)!) : '');
const field_table = (fs_: Field[]) =>
  fs_.length ? ['| field | type | what it is |', '|---|---|---|', ...fs_.map((f) => `| \`${f.name}${f.optional ? '?' : ''}\` | \`${cell(f.type)}\` | ${cell(f.doc)} |`)].join('\n') : '_(no own fields)_';

const STEPS: [string, string, string][] = [
  ['ReadStep', 'read', 'A text page: prose, formulas, figures, small embedded visuals, callouts, tables, sources. Read silently (no narration).'],
  ['DeriveStep', 'derive', 'A derivation revealed line by line, each line with an optional "why"; may hold one blank the learner fills in.'],
  ['CodeStep', 'code', 'A code walkthrough: the code with notes on line ranges (and shapes); copy button.'],
  ['SceneStep', 'scene', 'A "video": an animated scene with narration (the only steps that are narrated).'],
  ['ExploreStep', 'explore', 'A world: the learner moves handles/sliders/scrubs to reach goals; detectors give specific lines. Use only when the action is the concept (INTERACTION-BAR).'],
  ['CheckpointStep', 'checkpoint', 'A question (choice, number, expression, text, sketch, point...). Choices answer on one click. Can belong to a case (group) and auto-advance.'],
];

// ---------------------------------------------------------------- visuals
const lesson_files = files(path.join(root, 'apps/mathnim/src/lessons'));
const lesson_src = new Map(lesson_files.map((f) => [f, read(f)]));
const used_in = (needle: RegExp) => [...lesson_src].filter(([, s]) => needle.test(s)).map(([f]) => rel(f).replace('apps/mathnim/src/lessons/', ''));
const pack_of = (name: string) => {
  for (const f of files(path.join(root, 'packages/visuals/src'))) if (new RegExp(`name:\\s*['"]${name}['"]`).test(read(f))) return rel(f).replace('packages/visuals/src/', '').split('/').slice(0, -1).join('/') || '(core)';
  return '?';
};

// ---------------------------------------------------------------- write
const out: string[] = [];
const h = (s: string) => out.push('', s, '');
out.push(
  '# Capabilities',
  '',
  'What the Mathnim libraries offer a lesson author. **Generated from the code** by `apps/mathnim/tools/catalog.ts`:',
  'run `npm run catalog` after adding a step field, a visual or a module (and `npm run catalog -- --check` to see whether it is current).',
  'Read it to know what exists; read the source (paths given) for details, and `docs/COURSE-PLAYBOOK.md` / `docs/TASTE.md` for when to use what.',
);

h('## Step kinds');
out.push('A lesson (`Lesson` in `packages/core/src/schema.ts`) is a list of steps. Fields every step has (`StepBase`):', '', field_table(fields('StepBase')));
for (const [type, kind, when] of STEPS) {
  h(`### \`${kind}\` (${type})`);
  out.push(when);
  const own = [...fields(type), ...(type === 'ReadStep' ? fields('ReadContent') : type === 'DeriveStep' ? fields('DeriveContent') : type === 'CodeStep' ? fields('CodeContent') : [])].filter((f) => f.name !== 'kind');
  out.push('', field_table(own));
}
h('### Questions (checkpoint `question`)');
const q = decl('Question');
out.push(q ? `\`\`\`ts\n${q.getText().replace(/\/\*\*[\s\S]*?\*\/\s*/g, '').slice(0, 1600)}\n\`\`\`` : '_(see schema.ts)_');
for (const t of ['ChoiceOption', 'TextRubric', 'Misconception', 'CaseGroup', 'ScrubSpec']) {
  if (!decl(t)) continue;
  h(`#### ${t}`);
  if (doc_of(t)) out.push(doc_of(t), '');
  out.push(field_table(fields(t)));
}
h('### The lesson');
out.push(field_table(fields('Lesson')));

h('## Text-page blocks');
out.push('The `blocks` of a `read` step (`Block` in `packages/core/src/content.ts`):', '');
const block = decl('Block');
out.push(block ? `\`\`\`ts\n${block.getText().slice(0, 2400)}\n\`\`\`` : '_(see content.ts)_');

h('## Visuals');
const vs = list_visuals().sort((a, b) => pack_of(a.name).localeCompare(pack_of(b.name)) || a.name.localeCompare(b.name));
out.push(
  `${vs.length} parametric visuals (\`packages/visuals\`): each is a scene with checked parameters, used by lessons (scene steps, worlds, \`visual\` blocks, course covers) and chosen by the AI tutor for its answers. Packs load on demand (\`import('@mathnim/visuals/mpc')\`, \`.../ft/<part>\`, \`.../econ\` for a demo course through its entry's \`packs\`); the core pack (geometry, linear algebra) loads with the app. New visuals: \`packages/visuals/README.md\`; check them with \`npm run check -w @mathnim/visuals -- --only <names>\` and look at the contact sheets.`,
);
let pack = '';
for (const v of vs) {
  const p = pack_of(v.name);
  if (p !== pack) {
    pack = p;
    h(`### ${p}`);
  }
  const uses = used_in(new RegExp(`['"\`]${v.name}['"\`]`));
  out.push(`- **\`${v.name}\`**: ${one_line(v.summary)}`);
  const params = Object.entries(v.params);
  if (params.length) out.push(`  - params: ${params.map(([k, s]) => `\`${one_line(describe_param(k, s as any))}\``).join('; ')}`);
  if (v.topics.length) out.push(`  - topics: ${v.topics.join(', ')}`);
  out.push(`  - used in: ${uses.length ? uses.map((u) => `\`${u}\``).join(', ') : '_(not yet used by a lesson)_'}`);
}

h('## manim-web extensions (the interaction toolkit)');
out.push('`packages/manim-web/src/ext/`: the pieces worlds and visuals are built from. The guide with examples is `packages/manim-web/docs/EXTENSIONS.md`, and `packages/manim-web/dev/interact.demos.ts` runs them. Use one only when the action itself is the concept (`docs/lessons/llm-finetuning/INTERACTION-BAR.md`).', '');
const ext_dir = path.join(root, 'packages/manim-web/src/ext');
out.push('| module | what it is | main exports | an example of its use |', '|---|---|---|---|');
for (const d of fs.readdirSync(ext_dir).sort()) {
  const p = fs.statSync(path.join(ext_dir, d)).isDirectory() ? path.join(ext_dir, d, 'index.ts') : path.join(ext_dir, d);
  if (!fs.existsSync(p) || !p.endsWith('.ts')) continue;
  const mod = d.replace(/\.ts$/, '');
  // an example of its use: a lesson, else a visual built with it
  const re = new RegExp(`manim-web/ext/${mod}['"/]`);
  const ex = used_in(re)[0] ?? ['packages/visuals/src', 'packages/core/src', 'packages/present/src', 'packages/ai/src', 'packages/manim-web/dev'].flatMap((d) => files(path.join(root, d))).map((f) => (re.test(read(f)) ? rel(f).replace('packages/', '') : '')).find(Boolean);
  out.push(`| \`${mod}\` | ${cell(header(p)) || '—'} | ${cell(exported(p).slice(0, 8).join(', '))} | ${ex ? `\`${ex}\`` : '—'} |`);
}

const module_table = (dir: string, title: string, intro: string) => {
  h(title);
  out.push(intro, '', '| module | what it is |', '|---|---|');
  for (const p of files(dir).sort()) {
    const what = header(p);
    if (what) out.push(`| \`${rel(p)}\` | ${cell(what)} |`);
  }
};
module_table(path.join(root, 'packages/present/src'), '## The lesson view (`packages/present`)', 'How lessons are shown: the essay and game views, text pages, narration, cues and affordances.');
module_table(path.join(root, 'packages/ai/src'), '## AI (`packages/ai`)', 'The tutor that answers questions (text first, a ready-made visual when it explains better), lesson generation, providers.');

h('## Authoring commands');
out.push('| command | what it does |', '|---|---|');
for (const pkg of ['package.json', 'apps/mathnim/package.json', 'packages/visuals/package.json']) {
  const j = JSON.parse(read(path.join(root, pkg)));
  const ws = pkg === 'package.json' ? '' : ` -w ${j.name}`;
  for (const [name, cmd] of Object.entries<string>(j.scripts ?? {})) {
    const tool = /tools\/(\w+)\.(?:mjs|py)/.exec(cmd);
    const src = tool && [`${path.dirname(path.join(root, pkg))}/tools/${tool[1]}.ts`, `${path.dirname(path.join(root, pkg))}/tools/${tool[1]}.mjs`, `${path.dirname(path.join(root, pkg))}/tools/${tool[1]}.py`].find((f) => fs.existsSync(f));
    const what = src ? header(src) : '';
    out.push(`| \`npm run ${name}${ws}\` | ${cell(what || cmd)} |`);
  }
}
out.push(
  '',
  'Also, without an npm script: `node apps/mathnim/tools/lesson_text.mjs <lesson-id> [zh|en]` (a lesson as the student reads it) and `node apps/mathnim/tools/page_shots.mjs` (drive the running site headlessly and screenshot it; see its header).',
);

const text = out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
const target = path.join(root, 'docs/CAPABILITIES.md');
if (process.argv.includes('--check')) {
  const now = fs.existsSync(target) ? read(target) : '';
  if (now !== text) {
    console.error('docs/CAPABILITIES.md is out of date: run `npm run catalog`');
    process.exit(1);
  }
  console.log('docs/CAPABILITIES.md is up to date');
} else {
  fs.writeFileSync(target, text);
  console.log(`wrote docs/CAPABILITIES.md (${vs.length} visuals)`);
}
