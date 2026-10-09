// manim/constants.py
import type { Point3D } from './utils/vector';

const v = (x: number, y: number, z: number): Point3D => Object.freeze([x, y, z]) as unknown as Point3D;

export const NORMAL = 'NORMAL';
export const ITALIC = 'ITALIC';
export const OBLIQUE = 'OBLIQUE';
export const BOLD = 'BOLD';
export const THIN = 'THIN';
export const ULTRALIGHT = 'ULTRALIGHT';
export const LIGHT = 'LIGHT';
export const SEMILIGHT = 'SEMILIGHT';
export const BOOK = 'BOOK';
export const MEDIUM = 'MEDIUM';
export const SEMIBOLD = 'SEMIBOLD';
export const ULTRABOLD = 'ULTRABOLD';
export const HEAVY = 'HEAVY';
export const ULTRAHEAVY = 'ULTRAHEAVY';

/** PIL resampling filters used by ImageMobject (values are PIL's Resampling constants). */
export const RESAMPLING_ALGORITHMS: Readonly<Record<string, number>> = Object.freeze({ nearest: 0, none: 0, bilinear: 2, linear: 2, bicubic: 3, cubic: 3 });

export const ORIGIN = v(0, 0, 0);
export const UP = v(0, 1, 0);
export const DOWN = v(0, -1, 0);
export const RIGHT = v(1, 0, 0);
export const LEFT = v(-1, 0, 0);
export const IN = v(0, 0, -1);
export const OUT = v(0, 0, 1);
export const X_AXIS = v(1, 0, 0);
export const Y_AXIS = v(0, 1, 0);
export const Z_AXIS = v(0, 0, 1);
export const UL = v(-1, 1, 0);
export const UR = v(1, 1, 0);
export const DL = v(-1, -1, 0);
export const DR = v(1, -1, 0);

export const START_X = 30;
export const START_Y = 20;
export const DEFAULT_DOT_RADIUS = 0.08;
export const DEFAULT_SMALL_DOT_RADIUS = 0.04;
export const DEFAULT_DASH_LENGTH = 0.05;
export const DEFAULT_ARROW_TIP_LENGTH = 0.35;
export const SMALL_BUFF = 0.1;
export const MED_SMALL_BUFF = 0.25;
export const MED_LARGE_BUFF = 0.5;
export const LARGE_BUFF = 1;
export const DEFAULT_MOBJECT_TO_EDGE_BUFFER = MED_LARGE_BUFF;
export const DEFAULT_MOBJECT_TO_MOBJECT_BUFFER = MED_SMALL_BUFF;
export const DEFAULT_POINTWISE_FUNCTION_RUN_TIME = 3.0;
export const DEFAULT_WAIT_TIME = 1.0;
export const DEFAULT_POINT_DENSITY_2D = 25;
export const DEFAULT_POINT_DENSITY_1D = 10;
export const DEFAULT_STROKE_WIDTH = 4;
export const DEFAULT_FONT_SIZE = 48;
export const SCALE_FACTOR_PER_FONT_POINT = 1 / 960;

export const PI = Math.PI;
export const TAU = 2 * PI;
export const DEGREES = TAU / 360;

export const QUALITIES = {
  fourk_quality: { flag: 'k', pixel_height: 2160, pixel_width: 3840, frame_rate: 60 },
  production_quality: { flag: 'p', pixel_height: 1440, pixel_width: 2560, frame_rate: 60 },
  high_quality: { flag: 'h', pixel_height: 1080, pixel_width: 1920, frame_rate: 60 },
  medium_quality: { flag: 'm', pixel_height: 720, pixel_width: 1280, frame_rate: 30 },
  low_quality: { flag: 'l', pixel_height: 480, pixel_width: 854, frame_rate: 15 },
  example_quality: { flag: null, pixel_height: 480, pixel_width: 854, frame_rate: 30 },
} as const;
export const DEFAULT_QUALITY = 'high_quality';

/** A member of a Python-style enum: `.name`, `.value`, compares by value (`+member`). */
export class EnumMember {
  constructor(readonly name: string, readonly value: number) {}
  valueOf(): number {
    return this.value;
  }
  toString(): string {
    return this.name;
  }
}
/** Python `enum.Enum`: members as properties, iterable in definition order, `len()` works. */
function py_enum<K extends string>(values: Record<K, number>): Readonly<Record<K, EnumMember>> & Iterable<EnumMember> & { readonly length: number; __len__(): number } {
  const members = Object.entries(values).map(([k, v]) => new EnumMember(k, v as number));
  const e: any = Object.fromEntries(members.map((m) => [m.name, m]));
  Object.defineProperties(e, {
    [Symbol.iterator]: { value: () => members[Symbol.iterator]() },
    length: { value: members.length },
    __len__: { value: () => members.length },
  });
  return Object.freeze(e);
}
export const LineJointType = py_enum({ AUTO: 0, ROUND: 1, BEVEL: 2, MITER: 3 });
export type LineJointType = EnumMember;
export const CapStyleType = py_enum({ AUTO: 0, ROUND: 1, BUTT: 2, SQUARE: 3 });
export type CapStyleType = EnumMember;
