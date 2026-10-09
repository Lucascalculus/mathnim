// Compile and run model-written scene code against manim-web. Shared by the
// sandbox worker (validation) and the answer card (display).
import * as M from 'manim-web';
import type { Interaction } from 'manim-web/ext/interact';
import { ScenePlayer, preload } from 'manim-web/ext/player';
import { C } from './palette';

export interface AnswerModule {
  Answer: new () => M.Scene;
  setup: ((scene: M.Scene, ui: Interaction) => void) | null;
}
const NAMES = Object.keys(M).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== 'default');

/** Evaluate the code; it must define `class Answer extends Scene` (and may define `setup(scene, ui)`). */
export function compile_answer(code: string): AnswerModule {
  const body = `"use strict";\nconst { ${NAMES.join(', ')} } = M;\n${code}\n;return { Answer: typeof Answer !== 'undefined' ? Answer : null, setup: typeof setup === 'function' ? setup : null };`;
  const mod = new Function('M', 'C', body)(M, C) as AnswerModule;
  if (!mod.Answer) throw new Error('The code must define `class Answer extends Scene { construct() { ... } }`.');
  return mod;
}

/** Build a player for compiled code on a canvas (records the timeline). */
export async function load_answer(mod: AnswerModule, canvas: HTMLCanvasElement | OffscreenCanvas, on_player?: (p: ScenePlayer) => void): Promise<ScenePlayer> {
  await preload();
  const scene = new mod.Answer();
  const player = new ScenePlayer(scene, canvas, { audio: false });
  on_player?.(player);
  await player.load();
  return player;
}

/** Check numeric claims: each `expr` (a JS expression using Math) must equal `value`. */
export function run_checks(checks: { label: string; value: number; expr: string }[] = []): { label: string; ok: boolean; got: number | string; value: number }[] {
  return checks.map((c) => {
    try {
      const got = Number(new Function('Math', `"use strict"; return (${c.expr});`)(Math));
      const ok = Math.abs(got - c.value) <= 1e-3 * Math.max(1, Math.abs(c.value));
      return { label: c.label, ok, got, value: c.value };
    } catch (e) {
      return { label: c.label, ok: false, got: String((e as Error).message), value: c.value };
    }
  });
}
