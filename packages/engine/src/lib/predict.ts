// The prediction protocol (猜，再看; docs/design/ENGINE-ARCH.md). Every way the learner's hand answers before it sees
// goes through the same states, whatever the hand does: asked (the hand may answer; the guess is hollow) → committed
// (letting go is the commitment, once; the lesson hears the answer) → revealed (the figure shows the truth its own
// way, from on_commit, and the gap is drawn and said). A gesture is one way of answering: a point on a plot
// (guess.ts), and to come, a sketched curve, magnetic bins, a confidence ring, teach-back. Each is a library file
// that returns a Prediction and registers with define_gesture; the lesson, the tutor and the gallery treat them alike.
import { define, type Entry } from '../kernel/registry';
import type { Step } from '../kernel/script';
import type { Derived, Param, Readable } from '../kernel/state';
import type { L10n } from '../kernel/text';

export interface Prediction<V> {
  /** The id the lesson hears it by (an answer's item). */
  id: string;
  /** What is being guessed, in both languages (the mirror, the tutor's history). */
  says: L10n;
  /** 0 asked, 1 committed (then it stays until a replay: a seek back undoes it). */
  committed: Param<number>;
  /** The learner's answer: what the hand is making while asked, what it let go of after. */
  guessed: Readable<V>;
  /** How far off, in the value's units (signed where that means something: short or long). */
  error: Derived<number>;
  /** Within the tolerance. */
  right: Derived<boolean>;
  /** Run when the learner commits: the figure reveals the truth its own way. */
  on_commit(f: () => void): void;
  /** A script step naming its params, so a seek or a replay puts the prediction back (the first step of its figure). */
  fresh(...more: Param<number>[]): Step;
}

/** A gesture as a registry entry: `make` builds its Prediction in a figure (its signature is the gesture's own). */
export interface GestureEntry extends Entry {
  kind: 'gesture';
  make?: (...args: never[]) => Prediction<unknown>;
}
export function define_gesture(e: Omit<GestureEntry, 'kind'>): GestureEntry {
  return define({ ...e, kind: 'gesture' } as GestureEntry);
}
