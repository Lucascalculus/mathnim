// The hands-on labs of the courses as data. The modules in src/labs/<course>/
// and src/labs/index.ts are generated from docs/lessons/<course>/labs/*.md and
// labs/code/ by tools/labs_build.ts (npm run labs -w mathnim); only this file
// is written by hand. Each lab module is loaded on demand (index.ts).
import type { Block, L10n, Lang } from '@mathnim/core';

/** Text in both course languages. */
export interface Bi {
  en: string;
  zh: string;
}

/** A code file the tutorial refers to, shown with copy and download. */
export interface LabFile {
  /** File name as the tutorial uses it, e.g. 'L1_rag.py'. */
  name: string;
  /** Highlighter language ('python', 'text', ...). */
  lang: string;
  code: string;
}

/** A setup the lab can run on (two or three per lab; nothing has been timed, so no prices or run times). */
export interface LabConfig {
  /** e.g. "租用 A100" / "Rented A100". */
  label: L10n;
  /** The hardware, e.g. "NVIDIA T4 · 16 GB" or "不需要 GPU" / "No GPU". */
  gpu: L10n;
  /** What it is good for, short: "跑完整版", "只够跑缩小版", "按小时租用". */
  note: L10n;
  /** The setup to suggest first (one per lab). */
  recommended?: boolean;
}

/** What a list of labs needs (no blocks, no code). */
export interface LabMeta {
  /** 'L1' ... 'L5'. */
  id: string;
  /** URL segment, e.g. 'l1-rag' (the route is /<course>/labs/<slug>). */
  slug: string;
  title: Bi;
  summary: Bi;
  /** Recommended setups, the recommended one marked. */
  configs: LabConfig[];
  /** The setups in a few words for a card, e.g. "推荐 A100 · 也可用 T4" or "CPU 即可". */
  configs_summary: L10n;
  /** Time to set aside, when the tutorial states one. */
  minutes?: number;
}

/** A whole lab: the tutorial in each language as text-page blocks, and its code files. */
export interface LabModule extends LabMeta {
  blocks: Record<Lang, Block[]>;
  /**
   * Where a numbered list goes on after a code block (in the Markdown the code
   * sat inside a list item; a list block always counts from 1): the first
   * number of every ordered list of that language, in document order. Absent
   * when every list starts at 1.
   */
  list_starts?: Partial<Record<Lang, number[]>>;
  files: LabFile[];
}
