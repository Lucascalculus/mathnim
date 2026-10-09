// Minimal typings for the parts of opentype.js (1.3.x) used by the text engine.
declare module 'opentype.js' {
  export interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }
  export interface GlyphPoint {
    x: number;
    y: number;
    onCurve: boolean;
    lastPointOfContour: boolean;
  }
  export interface Glyph {
    index: number;
    name?: string;
    unicode?: number;
    advanceWidth: number;
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    points?: GlyphPoint[];
    path: { commands: PathCommand[] };
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    outlinesFormat: 'truetype' | 'cff';
    names: Record<string, Record<string, string> | undefined>;
    tables: Record<string, any>;
    glyphs: { length: number; get(i: number): Glyph };
    kerningPairs: Record<string, number>;
    position: { defaultKerningTables?: unknown[]; getKerningValue(tables: unknown[], l: number, r: number): number };
    substitution: { getLigatures(feature: string, script?: string, language?: string): { sub: number[]; by: number }[] };
    charToGlyphIndex(c: string): number;
    getKerningValue(l: number, r: number): number;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
