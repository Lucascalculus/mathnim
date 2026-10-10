// Converts the hands-on lab tutorials of the fine-tuning course into page modules:
//   docs/lessons/llm-finetuning/labs/Lx-*.md + labs/code/*  ->  src/labs/<slug>.ts + src/labs/index.ts
// npm run labs -w mathnim   (tools/labs_build.mjs bundles this file and calls main()).
//
// A tutorial has a title line "# Lx 中文标题 / Lx English title", a preamble
// (the status banner in both languages and links to the two sections), then
// "## 中文" and "## English" separated by "---". marked's lexer parses the
// Markdown and every token of a language section becomes one Block of the
// text-page contract (packages/core/src/content.ts):
//   ### / ####          -> h (level 2 / 3)
//   paragraph           -> p           (a paragraph of footnote definitions -> cite blocks)
//   - / 1. lists        -> list
//   | tables |          -> table
//   ``` fenced code     -> code
//   > quote             -> callout (note; the preamble's status banner -> a warning callout first in each language)
// Inline Markdown is written back in the prose syntax the reader supports
// (**bold**, *italic*, `code`, [text](url), [^key]). The one adjustment: the
// reader cannot put `code` inside **bold**, so a bold run that contains code
// is closed before the code and reopened after it (same words, the code just
// is not bold). Anything else the contract cannot hold stops the build with
// the file and the construct; nothing is dropped silently. Dropped on purpose:
// the preamble's "[中文](#中文) · [English](#english)" links (the page shows
// one language) and the "---" separators.
import { Lexer, type Token, type Tokens } from 'marked';
import type { Block, L10n, Lang } from '@mathnim/core';
import type { Bi, LabConfig, LabFile, LabMeta, LabModule } from '../src/labs/types';

// Setups shared by several labs. Nothing has been timed, so the notes give no prices or run times.
const RENTED_A100 = { en: 'Rented A100', zh: '租用 A100' };
const COLAB_T4 = { en: 'Free Colab T4', zh: 'Colab 免费 T4' };
const A100 = 'NVIDIA A100';
const T4 = 'NVIDIA T4 · 16 GB';
/** L2 and L3: LoRA on a 0.5B model, which a free T4 runs in fp16. */
const LORA_SETUPS: LabConfig[] = [
  { label: RENTED_A100, gpu: A100, note: { en: 'Rent by the hour; native bf16, faster full runs', zh: '按小时租用；原生 bf16，跑完整版更快' }, recommended: true },
  { label: COLAB_T4, gpu: T4, note: { en: 'Free; the script switches to fp16, the full lab runs', zh: '免费；脚本自动改用 fp16，能跑完整版' } },
];

/**
 * Card text for each lab: a summary and the recommended setups (the tutorials
 * have no such lines; these follow their "what this lab answers" and
 * "hardware" items).
 */
const META: Record<string, { summary: Bi; configs: LabConfig[]; configs_summary: L10n; minutes?: number }> = {
  L1: {
    summary: {
      en: 'Take a RAG pipeline apart: evaluate retrieval on its own first (BM25, dense, hybrid, reranked), then the end-to-end answers, and sort every error into a type.',
      zh: '把 RAG 管线拆开：先单独评检索（BM25、稠密、混合、重排），再评端到端回答，最后给每个错误归类。',
    },
    configs: [
      { label: { en: 'CPU / laptop', zh: 'CPU / 笔记本' }, gpu: { en: 'No GPU', zh: '不需要 GPU' }, note: { en: 'Enough for the main path: retrieval and its evaluation', zh: '主线够用：检索和检索评测' }, recommended: true },
      { label: { en: 'Colab T4 or rented A100', zh: 'Colab T4 或租用 A100' }, gpu: 'T4 / A100', note: { en: 'Only speeds up end-to-end answering and the optional fine-tune', zh: '只为端到端回答和选做的微调提速' } },
    ],
    configs_summary: { en: 'CPU is enough', zh: 'CPU 即可' },
  },
  L2: {
    summary: {
      en: 'Controlled LoRA SFT runs that change one thing at a time: the loss mask, the rank r and the learning rate, plus the missing end token that keeps a model from stopping.',
      zh: '用对照实验一次只改一处，检验 LoRA SFT 的损失掩码、秩 r 和学习率，再亲手造出结束符没设对、模型停不下来的 bug。',
    },
    configs: LORA_SETUPS,
    configs_summary: { en: 'A100 recommended · T4 works', zh: '推荐 A100 · 也可用 T4' },
  },
  L3: {
    summary: {
      en: 'Find likelihood displacement in a real model: the DPO loss falls while the chosen answer becomes less likely too. Vary β, the similarity of the pairs and an SFT term.',
      zh: '在真实模型上找出似然位移：DPO 的损失在降，被选回答的概率也在降。改变 β、偏好对的相似度，再加一项 SFT 损失。',
    },
    configs: LORA_SETUPS,
    configs_summary: { en: 'A100 recommended · T4 works', zh: '推荐 A100 · 也可用 T4' },
  },
  L4: {
    summary: {
      en: 'Write and test a strict grader for GSM8K, predict the zero-variance groups, compare loss types, group sizes and baselines, and check pass@k before and after training.',
      zh: '为 GSM8K 写一个严格的评分器并先测试它，预测零方差组，比较损失类型、组大小和基线，再看训练前后的 pass@k。',
    },
    configs: [
      { label: RENTED_A100, gpu: A100, note: { en: 'Rent by the hour; add --vllm, room for 1.5B', zh: '按小时租用；加 --vllm，可换 1.5B' }, recommended: true },
      { label: COLAB_T4, gpu: T4, note: { en: 'Only the small 0.5B default; slow generation', zh: '只够跑 0.5B 小配置；生成慢' } },
    ],
    configs_summary: { en: 'A100 recommended · T4 for the small setting', zh: '推荐 A100 · T4 只够小配置' },
  },
  L5: {
    summary: {
      en: "Distil a teacher's reasoning traces into a small model with rejection sampling and SFT, and set it next to L2 and L4's GRPO; optionally on-policy distillation (GKD).",
      zh: '用拒绝采样和 SFT 把老师的推理轨迹蒸馏给小模型，并和 L2、L4 的 GRPO 并排比较；选做在线蒸馏（GKD）。',
    },
    configs: [
      { label: RENTED_A100, gpu: A100, note: { en: 'Rent by the hour; teacher sampling (vLLM) and the student SFT', zh: '按小时租用；老师采样（vLLM）和学生 SFT 都能跑' }, recommended: true },
      { label: COLAB_T4, gpu: T4, note: { en: 'Only the student SFT; the teacher traces need a bigger GPU', zh: '只够学生 SFT；老师的轨迹要在大卡上生成' } },
    ],
    configs_summary: { en: 'A100 recommended · T4 for SFT only', zh: '推荐 A100 · T4 只够 SFT' },
  },
};

const GENERATED = 'Generated by apps/mathnim/tools/labs_build.ts (npm run labs -w mathnim)';
const CJK = /[㐀-鿿]/;
const FOOTNOTE = /^\[\^([\w.:-]+)\]:\s+(.+)$/;
const SECTION: Record<string, Lang> = { 中文: 'zh', English: 'en' };
/** The banner must say the code has not run on a GPU yet (a requirement of the lab pages). */
const NOT_RUN: Record<Lang, string> = { zh: '尚未在 GPU 上实跑', en: 'not yet run on a GPU' };

const fail = (where: string, msg: string): never => {
  throw new Error(`${where}: ${msg}`);
};
const lang_of_file = (name: string): string => ({ py: 'python', sh: 'bash', json: 'json', yaml: 'yaml', yml: 'yaml' })[name.split('.').pop() ?? ''] ?? 'text';

// ---------------------------------------------------------------- inline -> prose
/** Inline tokens as the reader's prose syntax. */
function inline(tokens: Token[] | undefined, where: string): string {
  let out = '';
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'text': {
        // a list item's text token holds inline tokens of its own
        if ((t as Tokens.Text).tokens?.length) {
          out += inline((t as Tokens.Text).tokens, where);
          break;
        }
        const s = (t as Tokens.Text).text;
        if (s.includes('$')) fail(where, `"$" would start TeX in the reader: ${JSON.stringify(s)}`);
        if (s.includes('*')) fail(where, `a literal "*" would become emphasis in the reader: ${JSON.stringify(s)}`);
        out += s.replace(/\n/g, ' '); // a soft line break is a space
        break;
      }
      case 'escape': {
        const c = (t as Tokens.Escape).text;
        if (/[*`$[\]_\\]/.test(c)) fail(where, `the reader has no escapes for ${JSON.stringify(c)}`);
        out += c;
        break;
      }
      case 'codespan': {
        const c = (t as Tokens.Codespan).text;
        if (c.includes('`') || c.includes('\n')) fail(where, `code span the reader cannot hold: ${JSON.stringify(c)}`);
        out += '`' + c + '`';
        break;
      }
      case 'strong':
        out += wrap((t as Tokens.Strong).tokens, '**', where);
        break;
      case 'em':
        out += wrap((t as Tokens.Em).tokens, '*', where);
        break;
      case 'link': {
        const l = t as Tokens.Link;
        if (l.title) fail(where, `link titles are not supported: ${l.raw}`);
        if (/[\s)]/.test(l.href)) fail(where, `the reader cannot hold this link target: ${l.href}`);
        out += `[${inline(l.tokens, where)}](${l.href})`;
        break;
      }
      case 'br':
        out += '\n'; // the reader turns it into <br>
        break;
      default:
        fail(where, `unsupported inline Markdown (${t.type}): ${JSON.stringify(t.raw)}`);
    }
  }
  return out;
}

/** **bold** / *italic* around `children`; a code span inside closes the run before it and reopens it after (the reader splits prose at code first). */
function wrap(children: Token[] | undefined, mark: string, where: string): string {
  const parts: string[] = [];
  let run: Token[] = [];
  const flush = () => {
    if (!run.length) return;
    const s = inline(run, where);
    run = [];
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
    parts.push(m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s);
  };
  for (const c of children ?? []) {
    if (c.type === 'codespan') {
      flush();
      parts.push(inline([c], where));
    } else run.push(c);
  }
  flush();
  return parts.join('');
}

// ---------------------------------------------------------------- blocks
/** "**状态：** text" -> { title: '状态', body: 'text' } (the leading bold label becomes the callout's title). */
function labelled(text: string): { title?: string; body: string } {
  const m = /^\*\*([^*]+?)[：:]\*\*\s*([\s\S]+)$/.exec(text);
  return m ? { title: m[1], body: m[2] } : { body: text };
}

function callout(kind: 'note' | 'warning', p: Tokens.Paragraph, where: string): Block {
  const { title, body } = labelled(inline(p.tokens, where));
  return title !== undefined ? { type: 'callout', kind, title, body } : { type: 'callout', kind, body };
}

/** A list item: its paragraph, and the fenced code blocks that follow it inside the item. */
function list_item(item: Tokens.ListItem, where: string): { text: string; codes: Block[] } {
  if (item.task) fail(where, `task list items are not supported: ${JSON.stringify(item.raw)}`);
  const [first, ...rest] = item.tokens.filter((t) => t.type !== 'space');
  if (!first || (first.type !== 'text' && first.type !== 'paragraph') || rest.some((t) => t.type !== 'code')) {
    fail(where, `a list item may hold a paragraph and code blocks only (found ${item.tokens.map((t) => t.type).join(', ')}): ${JSON.stringify(item.raw.slice(0, 80))}`);
  }
  return { text: inline((first as Tokens.Text | Tokens.Paragraph).tokens, where), codes: rest.map((c) => code_block(c as Tokens.Code)) };
}

const code_block = (c: Tokens.Code): Block => ({ type: 'code', lang: (c.lang ?? '').trim().split(/\s+/)[0] || 'text', code: c.text });

/** Footnote definitions "[^key]: text https://url" as cite blocks; null when the paragraph is not one. */
function footnotes(p: Tokens.Paragraph, where: string): Block[] | null {
  const lines = p.text.split('\n');
  const hits = lines.filter((l) => FOOTNOTE.test(l)).length;
  if (!hits) return null;
  if (hits !== lines.length) fail(where, `footnote definitions mixed with other text: ${JSON.stringify(p.text.slice(0, 80))}`);
  return lines.map((l) => {
    const [, key, def] = FOOTNOTE.exec(l)!;
    const m = /^([\s\S]*?)\s*(https?:\/\/\S+)$/.exec(def);
    const text = m ? m[1] : def;
    if (/[$*]/.test(text.replace(/`[^`]*`/g, ''))) fail(where, `footnote ${key}: "$" or "*" would be read as markup`);
    return { type: 'cite', key, text, url: m ? m[2] : '' } satisfies Block;
  });
}

/**
 * One language section's tokens as blocks, and the first number of each
 * ordered list in order. A code block inside a list item comes right after the
 * item (the list is split there) and the rest of the list continues with the
 * next number, which a list block cannot say: hence `starts`.
 */
function section_blocks(tokens: Token[], where: string): { blocks: Block[]; starts: number[] } {
  const blocks: Block[] = [];
  const starts: number[] = [];
  let last = -1;
  tokens.forEach((t, i) => void (t.type !== 'space' && (last = i)));
  tokens.forEach((t, i) => {
    switch (t.type) {
      case 'space':
        return;
      case 'hr':
        // the separator before the next section; a rule inside a section has no Block
        if (i !== last) fail(where, 'a horizontal rule inside a section has no block type');
        return;
      case 'heading': {
        const h = t as Tokens.Heading;
        if (h.depth !== 3 && h.depth !== 4) fail(where, `heading level ${h.depth} inside a section: ${h.text}`);
        blocks.push({ type: 'h', text: inline(h.tokens, where), level: h.depth === 3 ? 2 : 3 });
        return;
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph;
        const cites = footnotes(p, where);
        if (cites) blocks.push(...cites);
        else blocks.push({ type: 'p', text: inline(p.tokens, where) });
        return;
      }
      case 'list': {
        const l = t as Tokens.List;
        const first = l.start === '' ? 1 : l.start;
        let items: string[] = [];
        let start = first;
        const flush = () => {
          if (!items.length) return;
          blocks.push(l.ordered ? { type: 'list', items, ordered: true } : { type: 'list', items });
          if (l.ordered) starts.push(start);
          items = [];
        };
        l.items.forEach((it, k) => {
          const { text, codes } = list_item(it, where);
          if (!items.length) start = first + k;
          items.push(text);
          if (codes.length) {
            flush();
            blocks.push(...codes);
          }
        });
        flush();
        return;
      }
      case 'code':
        blocks.push(code_block(t as Tokens.Code));
        return;
      case 'table': {
        const tb = t as Tokens.Table;
        blocks.push({ type: 'table', head: tb.header.map((c) => inline(c.tokens, where)), rows: tb.rows.map((r) => r.map((c) => inline(c.tokens, where))) });
        return;
      }
      case 'blockquote': {
        const ps = (t as Tokens.Blockquote).tokens.filter((x) => x.type !== 'space');
        if (ps.length !== 1 || ps[0].type !== 'paragraph') fail(where, 'a quote inside a section may hold one paragraph only');
        blocks.push(callout('note', ps[0] as Tokens.Paragraph, where));
        return;
      }
      default:
        fail(where, `unsupported Markdown (${t.type}): ${JSON.stringify(t.raw.slice(0, 80))}`);
    }
  });
  return { blocks, starts };
}

/** Every prose string of a block list (for checks). */
export function prose_of(blocks: Block[]): string[] {
  const out: string[] = [];
  const s = (x: unknown) => typeof x === 'string' && out.push(x);
  for (const b of blocks) {
    switch (b.type) {
      case 'h': case 'p': s(b.text); break;
      case 'list': b.items.forEach(s); break;
      case 'table': b.head.forEach(s); b.rows.forEach((r) => r.forEach(s)); break;
      case 'callout': s(b.title); s(b.body); break;
      case 'details': s(b.summary); out.push(...prose_of(b.blocks)); break;
      case 'cite': s(b.text); break;
      default: break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- one lab
export interface ParsedLab {
  id: string;
  title: Bi;
  blocks: Record<Lang, Block[]>;
  /** The first number of each ordered list, in order, where one does not start at 1 (see section_blocks). */
  list_starts: Partial<Record<Lang, number[]>>;
  /** File names in the order the tutorial's "Files" line gives them, per language. */
  files: Record<Lang, string[]>;
}

/** A tutorial's Markdown as blocks per language (the status banner first). `known_files` are the names in labs/code/. */
export function parse_lab(md: string, file: string, known_files: readonly string[]): ParsedLab {
  const tokens = new Lexer({ gfm: true }).lex(md.replace(/\r\n?/g, '\n'));
  const refs = Object.keys(tokens.links);
  if (refs.length) fail(file, `link reference definitions are not supported: ${refs.join(', ')}`);

  const first = tokens.find((t) => t.type !== 'space');
  if (first?.type !== 'heading' || (first as Tokens.Heading).depth !== 1) fail(file, 'the first line must be "# Lx 中文标题 / Lx English title"');
  const tm = /^(L\d+)\s*(.+?) \/ (L\d+)\s*(.+)$/.exec((first as Tokens.Heading).text);
  if (!tm || tm[1] !== tm[3]) fail(file, `title line not in the form "# Lx 中文标题 / Lx English title": ${(first as Tokens.Heading).text}`);
  const [, id, zh_title, , en_title] = tm!;

  // split into preamble and the two language sections
  const parts: { pre: Token[]; zh: Token[]; en: Token[] } = { pre: [], zh: [], en: [] };
  let at: 'pre' | Lang = 'pre';
  for (const t of tokens) {
    if (t === first) continue;
    if (t.type === 'heading' && (t as Tokens.Heading).depth <= 2) {
      const lang = SECTION[(t as Tokens.Heading).text.trim()];
      if ((t as Tokens.Heading).depth === 1 || !lang) fail(file, `unexpected heading "${(t as Tokens.Heading).raw.trim()}" (sections are "## 中文" and "## English")`);
      if (parts[lang].length) fail(file, `section "## ${(t as Tokens.Heading).text}" appears twice`);
      at = lang;
      continue;
    }
    parts[at].push(t);
  }

  // preamble: the status banner (one paragraph per language) and the section links
  const banner: Partial<Record<Lang, Block>> = {};
  for (const t of parts.pre) {
    if (t.type === 'space' || t.type === 'hr') continue;
    if (t.type === 'paragraph' && /^\[中文\]\(#中文\)\s*·\s*\[English\]\(#english\)$/.test((t as Tokens.Paragraph).text.trim())) continue;
    if (t.type !== 'blockquote') fail(file, `unexpected ${t.type} before the sections: ${JSON.stringify(t.raw.slice(0, 80))}`);
    for (const p of (t as Tokens.Blockquote).tokens) {
      if (p.type === 'space') continue;
      if (p.type !== 'paragraph') fail(file, `the status banner may hold paragraphs only (found ${p.type})`);
      const lang: Lang = CJK.test((p as Tokens.Paragraph).text) ? 'zh' : 'en';
      if (banner[lang]) fail(file, `the status banner has two ${lang} paragraphs`);
      banner[lang] = callout('warning', p as Tokens.Paragraph, `${file} (banner)`);
    }
  }

  const blocks = {} as Record<Lang, Block[]>;
  const list_starts: Partial<Record<Lang, number[]>> = {};
  const files = {} as Record<Lang, string[]>;
  for (const lang of ['zh', 'en'] as const) {
    const where = `${file} (## ${lang === 'zh' ? '中文' : 'English'})`;
    if (!parts[lang].length) fail(file, `missing section "## ${lang === 'zh' ? '中文' : 'English'}"`);
    const b = banner[lang] ?? fail(file, `the status banner has no ${lang} paragraph`);
    const body = (b as Extract<Block, { type: 'callout' }>).body as string;
    if (!body.includes(NOT_RUN[lang])) fail(where, `the status banner does not say "${NOT_RUN[lang]}"`);
    const sec = section_blocks(parts[lang], where);
    blocks[lang] = [b, ...sec.blocks];
    if (sec.starts.some((n) => n !== 1)) list_starts[lang] = sec.starts;

    // footnote references must have a definition in the same language
    const keys = new Set(blocks[lang].flatMap((x) => (x.type === 'cite' ? [x.key] : [])));
    for (const s of prose_of(blocks[lang])) for (const [, k] of s.matchAll(/\[\^([\w.:-]+)\]/g)) if (!keys.has(k)) fail(where, `footnote [^${k}] has no definition`);

    // the code files: the backticked names on the "Files" line that exist in labs/code/
    const line = parts[lang].flatMap((t) => (t.type === 'list' ? (t as Tokens.List).items : [])).find((it) => /^\*\*(Files|文件)[:：]\*\*/.test(it.text));
    if (!line) fail(where, 'no "**Files:**" / "**文件：**" item in the setup list');
    files[lang] = [...new Set([...line!.text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((n) => known_files.includes(n)))];
    if (!files[lang].length) fail(where, 'the "Files" item names no file from labs/code/');
  }
  if (files.zh.join() !== files.en.join()) fail(file, `the two languages list different files: ${files.zh.join(', ')} / ${files.en.join(', ')}`);
  return { id, title: { en: en_title.trim(), zh: zh_title.trim() }, blocks, list_starts, files };
}

// ---------------------------------------------------------------- all labs -> sources
/** What the converter reads: the tutorials (Lx-*.md) and labs/code/, each file name -> contents. */
export interface LabInputs {
  mds: Record<string, string>;
  code: Record<string, string>;
}
export interface LabSource {
  /** The Markdown file, e.g. 'L1-rag.md'. */
  md: string;
  lab: LabModule;
}
const is_tutorial = (f: string) => /^L\d+-[\w-]+\.md$/.test(f);

/** Converts every tutorial, in lab order. */
export function convert_labs(inputs: LabInputs): LabSource[] {
  const known = Object.keys(inputs.code).sort();
  const mds = Object.keys(inputs.mds).filter(is_tutorial).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  return mds.map((md) => {
    const parsed = parse_lab(inputs.mds[md], md, known);
    const slug = md.replace(/\.md$/, '').toLowerCase();
    if (!slug.startsWith(parsed.id.toLowerCase() + '-')) fail(md, `file name and title disagree on the id (${parsed.id})`);
    const meta = META[parsed.id] ?? fail(md, `no META entry for ${parsed.id} in tools/labs_build.ts (summary, configs)`);
    if (meta.configs.length < 2 || meta.configs.length > 3) fail(md, `META.${parsed.id}: give two or three setups`);
    if (meta.configs.filter((c) => c.recommended).length !== 1) fail(md, `META.${parsed.id}: mark exactly one setup as recommended`);
    // the lab's own script first, then the others in the tutorial's order
    const names = [...parsed.files.en].sort((a, b) => Number(!a.startsWith(parsed.id + '_')) - Number(!b.startsWith(parsed.id + '_')));
    const files: LabFile[] = names.map((name) => ({ name, lang: lang_of_file(name), code: inputs.code[name].replace(/\r\n?/g, '\n') }));
    const lab: LabModule = { id: parsed.id, slug, title: parsed.title, summary: meta.summary, configs: meta.configs, configs_summary: meta.configs_summary, ...(meta.minutes ? { minutes: meta.minutes } : {}), blocks: parsed.blocks, ...(Object.keys(parsed.list_starts).length ? { list_starts: parsed.list_starts } : {}), files };
    return { md, lab };
  });
}

export function module_source(s: LabSource): string {
  return `// ${GENERATED} from
// docs/lessons/llm-finetuning/labs/${s.md} and labs/code/ - do not edit.
import type { LabModule } from './types';

export const lab: LabModule = ${JSON.stringify(s.lab, null, 1)};
export default lab;
`;
}

export function index_source(labs: LabSource[]): string {
  const meta: LabMeta[] = labs.map(({ lab: { id, slug, title, summary, configs, configs_summary, minutes } }) => ({ id, slug, title, summary, configs, configs_summary, ...(minutes ? { minutes } : {}) }));
  return `// ${GENERATED} - do not edit.
// The labs of the fine-tuning course: their card data, and one loader per lab
// so a lab's tutorial and code arrive only when its page is opened.
import type { LabMeta, LabModule } from './types';
export type { Bi, LabConfig, LabFile, LabMeta, LabModule } from './types';

export const LABS: LabMeta[] = ${JSON.stringify(meta, null, 1)};

const LOADERS: Record<string, () => Promise<{ lab: LabModule }>> = {
${labs.map(({ lab }) => ` ${JSON.stringify(lab.slug)}: () => import('./${lab.slug}'),`).join('\n')}
};

/** The card data of the lab with this slug, if there is one. */
export const lab_meta = (slug: string): LabMeta | undefined => LABS.find((l) => l.slug === slug);

/** Loads the lab with this slug (tutorial blocks in both languages, code files); rejects for an unknown slug. */
export async function load_lab(slug: string): Promise<LabModule> {
  const load = LOADERS[slug];
  if (!load) throw new Error(\`unknown lab "\${slug}"\`);
  return (await load()).lab;
}
`;
}

/** The generated files (name in src/labs/ -> source). */
export function build_sources(inputs: LabInputs): Record<string, string> {
  const labs = convert_labs(inputs);
  const out: Record<string, string> = {};
  for (const s of labs) out[`${s.lab.slug}.ts`] = module_source(s);
  out['index.ts'] = index_source(labs);
  return out;
}

/** The parts of node:fs that main() uses. The launcher passes them in, so this file needs no Node types (the tests import it and are typechecked without them). */
export interface Fs {
  readdirSync(dir: string): string[];
  readFileSync(file: string, encoding: 'utf8'): string;
  writeFileSync(file: string, data: string): void;
  existsSync(file: string): boolean;
  statSync(file: string): { isFile(): boolean };
  mkdirSync(dir: string, options: { recursive: true }): unknown;
  rmSync(file: string): void;
}

/** Reads the tutorials and code in `labs_dir`, writes the modules to `out_dir` (src/labs) and removes generated modules whose tutorial is gone. */
export function main({ fs, labs_dir, out_dir }: { fs: Fs; labs_dir: string; out_dir: string }): void {
  const at = (dir: string, f: string) => `${dir.replace(/\/$/, '')}/${f}`;
  const read_all = (dir: string, keep: (f: string) => boolean) =>
    Object.fromEntries(fs.readdirSync(dir).filter((f) => keep(f) && fs.statSync(at(dir, f)).isFile()).map((f) => [f, fs.readFileSync(at(dir, f), 'utf8')]));
  const sources = build_sources({ mds: read_all(labs_dir, is_tutorial), code: read_all(at(labs_dir, 'code'), (f) => !f.startsWith('.')) });
  fs.mkdirSync(out_dir, { recursive: true });
  for (const f of fs.readdirSync(out_dir)) {
    if (!(f in sources) && f.endsWith('.ts') && fs.readFileSync(at(out_dir, f), 'utf8').includes(GENERATED)) {
      fs.rmSync(at(out_dir, f));
      console.log(`removed src/labs/${f}`);
    }
  }
  let changed = 0;
  for (const [f, src] of Object.entries(sources)) {
    if (fs.existsSync(at(out_dir, f)) && fs.readFileSync(at(out_dir, f), 'utf8') === src) continue;
    fs.writeFileSync(at(out_dir, f), src);
    changed++;
  }
  const n = Object.keys(sources).length - 1;
  console.log(`src/labs: ${n} labs, ${changed} file${changed === 1 ? '' : 's'} written`);
}
