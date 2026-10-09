// manim/animation/specialized.py
import { ORIGIN } from '../constants';
import type { Mobject } from '../mobject/mobject';
import { pyargs } from '../utils/pyargs';
import { LaggedStart } from './composition';
import { Restore } from './transform';

/** Copies of a mobject expand outward from a focal point, like a ripple. */
export class Broadcast extends LaggedStart {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['focal_point', 'n_mobs', 'initial_opacity', 'final_opacity', 'initial_width', 'remover', 'lag_ratio', 'run_time'], {
      focal_point: ORIGIN, n_mobs: 5, initial_opacity: 1, final_opacity: 0, initial_width: 0.0, remover: true, lag_ratio: 0.2, run_time: 3,
    });
    const { focal_point, n_mobs, initial_opacity, final_opacity, initial_width, remover, lag_ratio, run_time, ...kw } = o;
    const anims = [];
    const fill_o = Boolean((mobject as any).fill_opacity);
    for (let i = 0; i < n_mobs; i++) {
      const mob: any = mobject.copy();
      if (fill_o) mob.set_opacity(final_opacity);
      else mob.set_stroke({ opacity: final_opacity });
      mob.move_to(focal_point);
      mob.save_state();
      mob.set({ width: initial_width });
      if (fill_o) mob.set_opacity(initial_opacity);
      else mob.set_stroke({ opacity: initial_opacity });
      anims.push(new Restore(mob, { remover }));
    }
    super(...anims, { run_time, lag_ratio, ...kw });
  }
}
