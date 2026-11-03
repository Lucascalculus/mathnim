// What a step's figure plays on: a manim-web Scene (ScenePlayer) or an engine Figure (FigurePlayer). Both players
// have the same surface (load, play, seek, wait_for, show_end, start_live …), so the runtime, the view, export and the
// tools take either; only where they differ - the hand (Interaction for a scene, FigureUI for a figure), a theme
// applied to a scene's camera, the canvas's size - do they look at which one it is.
import type { Scene } from 'manim-web';
import { Interaction } from 'manim-web/ext/interact';
import { ScenePlayer, type PlayerOptions } from 'manim-web/ext/player';
import { FigurePlayer, FigureUI, is_figure, is_figure_player, type Figure, type FigurePlayerOptions } from '@mathnim/engine';

export type Stage = Scene | Figure;
export type StagePlayer = ScenePlayer | FigurePlayer;
export type StageUI = Interaction | FigureUI;
export { is_figure, is_figure_player };

/** The player for a stage. */
export function make_player(stage: Stage, canvas: HTMLCanvasElement | OffscreenCanvas, opts: PlayerOptions & FigurePlayerOptions = {}): StagePlayer {
  return is_figure(stage) ? new FigurePlayer(stage, canvas, opts as FigurePlayerOptions) : new ScenePlayer(stage as Scene, canvas, opts as PlayerOptions);
}
/** The controls of an explore step (or an explorable embedded visual). */
export function make_ui(p: StagePlayer): StageUI {
  return is_figure_player(p) ? new FigureUI(p) : new Interaction(p);
}
/** A figure's player gives its canvas back as it found it (the next player may be a scene's). */
export function release_player(p: StagePlayer | null): void {
  if (p && is_figure_player(p)) p.release();
}
export const is_engine_ui = (ui: unknown): ui is FigureUI => !!ui && typeof ui === 'object' && (ui as { engine?: boolean }).engine === true;
