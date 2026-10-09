// manim/_config (the parts that matter for rendering). One global `config`,
// like manim's; use `tempconfig({...}, fn)` for scoped overrides.
import { ManimColor, type ParsableManimColor } from './utils/color/core';

export class ManimConfig {
  pixel_width = 1920;
  pixel_height = 1080;
  frame_rate = 60;
  frame_height = 8.0;
  private _frame_width: number | null = null;
  background_color: ManimColor = ManimColor.parse('#000000');
  background_opacity = 1;
  renderer = 'canvas';
  preview = true;
  disable_caching = true;
  media_dir = '';
  /** Whether z_index is used to sort mobjects when drawing. */
  use_z_index = true;

  get aspect_ratio(): number {
    return this.pixel_width / this.pixel_height;
  }
  get frame_width(): number {
    return this._frame_width ?? this.frame_height * this.aspect_ratio;
  }
  set frame_width(w: number) {
    this._frame_width = w;
  }
  get frame_size(): [number, number] {
    return [this.pixel_width, this.pixel_height];
  }
  get frame_x_radius(): number {
    return this.frame_width / 2;
  }
  get frame_y_radius(): number {
    return this.frame_height / 2;
  }
  get top(): [number, number, number] {
    return [0, this.frame_y_radius, 0];
  }
  get bottom(): [number, number, number] {
    return [0, -this.frame_y_radius, 0];
  }
  get left_side(): [number, number, number] {
    return [-this.frame_x_radius, 0, 0];
  }
  get right_side(): [number, number, number] {
    return [this.frame_x_radius, 0, 0];
  }
  set_background(c: ParsableManimColor): void {
    this.background_color = ManimColor.parse(c);
  }
  copy(): ManimConfig {
    const c = new ManimConfig();
    Object.assign(c, this);
    return c;
  }
  update(values: Partial<Record<string, unknown>>): void {
    for (const [k, v] of Object.entries(values)) {
      if (k === 'background_color') this.background_color = ManimColor.parse(v as ParsableManimColor);
      else (this as any)[k] = v;
    }
  }
}

export const config = new ManimConfig();

/** Run `fn` with temporary config overrides (manim's `with tempconfig(...)`). */
export function tempconfig<T>(values: Record<string, unknown>, fn: () => T): T {
  const saved = config.copy();
  config.update(values);
  try {
    return fn();
  } finally {
    Object.assign(config, saved);
  }
}
