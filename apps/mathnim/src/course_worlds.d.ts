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

// ---- the drawing kit (used by lesson_worlds.ts to draw a lesson's world from its description)
export type V3 = [number, number, number];
export type Pigment = [number, number, number];
export interface Solid { pts: V3[]; c: V3; faces: unknown[]; [k: string]: unknown }
export interface SolidStyle { pig?: string; k?: number; tint?: number; kind?: 'model' | 'wire'; solid?: number; alpha?: number; shadow?: boolean; bias?: number; shade?: number }
export interface Cam { s: number; ox: number; oy: number; shadow?: number; p(q: V3): [number, number, number]; raw(q: V3): [number, number, number] }
export const PIG: Record<string, Pigment>;
export const DPR: number;
export const RM: boolean;
export function css(c: Pigment, a?: number): string;
export function lerp(a: number, b: number, t: number): number;
export function clamp(x: number, a: number, b: number): number;
export function poly(ctx: CanvasRenderingContext2D, pts: number[][], close?: boolean): () => void;
export function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): () => void;
export function stroke_ink(ctx: CanvasRenderingContext2D, path: () => void, pigment: Pigment, w: number, alpha?: number): void;
export function stroke_prov(ctx: CanvasRenderingContext2D, path: () => void, pigment: Pigment, k: number, w: number, alpha?: number): void;
export function ring_dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pigment: Pigment, k: number, w?: number): void;
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pigment: Pigment, size?: number, weight?: number, align?: CanvasTextAlign, base?: CanvasTextBaseline, alpha?: number): void;
export function dim2(ctx: CanvasRenderingContext2D, p: number[], q: number[], text: string, off?: number, alpha?: number): void;
export function extrude(base: V3[], off: V3, o?: SolidStyle): Solid;
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o?: SolidStyle): Solid;
export function obox(cx: number, cz: number, len: number, wid: number, y0: number, y1: number, ang: number, o?: SolidStyle): Solid;
export function cylinder_y(cx: number, cz: number, r: number, y0: number, y1: number, n: number, o?: SolidStyle): Solid;
export function turned(top?: number, front?: boolean): Cam;
export function with_shadows(pts: V3[]): V3[];
export function fit(cam: Cam, pts: V3[], x: number, y: number, w: number, h: number, scale_cap?: number): Cam;
export function render(ctx: CanvasRenderingContext2D, cam: Cam, solids: Solid[], ground?: (() => void) | null): void;
