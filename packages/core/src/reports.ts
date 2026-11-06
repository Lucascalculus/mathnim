// Reports: the one way anything a learner works with on a page tells the lesson what happened. An instrument in a
// frame, an engine figure, a question in the text, a scene, and whatever is added later all send the same three
// reports, through their own adapter (packages/present: listen_frames, the figure slot, the inline quiz):
//
//   answer  one attempt at one thing: { kind: 'answer', item, correct, response? }
//           item names the thing inside the source ('m3', 'model', 'q'); the same name every time it is tried again
//   done    the source's task is finished: { kind: 'done', score? }   (score 0..1)
//   state   what the source shows now, in the learner's language, in a sentence or two: { kind: 'state', text }
//
// The hub does the rest, the same for every source: an answer goes in the event log (the first try at an item as
// 'answered', which the data centre and the lesson's summary count; later tries as 'interacted'), and the first try
// at an item updates the learner model (for the step's skill, or the lesson's first skill on a page without one), so
// dropping a chip three times does not count three misses. The latest state of each source on the page in view is
// kept for the tutor in the margin (states()). How a source should report: docs/REPORTS.md.
import type { EventLog } from './events';
import type { LearnerModel } from './learner/model';

export type Report =
  | { kind: 'answer'; item: string; correct: boolean; response?: string }
  | { kind: 'done'; score?: number }
  | { kind: 'state'; text: string };

/** Who sent a report: an id that is stable on its page ('frame:lp_check#0', 'quiz:2', 'figure:mgmt_lp_plane#1') and,
 * for the tutor, what it is in words (its alt text or caption). */
export interface ReportSource {
  id: string;
  label?: string;
}

export interface ReportHubOptions {
  lesson: string;
  log: EventLog;
  learner?: LearnerModel;
  /** The step in view (its id, and its skill if it has one). */
  step: () => { id: string; skill?: string } | undefined;
  /** The lesson's skills: answers on a page without a skill count for the first. */
  skills?: string[];
}

const LIMIT = { item: 80, response: 200, text: 600, id: 120, label: 300 };
const clip = (s: unknown, n: number): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export class ReportHub {
  private kept = new Map<string, { step: string; label?: string; text: string }>();
  private tried = new Set<string>();
  private subs: ((src: ReportSource, r: Report) => void)[] = [];
  constructor(private o: ReportHubOptions) {}

  /** A report from untrusted data (a message from a frame), or null when it is not one. */
  static parse(d: unknown): Report | null {
    if (!d || typeof d !== 'object') return null;
    const m = d as Record<string, unknown>;
    const kind = m.kind ?? m.mn;   // a frame posts { mn: 'answer', ... }; anything else may post { kind: 'answer', ... }
    if (kind === 'answer') {
      const item = clip(m.item, LIMIT.item);
      if (!item || typeof m.correct !== 'boolean') return null;
      const response = m.response == null ? undefined : clip(m.response, LIMIT.response);
      return { kind, item, correct: m.correct, ...(response ? { response } : {}) };
    }
    if (kind === 'done') {
      const score = typeof m.score === 'number' && Number.isFinite(m.score) ? Math.max(0, Math.min(1, m.score)) : undefined;
      return score === undefined ? { kind } : { kind, score };
    }
    if (kind === 'state') {
      const text = clip(m.text, LIMIT.text);
      return text ? { kind, text } : null;
    }
    return null;
  }

  report(source: ReportSource, r: Report): void {
    const step = this.o.step();
    const sid = step?.id ?? '';
    const src = { id: clip(source.id, LIMIT.id), label: source.label ? clip(source.label, LIMIT.label) : undefined };
    const skill = step?.skill ?? this.o.skills?.[0];
    if (r.kind === 'answer') {
      const key = `${this.o.lesson}/${sid}/${src.id}/${r.item}`;
      const first = !this.tried.has(key);
      this.tried.add(key);
      this.o.log.emit({
        verb: first ? 'answered' : 'interacted', lesson: this.o.lesson, step: sid || undefined, object: skill,
        result: { correct: r.correct, ...(r.response ? { response: r.response } : {}) }, data: { source: src.id, item: r.item, ...(first ? {} : { retry: true }) },
      });
      if (first && skill) this.o.learner?.observe({ skill, item: key, correct: r.correct, graded: true });
    } else if (r.kind === 'done') {
      this.o.log.emit({ verb: 'interacted', lesson: this.o.lesson, step: sid || undefined, object: skill, result: r.score === undefined ? {} : { score: r.score }, data: { source: src.id, done: true } });
    } else {
      this.kept.set(src.id, { step: sid, label: src.label, text: r.text });
    }
    for (const f of this.subs) f(src, r);
  }

  /** The latest state of each source on the step in view, for the tutor. */
  states(): { label?: string; text: string }[] {
    const sid = this.o.step()?.id ?? '';
    return [...this.kept.values()].filter((s) => s.step === sid).map(({ label, text }) => ({ label, text }));
  }

  /** Listen to every report (after the hub has handled it). Returns the way to stop. */
  on(f: (src: ReportSource, r: Report) => void): () => void {
    this.subs.push(f);
    return () => (this.subs = this.subs.filter((x) => x !== f));
  }
}
