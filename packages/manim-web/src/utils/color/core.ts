// manim/utils/color/core.py
//
// web: Python distinguishes float RGB (0..1) from int RGB (0..255) by element
// type. JavaScript has one number type, so an array with any component > 1 is
// read as 0..255 and anything else as 0..1.

export type FloatRGB = [number, number, number];
export type FloatRGBA = [number, number, number, number];
export type ParsableManimColor = ManimColor | string | number | readonly number[] | { get_hex(): string };

const RE_HEX = /(?:#|0x)([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/;
const NAMED: Map<string, ManimColor> = new Map();

/** Register named colours so `ManimColor('BLUE')` works (done by manim_colors.ts). */
export function _registerColorNames(entries: Record<string, ManimColor>): void {
  for (const [k, v] of Object.entries(entries)) NAMED.set(k.toUpperCase(), v);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export class ManimColor {
  /** RGBA, floats in 0..1 (manim's `_internal_value`). */
  _internal_value: FloatRGBA;

  constructor(value?: ParsableManimColor | null, alpha = 1.0) {
    if (value === null || value === undefined) {
      this._internal_value = [0, 0, 0, alpha];
    } else if (value instanceof ManimColor) {
      this._internal_value = [...value._internal_value] as FloatRGBA;
    } else if (typeof value === 'number') {
      this._internal_value = ManimColor._internal_from_integer(value, alpha);
    } else if (typeof value === 'string') {
      const m = RE_HEX.exec(value);
      this._internal_value = m ? ManimColor._internal_from_hex_string(m[1], alpha) : ManimColor._internal_from_string(value, alpha);
    } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      const arr = Array.from(value as ArrayLike<number>);
      const isInt = arr.some((x) => x > 1);
      if (arr.length === 3) this._internal_value = isInt ? [arr[0] / 255, arr[1] / 255, arr[2] / 255, alpha] : [arr[0], arr[1], arr[2], alpha];
      else if (arr.length === 4) this._internal_value = isInt ? (arr.map((x) => x / 255) as FloatRGBA) : (arr as FloatRGBA);
      else throw new Error(`ManimColor only accepts lists/tuples/arrays of length 3 or 4, not ${arr.length}`);
    } else if (typeof (value as any).get_hex === 'function') {
      const m = RE_HEX.exec((value as any).get_hex());
      if (!m) throw new Error(`Failed to parse a color from ${value}`);
      this._internal_value = ManimColor._internal_from_hex_string(m[1], alpha);
    } else {
      throw new TypeError(`ManimColor cannot parse ${String(value)}`);
    }
  }

  static _internal_from_integer(value: number, alpha: number): FloatRGBA {
    return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255, alpha];
  }
  static _internal_from_hex_string(hex: string, alpha: number): FloatRGBA {
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6) hex += 'FF';
    else if (hex.length === 8) alpha = (parseInt(hex, 16) & 0xff) / 255;
    else throw new Error('Hex colors must contain 6 or 8 hexadecimal numbers');
    const tmp = parseInt(hex, 16) >>> 0;
    return [((tmp >>> 24) & 0xff) / 255, ((tmp >>> 16) & 0xff) / 255, ((tmp >>> 8) & 0xff) / 255, alpha];
  }
  static _internal_from_string(name: string, alpha: number): FloatRGBA {
    const c = NAMED.get(name.toUpperCase());
    if (!c) throw new Error(`Color ${name} not found`);
    return [c._internal_value[0], c._internal_value[1], c._internal_value[2], alpha];
  }

  to_integer(): number {
    const [r, g, b] = this.to_int_rgb();
    return (r << 16) + (g << 8) + b;
  }
  to_rgb(): FloatRGB {
    return [this._internal_value[0], this._internal_value[1], this._internal_value[2]];
  }
  to_int_rgb(): FloatRGB {
    return this.to_rgb().map((x) => Math.trunc(x * 255)) as FloatRGB;
  }
  to_rgba(): FloatRGBA {
    return [...this._internal_value] as FloatRGBA;
  }
  to_int_rgba(): FloatRGBA {
    return this._internal_value.map((x) => Math.trunc(x * 255)) as FloatRGBA;
  }
  to_rgba_with_alpha(alpha: number): FloatRGBA {
    return [...this.to_rgb(), alpha];
  }
  to_int_rgba_with_alpha(alpha: number): FloatRGBA {
    return [...this.to_int_rgb(), Math.trunc(alpha * 255)];
  }
  to_hex(with_alpha = false): string {
    const h = (x: number) => Math.trunc(x * 255).toString(16).toUpperCase().padStart(2, '0');
    const v = this._internal_value;
    return '#' + h(v[0]) + h(v[1]) + h(v[2]) + (with_alpha ? h(v[3]) : '');
  }
  to_hsv(): FloatRGB {
    return rgbToHsv(...this.to_rgb());
  }
  to_hsl(): FloatRGB {
    const [h, l, s] = rgbToHls(...this.to_rgb());
    return [h, s, l];
  }
  invert(with_alpha = false): ManimColor {
    const v = this._internal_value;
    return new ManimColor([1 - v[0], 1 - v[1], 1 - v[2], with_alpha ? 1 - v[3] : v[3]]);
  }
  interpolate(other: ManimColor, alpha: number): ManimColor {
    const a = this._internal_value, b = other._internal_value;
    return ManimColor._from_rgba(a.map((x, i) => x * (1 - alpha) + b[i] * alpha) as FloatRGBA);
  }
  darker(blend = 0.2): ManimColor {
    return this.interpolate(new ManimColor('#000000'), blend).opacity(this._internal_value[3]);
  }
  lighter(blend = 0.2): ManimColor {
    return this.interpolate(new ManimColor('#FFFFFF'), blend).opacity(this._internal_value[3]);
  }
  contrasting(threshold = 0.5, light?: ManimColor, dark?: ManimColor): ManimColor {
    const [r, g, b] = this.to_rgb();
    const luminance = 0.3 * r + 0.59 * g + 0.11 * b; // colorsys.rgb_to_yiq Y
    if (luminance < threshold) return light ?? new ManimColor('#FFFFFF');
    return dark ?? new ManimColor('#000000');
  }
  opacity(opacity: number): ManimColor {
    const v = this.to_rgba();
    v[3] = opacity;
    return ManimColor._from_rgba(v);
  }
  static _from_rgba(v: FloatRGBA): ManimColor {
    const c = Object.create(ManimColor.prototype) as ManimColor;
    c._internal_value = [...v] as FloatRGBA;
    return c;
  }
  static from_rgb(rgb: readonly number[], alpha = 1.0): ManimColor {
    return new ManimColor(rgb, alpha);
  }
  static from_rgba(rgba: readonly number[]): ManimColor {
    return new ManimColor(rgba);
  }
  static from_hex(hex: string, alpha = 1.0): ManimColor {
    return new ManimColor(hex, alpha);
  }
  static from_hsv(hsv: readonly number[], alpha = 1.0): ManimColor {
    return ManimColor._from_rgba([...hsvToRgb(hsv[0], hsv[1], hsv[2]), alpha]);
  }
  static from_hsl(hsl: readonly number[], alpha = 1.0): ManimColor {
    return ManimColor._from_rgba([...hlsToRgb(hsl[0], hsl[2], hsl[1]), alpha]);
  }
  /** Parse one colour, or a list of colours, into ManimColor(s). */
  static parse(color: ParsableManimColor | null | undefined, alpha?: number): ManimColor;
  static parse(color: readonly ParsableManimColor[], alpha?: number): ManimColor[];
  static parse(color: any, alpha = 1.0): any {
    if (Array.isArray(color) && color.length > 0 && typeof color[0] !== 'number') return color.map((c) => ManimColor.parse(c, alpha));
    if (color instanceof ManimColor && alpha === 1.0) return color;
    return new ManimColor(color, alpha);
  }
  static gradient(colors: ParsableManimColor[], length: number): ManimColor[] {
    return color_gradient(colors, length);
  }
  equals(other: ManimColor): boolean {
    return this._internal_value.every((x, i) => Math.abs(x - other._internal_value[i]) <= 1e-8 + 1e-5 * Math.abs(other._internal_value[i]));
  }
  toString(): string {
    return this.to_hex();
  }
  /** CSS rgba() string, used by renderers. */
  to_css(alpha = this._internal_value[3]): string {
    const v = this._internal_value;
    return `rgba(${Math.round(clamp01(v[0]) * 255)},${Math.round(clamp01(v[1]) * 255)},${Math.round(clamp01(v[2]) * 255)},${clamp01(alpha)})`;
  }
}

/** Hue/saturation/value colour (manim's HSV subclass). */
export class HSV extends ManimColor {
  constructor(hsv: readonly number[], alpha = 1.0) {
    super(hsvToRgb(hsv[0], hsv[1], hsv[2]), alpha);
  }
  get hue(): number { return this.to_hsv()[0]; }
  get saturation(): number { return this.to_hsv()[1]; }
  get value(): number { return this.to_hsv()[2]; }
}

// ---------------------------------------------------------------- colorsys
function rgbToHsv(r: number, g: number, b: number): FloatRGB {
  const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
  const v = maxc;
  if (minc === maxc) return [0, 0, v];
  const s = (maxc - minc) / maxc;
  const rc = (maxc - r) / (maxc - minc), gc = (maxc - g) / (maxc - minc), bc = (maxc - b) / (maxc - minc);
  let h = r === maxc ? bc - gc : g === maxc ? 2 + rc - bc : 4 + gc - rc;
  h = (((h / 6) % 1) + 1) % 1;
  return [h, s, v];
}
function hsvToRgb(h: number, s: number, v: number): FloatRGB {
  if (s === 0) return [v, v, v];
  let i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  i %= 6;
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as FloatRGB[])[(i + 6) % 6];
}
function rgbToHls(r: number, g: number, b: number): FloatRGB {
  const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
  const l = (minc + maxc) / 2;
  if (minc === maxc) return [0, l, 0];
  const s = l <= 0.5 ? (maxc - minc) / (maxc + minc) : (maxc - minc) / (2 - maxc - minc);
  const rc = (maxc - r) / (maxc - minc), gc = (maxc - g) / (maxc - minc), bc = (maxc - b) / (maxc - minc);
  let h = r === maxc ? bc - gc : g === maxc ? 2 + rc - bc : 4 + gc - rc;
  h = (((h / 6) % 1) + 1) % 1;
  return [h, l, s];
}
function hlsToRgb(h: number, l: number, s: number): FloatRGB {
  if (s === 0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  const v = (hue: number) => {
    hue = ((hue % 1) + 1) % 1;
    if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6;
    if (hue < 0.5) return m2;
    if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
    return m1;
  };
  return [v(h + 1 / 3), v(h), v(h - 1 / 3)];
}

// ---------------------------------------------------------------- module functions
export const color_to_rgb = (c: ParsableManimColor): FloatRGB => new ManimColor(c).to_rgb();
export const color_to_rgba = (c: ParsableManimColor, alpha = 1.0): FloatRGBA => new ManimColor(c).to_rgba_with_alpha(alpha);
export const color_to_int_rgb = (c: ParsableManimColor): FloatRGB => new ManimColor(c).to_int_rgb();
export const color_to_int_rgba = (c: ParsableManimColor, alpha = 1.0): FloatRGBA => new ManimColor(c).to_int_rgba_with_alpha(alpha);
export const rgb_to_color = (rgb: readonly number[]): ManimColor => ManimColor.from_rgb(rgb);
export const rgba_to_color = (rgba: readonly number[]): ManimColor => ManimColor.from_rgba(rgba);
export const rgb_to_hex = (rgb: readonly number[]): string => ManimColor.from_rgb(rgb).to_hex();
export const hex_to_rgb = (hex: string): FloatRGB => new ManimColor(hex).to_rgb();
export const invert_color = (c: ManimColor): ManimColor => c.invert();
export const interpolate_color = (c1: ParsableManimColor, c2: ParsableManimColor, alpha: number): ManimColor =>
  ManimColor.parse(c1).interpolate(ManimColor.parse(c2), alpha);

export function color_gradient(reference: readonly ParsableManimColor[], length: number): ManimColor[] {
  if (length === 0) return [];
  const parsed = reference.map((c) => ManimColor.parse(c));
  if (parsed.length === 0) throw new Error('Expected 1 or more reference colors. Got 0 colors.');
  if (parsed.length === 1) return Array.from({ length }, () => parsed[0]);
  const rgbs = parsed.map((c) => c.to_rgb());
  const n = parsed.length;
  const out: ManimColor[] = [];
  for (let k = 0; k < length; k++) {
    const a = length === 1 ? 0 : ((n - 1) * k) / (length - 1);
    let i = Math.trunc(a);
    let m = a % 1;
    if (k === length - 1) {
      i = n - 2;
      m = 1;
    }
    out.push(rgb_to_color(rgbs[i].map((x, j) => x * (1 - m) + rgbs[i + 1][j] * m)));
  }
  return out;
}

export function average_color(...colors: ParsableManimColor[]): ManimColor {
  const rgbs = colors.map(color_to_rgb);
  return rgb_to_color([0, 1, 2].map((j) => rgbs.reduce((s, c) => s + c[j], 0) / rgbs.length));
}

let _allManimColors: ManimColor[] = [];
export function _setAllManimColors(list: ManimColor[]): void {
  _allManimColors = list;
}

/** Picks colours from a list, optionally with a seed (manim's RandomColorGenerator). */
export class RandomColorGenerator {
  private colors: ManimColor[];
  private rnd: () => number;
  constructor(seed: number | null = null, sample_colors: ManimColor[] | null = null) {
    this.colors = sample_colors ?? _allManimColors;
    if (seed === null) this.rnd = Math.random;
    else {
      let s = seed >>> 0 || 1;
      this.rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    }
  }
  next(): ManimColor {
    return this.colors[Math.floor(this.rnd() * this.colors.length)];
  }
  private static _singleton: RandomColorGenerator | null = null;
  static _random_color(): ManimColor {
    if (!this._singleton) this._singleton = new RandomColorGenerator();
    return this._singleton.next();
  }
}
export const random_color = (): ManimColor => RandomColorGenerator._random_color();
export function random_bright_color(): ManimColor {
  const c = color_to_rgb(random_color());
  return new ManimColor(c.map((x) => 0.5 * (x + 1)));
}

export function get_shaded_rgb(rgb: FloatRGB, point: readonly number[], unit_normal: readonly number[], light_source: readonly number[]): FloatRGB {
  const d = [light_source[0] - point[0], light_source[1] - point[1], light_source[2] - point[2]];
  const n = Math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2) || 1;
  const toSun = d.map((x) => x / n);
  let light = 0.5 * (unit_normal[0] * toSun[0] + unit_normal[1] * toSun[1] + unit_normal[2] * toSun[2]) ** 3;
  if (light < 0) light *= 0.5;
  return rgb.map((x) => x + light) as FloatRGB;
}
