// Types for course_worlds.js (each course's world, drawn on a canvas; the home page's course pictures).
/** What a world is drawn with: the camera turned to straight above (top 1) or the 3D view (0), each unit learned (0..1). */
export interface WorldState {
  lang?: string;
  top?: number;
  hover?: number;
  parts?: number[];
  pad?: [number, number, number, number];
  dims?: boolean;
}
export type World = (ctx: CanvasRenderingContext2D, w: number, h: number, st: WorldState) => unknown;
export const WORLDS: Record<string, World>;
export function setup(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D;
export function follower(v: number, paint: () => void): { v: number; to: number; set(to: number, dur?: number): void };
export function redraw(f: () => void): void;
