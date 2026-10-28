// Lint for text pages and bilingual lessons (the lesson doctor runs it on every
// lesson of the course). No DOM, no files: the checks that need the outside
// world (does a figure exist, is a visual registered, does TeX render) are
// passed in, so tests can run it on small lessons.
//
// Errors: a { en, zh } text with a language missing; a figure that does not
// exist; an unknown visual or parameters check_params rejects; an empty code
// block; a derivation blank that is out of range, does not parse or does not
// grade its own answer as correct; code notes outside the code; table rows of
// the wrong width; TeX that does not render; a footnote to a missing source.
// Warnings: plain-string prose in a bilingual lesson (untranslated), Chinese
// identical to English, Chinese inside TeX, English words inside shared TeX
// (\text{…} etc. in math blocks, derive lines and plain-string $…$), unknown
// code languages.
import {
  code_line_count, expr, grade_blank, has_cjk, is_bilingual, is_voiced, lesson_langs, lesson_strings, step_strings, tr,
  type Block, type CheckpointStep, type L10n, type Lesson, type Step,
} from '@mathnim/core';

export interface LintIssue {
  severity: 'error' | 'warning';
  /** Where in the lesson, e.g. 'steps.idea.blocks[3]'. */
  where: string;
  message: string;
}
export interface LintDeps {
  /** Does `public/<src>` exist? */
  figure_exists?: (src: string) => boolean;
  /** Problems with a visual block: unknown name or rejected parameters (errors), adjustments (notes); null when the name is unknown. */
  check_visual?: (name: string, params: Record<string, unknown> | undefined) => { errors: string[]; notes: string[]; explorable: boolean } | null;
  /** The TeX error message, or null when it renders. */
  tex_error?: (tex: string, display: boolean) => string | null;
}

// ---- English words inside TeX that a Chinese learner would see (bilingual lessons)
/** Words that may stay in TeX: units, formats, function names, method and model names, standard subscripts. */
const TEX_WORDS_OK = new Set([
  'bytes', 'byte', 'bits', 'softmax', 'sigmoid', 'adam', 'adamw', 'lora', 'qlora', 'max', 'min', 'arg', 'argmax', 'argmin', 'log', 'exp', 'rank',
  'var', 'cov', 'tanh', 'relu', 'gelu', 'clip', 'sign', 'std', 'diag', 'det', 'tr',
  'recall', 'pass', 'maj',
  // standard subscripts of the literature (π_ref, π_old, π_new, θ_init)
  'ref', 'old', 'new', 'init',
  // model families
  'llama', 'qwen', 'mistral', 'mixtral', 'gemma', 'deepseek', 'claude', 'gpt', 'bert', 'phi', 'falcon', 'olmo', 'tulu', 'zephyr', 'vicuna', 'alpaca', 'kimi', 'glm', 'yi',
]);
/** The words of \text{…}, \mathrm{…}, \operatorname{…} in `tex` that would show English (3+ letters, not acronyms, units, formats or names). */
export function tex_english(tex: string): string[] {
  const out = new Set<string>();
  for (const m of tex.matchAll(/\\(?:text|textrm|textit|textbf|mathrm|mathit|mathbf|operatorname\*?)\s*\{([^{}]*)\}/g)) {
    for (const w of m[1].match(/[A-Za-z][A-Za-z0-9@]*/g) ?? []) {
      if (w.replace(/[^A-Za-z]/g, '').length < 3) continue;
      if (/[\d@]/.test(w)) continue; // formats and metrics: bf16, int8, BM25, pass@k
      if (/^[A-Z]{2,}s?$/.test(w)) continue; // acronyms and names: KL, MRR, DPO, GRPO, RLHF, GPUs
      if (TEX_WORDS_OK.has(w.toLowerCase())) continue;
      out.add(w);
    }
  }
  return [...out];
}
const TEX_ENGLISH_HINT = 'Chinese learners see these English words in the formula: move them into the `why` text or the prose (or use a symbol)';

const CODE_LANGS = new Set(['python', 'py', 'python3', 'bash', 'sh', 'shell', 'zsh', 'console', 'json', 'jsonl', 'yaml', 'yml', 'text', 'txt', '']);
/** Prose that reads as English sentences (three or more words outside TeX and code). */
const looks_english = (s: string) => (s.replace(/\$[^$]*\$|`[^`]*`|\[[^\]]*\]\([^)]*\)/g, ' ').match(/[A-Za-z]{2,}/g)?.length ?? 0) >= 3;

export function lint_lesson_text(lesson: Lesson, deps: LintDeps = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const err = (where: string, message: string): void => void out.push({ severity: 'error', where, message });
  const warn = (where: string, message: string): void => void out.push({ severity: 'warning', where, message });
  const bilingual = lesson_langs(lesson).length > 1;

  // ---- every learner-facing string: both languages, markup, TeX
  for (const x of lesson_strings(lesson)) {
    const v = x.value as L10n;
    if (is_bilingual(v)) {
      for (const l of ['en', 'zh'] as const) if (typeof v[l] !== 'string' || !v[l].trim()) err(x.where, `the ${l === 'en' ? 'English' : 'Chinese'} text is missing`);
      if (v.en && v.zh && v.en === v.zh && looks_english(v.en)) warn(x.where, 'the Chinese text is the same as the English (not translated?)');
      if (v.en && has_cjk(v.en)) warn(x.where, 'the English text contains Chinese characters');
      // (Chinese punctuation counts: an English paper title in a Chinese citation is fine)
      if (v.zh && looks_english(v.zh) && !has_cjk(v.zh) && !/[\u3000-\u303f\uff00-\uffef]/.test(v.zh)) warn(x.where, 'the Chinese text has no Chinese characters (not translated?)');
    } else if (typeof v === 'string') {
      if (bilingual) {
        // a shared string shows the same TeX in both languages
        const words = [...v.replace(/`[^`]*`/g, '').matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)].flatMap((m) => tex_english(m[1] ?? m[2]));
        if (words.length) warn(x.where, `${TEX_ENGLISH_HINT}: ${[...new Set(words)].join(', ')}`);
      }
      if (bilingual && x.role !== 'label' && looks_english(v)) warn(x.where, 'plain English text in a bilingual lesson: write { en, zh }');
      else if (bilingual && x.role === 'label' && looks_english(v) && v.split(/\s+/).length >= 4) warn(x.where, 'plain English label in a bilingual lesson: write { en, zh }');
    } else err(x.where, 'expected a string or { en, zh }');
    for (const l of ['en', 'zh'] as const) {
      const text = tr(v, l);
      if (((text.replace(/`[^`]*`/g, '').replace(/\\\$/g, '').match(/\$/g)?.length ?? 0) % 2)) err(x.where, `${l}: an unclosed $ (inline TeX is $...$)`);
      for (const m of text.replace(/`[^`]*`/g, '').matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)) check_tex(`${x.where} (${l})`, m[1] ?? m[2], !!m[1]);
      if (!is_bilingual(v)) break;
    }
  }

  function check_tex(where: string, tex: string, display: boolean): void {
    if (!tex.trim()) {
      err(where, 'empty TeX');
      return;
    }
    if (has_cjk(tex) && !/\\text\{/.test(tex)) warn(where, `Chinese inside TeX (${tex.slice(0, 40)}): the math fonts cannot draw it; keep it outside $...$`);
    const e = deps.tex_error?.(tex, display);
    if (e) err(where, `TeX does not render: ${e} in ${tex.slice(0, 60)}`);
  }

  // ---- blocks of read pages and case briefs
  function blocks(bs: Block[], at: string): void {
    bs.forEach((b, i) => {
      const where = `${at}[${i}]`;
      switch (b.type) {
        case 'h':
          if (b.level !== undefined && b.level !== 2 && b.level !== 3) err(where, 'heading level must be 2 or 3');
          break;
        case 'math': {
          check_tex(where, b.tex, true);
          const words = bilingual ? tex_english(b.tex) : [];
          if (words.length) warn(where, `${TEX_ENGLISH_HINT}: ${words.join(', ')}`);
          break;
        }
        case 'code': {
          if (!b.code.trim()) err(where, 'empty code block');
          if (!CODE_LANGS.has(b.lang.toLowerCase())) warn(where, `code language '${b.lang}' is not highlighted (python, bash, json, yaml, text)`);
          const labels = [b.label ?? b.lang, ...(b.tabs ?? []).map((t) => t.label)];
          if (new Set(labels).size !== labels.length) err(where, `tab labels repeat: ${labels.join(', ')}`);
          (b.tabs ?? []).forEach((t, k) => {
            if (!t.code.trim()) err(`${where}.tabs[${k}]`, 'empty code tab');
            if (!t.label.trim()) err(`${where}.tabs[${k}]`, 'a tab needs a label');
          });
          break;
        }
        case 'figure': {
          // one file for both languages, or one per language ({ en, zh }): every file must exist
          const srcs = is_bilingual(b.src) ? [...new Set([b.src.en, b.src.zh])] : [b.src];
          for (const src of srcs) {
            if (typeof src !== 'string' || !src.trim()) err(where, 'figure without src');
            else if (/^https?:/i.test(src)) err(where, `figures come from the app's public folder, not the web: ${src}`);
            else if (deps.figure_exists && !deps.figure_exists(src.replace(/^\//, ''))) err(where, `figure not found: public/${src.replace(/^\//, '')}`);
          }
          if (!tr(b.alt, 'en').trim()) err(where, 'figure without alt text');
          if (!b.credit) warn(where, 'figure without credit (say what it was redrawn from, or "original")');
          break;
        }
        case 'svg': {
          if (!/^\s*<svg[\s>]/i.test(tr(b.svg, 'en'))) err(where, 'svg block without <svg> markup');
          if (!tr(b.alt, 'en').trim()) err(where, 'drawing without alt text');
          break;
        }
        case 'visual': {
          const r = deps.check_visual?.(b.name, b.params);
          if (r === null) err(where, `no visual named '${b.name}' is registered`);
          else if (r) {
            for (const e of r.errors) err(where, `${b.name}: ${e}`);
            for (const n of r.notes) warn(where, `${b.name}: ${n}`);
            if (b.explore && !r.explorable) warn(where, `${b.name} has no explore(): 'explore: true' does nothing`);
          }
          break;
        }
        case 'details':
          if (!b.blocks.length) err(where, 'details with nothing inside');
          blocks(b.blocks, `${where}.blocks`);
          break;
        case 'table':
          if (!b.head.length) err(where, 'table without a header row');
          b.rows.forEach((r, k) => r.length !== b.head.length && err(`${where}.rows[${k}]`, `row has ${r.length} cells, the header ${b.head.length}`));
          break;
        case 'cite':
          if (!/^https?:\/\//.test(b.url)) warn(where, `source url is not a web link: ${b.url}`);
          break;
        case 'list':
          if (!b.items.length) err(where, 'empty list');
          break;
        case 'callout':
        case 'p':
          break;
      }
    });
  }
  function cite_keys(bs: Block[], into = new Map<string, number>()): Map<string, number> {
    for (const b of bs) {
      if (b.type === 'cite') into.set(b.key, (into.get(b.key) ?? 0) + 1);
      if (b.type === 'details') cite_keys(b.blocks, into);
    }
    return into;
  }
  function footnotes(s: Step, keys: Set<string>, where: string): void {
    const refs = new Set<string>();
    for (const x of step_strings(s)) {
      for (const l of ['en', 'zh'] as const) for (const m of tr(x.value, l).matchAll(/\[\^([\w.:-]+)\]/g)) refs.add(m[1]);
    }
    for (const r of refs) if (!keys.has(r)) err(where, `footnote [^${r}] has no cite block with that key on this page`);
  }

  // ---- steps
  const groups = new Map<string, number[]>();
  lesson.steps.forEach((s, idx) => {
    const at = `steps.${s.id}`;
    if (s.narration !== undefined && !is_voiced(s, lesson.mode)) warn(`${at}.narration`, s.kind === 'checkpoint' ? 'questions are only voiced in game lessons (mode: \'game\'): this narration is never spoken' : `a ${s.kind} step is not voiced (narration is for scenes): its narration is never spoken`);
    if (s.kind === 'read') {
      if (!s.blocks.length) err(at, 'empty read page');
      const keys = cite_keys(s.blocks);
      for (const [k, n] of keys) if (n > 1) err(at, `two cite blocks with the key '${k}'`);
      blocks(s.blocks, `${at}.blocks`);
      footnotes(s, new Set(keys.keys()), at);
    } else if (s.kind === 'derive') {
      if (!s.lines.length) err(at, 'a derivation needs lines');
      s.lines.forEach((l, i) => {
        check_tex(`${at}.lines[${i}]`, l.tex, true);
        const words = bilingual ? tex_english(l.tex) : [];
        if (words.length) warn(`${at}.lines[${i}]`, `${TEX_ENGLISH_HINT}: ${words.join(', ')}`);
      });
      const b = s.blank;
      if (b) {
        if (!Number.isInteger(b.line) || b.line < 0 || b.line >= s.lines.length) err(`${at}.blank`, `blank.line ${b.line} is not a line (0-based: 0..${s.lines.length - 1})`);
        try {
          expr.parse(b.answer, b.variables ?? []);
          if (!grade_blank(s, b.answer).correct) err(`${at}.blank`, `the answer '${b.answer}' is not graded correct against itself (check variables/ranges)`);
        } catch (e) {
          err(`${at}.blank`, `the answer '${b.answer}' does not parse: ${(e as Error).message}`);
        }
      }
      footnotes(s, new Set(), at);
    } else if (s.kind === 'code') {
      if (!s.code.trim()) err(at, 'empty code');
      if (!CODE_LANGS.has(s.lang.toLowerCase())) warn(at, `code language '${s.lang}' is not highlighted`);
      if (!s.notes.length) warn(at, 'a code walkthrough without notes');
      const n = code_line_count(s.code);
      s.notes.forEach((note, i) => {
        const [a, z] = note.lines;
        if (!Number.isInteger(a) || !Number.isInteger(z) || a < 1 || z > n || a > z) err(`${at}.notes[${i}]`, `lines [${a}, ${z}] are not within the code's lines 1..${n} (1-based, inclusive)`);
      });
      footnotes(s, new Set(), at);
    } else if (s.kind === 'checkpoint') {
      const q = s.question;
      if (q.type === 'text') {
        const k = q.rubric.key_points.length;
        if (!k) err(`${at}.rubric`, 'a text question needs key points');
        if (q.rubric.min_points !== undefined && (q.rubric.min_points < 1 || q.rubric.min_points > k)) err(`${at}.rubric`, `min_points ${q.rubric.min_points} is not within 1..${k}`);
        if (!tr(q.rubric.model_answer, 'en').trim()) err(`${at}.rubric`, 'a text question needs a model answer');
      }
      if (s.group) {
        const list = groups.get(s.group.id) ?? [];
        list.push(idx);
        groups.set(s.group.id, list);
        if (s.group.brief) blocks(s.group.brief, `${at}.group.brief`);
      }
    }
  });
  // a case is consecutive questions (branch-only steps may sit in between)
  for (const [id, idxs] of groups) {
    for (let k = 1; k < idxs.length; k++) {
      const between = lesson.steps.slice(idxs[k - 1] + 1, idxs[k]).filter((s) => !s.branch_only);
      if (between.length) warn(`group ${id}`, `questions of the case are not consecutive (${between.map((s) => s.id).join(', ')} in between): it is shown as separate cases`);
    }
    const first = lesson.steps[idxs[0]] as CheckpointStep;
    if (!lesson.steps.filter((_, i) => idxs.includes(i)).some((s) => (s as CheckpointStep).group?.brief?.length)) warn(`group ${id}`, `case '${tr(first.group!.title, 'en')}' has no brief`);
  }
  return out;
}
