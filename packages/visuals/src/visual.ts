// The contract for a visual component: a parametric, pre-verified explanation
// scene. Authored lessons and AI answers both use visuals; the AI only picks a
// visual and fills in its parameters, which is fast and cannot break the layout.
import type { Scene } from 'manim-web';
import type { Interaction } from 'manim-web/ext/interact';

/** One parameter. `doc` is shown to the AI in the catalog. */
export type ParamSpec =
  | { type: 'number'; min: number; max: number; default: number; doc: string }
  | { type: 'integer'; min: number; max: number; default: number; doc: string }
  | { type: 'boolean'; default: boolean; doc: string }
  | { type: 'enum'; values: string[]; default: string; doc: string }
  /** A point or vector, e.g. [x, y]. */
  | { type: 'vector'; length: number; min: number; max: number; default: number[]; doc: string }
  /** Row-major, e.g. [[a, b], [c, d]]. */
  | { type: 'matrix'; rows: number; cols: number; min: number; max: number; default: number[][]; doc: string }
  | { type: 'text'; max_length: number; default: string; doc: string };

export type Params = Record<string, unknown>;
export type ParamSpecs<P extends Params> = { [K in keyof P & string]: ParamSpec };

export interface Visual<P extends Params = Params> {
  /** snake_case, unique, e.g. 'linear_map'. */
  name: string;
  /** One line for the AI catalog: what it shows and what the student can do with it. */
  summary: string;
  /** Tags used to narrow the catalog, e.g. ['linear algebra', 'determinant']. */
  topics: string[];
  params: ParamSpecs<P>;
  /** Parameter sets that must pass the layout checks (the doctor renders each). */
  examples?: Partial<P>[];
  /** The explanation as a scene (8-30 s); it stays on screen when it ends. */
  scene(p: P): Scene;
  /** Handles and sliders added to the finished scene. */
  explore?(scene: Scene, ui: Interaction, p: P): void;
  /** Names of objects the scene exposes (for highlighting and scene descriptions). */
  ids?: string[];
}

/** Helper that keeps the parameter types of a visual. */
export function define_visual<P extends Params>(v: Visual<P>): Visual<P> {
  return v;
}
