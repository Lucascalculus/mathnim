// manim/animation/changing.py
import { VGroup, VMobject } from '../mobject/types/vectorized_mobject';
import { BLUE_B, BLUE_D, BLUE_E, GREY_BROWN } from '../utils/color/manim_colors';
import type { ParsableManimColor } from '../utils/color/core';
import { pyargs } from '../utils/pyargs';
import { smooth, type RateFunction } from '../utils/rate_functions';
import type { Point3DLike } from '../utils/vector';
import type { Mobject } from '../mobject/mobject';

/** A boundary that keeps redrawing itself in cycling colours. */
export class AnimatedBoundary extends VGroup {
  declare colors: ParsableManimColor[];
  declare max_stroke_width: number;
  declare cycle_rate: number;
  declare back_and_forth: boolean;
  declare draw_rate_func: RateFunction;
  declare fade_rate_func: RateFunction;
  declare vmobject: VMobject;
  declare boundary_copies: VMobject[];
  declare total_time: number;
  constructor(vmobject: VMobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['colors', 'max_stroke_width', 'cycle_rate', 'back_and_forth', 'draw_rate_func', 'fade_rate_func'], {
      colors: [BLUE_D, BLUE_B, BLUE_E, GREY_BROWN], max_stroke_width: 3, cycle_rate: 0.5, back_and_forth: true, draw_rate_func: smooth, fade_rate_func: smooth,
    });
    const { colors, max_stroke_width, cycle_rate, back_and_forth, draw_rate_func, fade_rate_func, ...kw } = o;
    super(kw);
    Object.assign(this, { colors, max_stroke_width, cycle_rate, back_and_forth, draw_rate_func, fade_rate_func, vmobject });
    this.boundary_copies = [0, 1].map(() => vmobject.copy().set_style({ stroke_width: 0, fill_opacity: 0 }));
    this.add(...this.boundary_copies);
    this.total_time = 0.0;
    this.add_updater((_m: Mobject, dt: number) => this.update_boundary_copies(dt));
  }
  update_boundary_copies(dt: number): void {
    const time = this.total_time * this.cycle_rate;
    const [growing, fading] = this.boundary_copies;
    const colors = this.colors, msw = this.max_stroke_width;
    const index = Math.trunc(time % colors.length);
    const alpha = time % 1;
    const draw = this.draw_rate_func(alpha), fade = this.fade_rate_func(alpha);
    const bounds: [number, number] = this.back_and_forth && Math.trunc(time) % 2 === 1 ? [1.0 - draw, 1.0] : [0.0, draw];
    this.full_family_become_partial(growing, this.vmobject, ...bounds);
    growing.set_stroke(colors[index], msw);
    if (time >= 1) {
      this.full_family_become_partial(fading, this.vmobject, 0, 1);
      fading.set_stroke({ color: colors[(index - 1 + colors.length) % colors.length], width: (1 - fade) * msw });
    }
    this.total_time += dt;
  }
  full_family_become_partial(mob1: VMobject, mob2: VMobject, a: number, b: number): this {
    const f1 = mob1.family_members_with_points() as VMobject[], f2 = mob2.family_members_with_points() as VMobject[];
    for (let i = 0; i < Math.min(f1.length, f2.length); i++) f1[i].pointwise_become_partial(f2[i], a, b);
    return this;
  }
}

/** Traces the path of a point over time (optionally fading old parts). */
export class TracedPath extends VMobject {
  declare traced_point_func: () => Point3DLike;
  declare dissipating_time: number | null;
  declare time: number | null;
  constructor(traced_point_func: () => Point3DLike, ...rest: unknown[]) {
    const o = pyargs(rest, ['stroke_width', 'stroke_color', 'dissipating_time'], { stroke_width: 2, stroke_color: '#FFFFFF', dissipating_time: null });
    const { dissipating_time, ...kw } = o;
    super(kw);
    this.traced_point_func = traced_point_func;
    this.dissipating_time = dissipating_time;
    this.time = dissipating_time ? 1.0 : null;
    this.add_updater((m: Mobject, dt: number) => this.update_path(m, dt));
  }
  update_path(_mob: Mobject, dt: number): void {
    const p = this.traced_point_func();
    if (!this.has_points()) this.start_new_path(p);
    this.add_line_to(p);
    if (this.dissipating_time) {
      this.time = (this.time ?? 0) + dt;
      if (this.time - 1 > this.dissipating_time) this.set_points(this.points.slice(3 * this.n_points_per_curve));
    }
  }
}
