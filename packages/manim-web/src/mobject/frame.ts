// manim/mobject/frame.py
import { config } from '../_config';
import { pyargs } from '../utils/pyargs';
import { register } from '../utils/registry';
import { Rectangle } from './geometry/polygram';

/** A rectangle with the aspect ratio of the screen (16:9 by default). */
export class ScreenRectangle extends Rectangle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['aspect_ratio', 'height'], { aspect_ratio: 16.0 / 9.0, height: 4 });
    const { aspect_ratio, height, ...kw } = o;
    super({ ...kw, width: aspect_ratio * height, height });
  }
  get aspect_ratio(): number {
    return this.width / this.height;
  }
  set aspect_ratio(value: number) {
    this.stretch_to_fit_width(value * this.height);
  }
}

/** A ScreenRectangle as tall as the frame. */
export class FullScreenRectangle extends ScreenRectangle {
  constructor(kw: Record<string, unknown> = {}) {
    super(kw);
    this.height = config.frame_height;
  }
}

register({ ScreenRectangle });
