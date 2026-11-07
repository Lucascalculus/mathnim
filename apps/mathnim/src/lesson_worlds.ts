// A lesson's world: its picture, drawn in the specimen's study-model style (course_worlds.js: white plaster forms, one
// camera, one high light, ink). Each lesson's picture is its own drawing, hand-made for its idea, in
// src/worlds/<course>/<lesson id>.ts: content of the lesson, not of the site. The site only finds it (by the file's
// name) and shows it: seen from straight above at rest, turning into the world while the hand is on its card. A lesson
// with no drawing keeps its old picture; removing the file removes the picture.
//
// A drawing: `export default { view?, draw(ctx, w, h, st) }`, where st.top is the camera's turn (1 straight above, the
// plan; 0 the world) and st.lang the language. What the turn means is the lesson's to say (a plan that becomes what
// happened, a floor that rises into a wall...): `turn(st)` is 0 at rest and 1 in the world.
import type { Lang } from '@mathnim/core';
import { follower, redraw, setup } from './course_worlds';

export interface WorldState { top: number; lang: Lang }
export interface LessonWorld {
  /** Seen at rest from straight above ('plan', the default) or straight from the front ('front', for what stands up). */
  view?: 'plan' | 'front';
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, st: WorldState): void;
}
/** How far the camera has turned into the world (0 at rest, the plan; 1 the world). */
export const turn = (st: WorldState): number => 1 - st.top;
/** The words in the language shown. */
export const say = (st: WorldState, en: string, zh: string): string => (st.lang === 'zh' ? zh : en);

// every drawing, found by its file name (files starting with _ are a course's shared pieces, not lessons)
const FILES = import.meta.glob<{ default: LessonWorld }>(['./worlds/*/*.ts', '!./worlds/*/_*.ts']);
const BY_LESSON = new Map(Object.entries(FILES).map(([path, load]) => [path.replace(/^.*\/([^/]+)\.ts$/, '$1'), load]));

/** Every lesson that has a world of its own (for the worlds sheet, worlds.html). */
export const world_ids = (): string[] => [...BY_LESSON.keys()].sort();
/** Whether a lesson has a world of its own. */
export const has_world = (lesson_id: string): boolean => BY_LESSON.has(lesson_id);
/** A lesson's world (loaded when first asked for). */
export async function load_world(lesson_id: string): Promise<LessonWorld | null> {
  const load = BY_LESSON.get(lesson_id);
  return load ? (await load()).default : null;
}

/**
 * Show a world on a canvas: from straight above at rest, the camera turning down into the world over 0.9 s while the
 * pointer is on `hand` (the card) and back when it leaves. Drawn when it changes, never in a loop; the canvas keeps the
 * size the page gives it, only its pixels follow.
 */
export function mount_world(cv: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D, w: number, h: number, top: number) => void, hand: HTMLElement): void {
  let w = 0, h = 0, ctx: CanvasRenderingContext2D | null = null, top = 1;
  const paint = () => {
    const r = cv.getBoundingClientRect();
    if (r.width < 8) return;
    if (Math.round(r.width) !== w || Math.round(r.height) !== h) {
      w = Math.round(r.width); h = Math.round(r.height) || Math.round((w * 9) / 16); ctx = setup(cv, w, h);
      cv.style.width = ''; cv.style.height = '';
    }
    ctx!.clearRect(0, 0, w, h);
    draw(ctx!, w, h, top);
  };
  const cam = follower(1, () => { top = cam.v; redraw(paint); });
  hand.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') cam.set(0, 900); });
  hand.addEventListener('pointerleave', () => cam.set(1, 700));
  new ResizeObserver(() => redraw(paint)).observe(cv);
  redraw(paint);
}

/** Every lesson canvas under root (canvas[data-lesson]) whose lesson has a world: marked .world and drawn as it. */
export function draw_lesson_worlds(root: ParentNode, lang: Lang): void {
  for (const cv of root.querySelectorAll<HTMLCanvasElement>('canvas[data-lesson]')) {
    const id = cv.dataset.lesson!;
    if (!has_world(id)) continue;
    cv.classList.add('world');
    void load_world(id).then((wd) => {
      if (!wd || !cv.isConnected) return;
      mount_world(cv, (ctx, w, h, top) => wd.draw(ctx, w, h, { top, lang }), cv.closest<HTMLElement>('a, article, .card') ?? cv);
    });
  }
}
