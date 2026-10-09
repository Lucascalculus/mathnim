// Checking parameters that come from a model: fill defaults, coerce what can be
// coerced, clamp numbers into range, and report everything that was changed or
// rejected (the report goes back to the model when it has to try again).
import type { ParamSpec, Params, Visual } from './visual';

export interface ParamCheck<P extends Params = Params> {
  ok: boolean;
  params: P;
  /** Adjustments that were made (clamped, rounded, defaulted). */
  notes: string[];
  /** Problems that could not be fixed (unknown parameter, wrong type). */
  errors: string[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)) return +v;
  return null;
}

function check_one(key: string, spec: ParamSpec, raw: unknown, notes: string[], errors: string[]): unknown {
  if (raw === undefined || raw === null) return spec.default;
  switch (spec.type) {
    case 'number':
    case 'integer': {
      let x = num(raw);
      if (x === null) {
        errors.push(`${key}: expected a number, got ${JSON.stringify(raw)}`);
        return spec.default;
      }
      if (spec.type === 'integer' && !Number.isInteger(x)) {
        notes.push(`${key}: rounded ${x} to ${Math.round(x)}`);
        x = Math.round(x);
      }
      const c = clamp(x, spec.min, spec.max);
      if (c !== x) notes.push(`${key}: ${x} is outside [${spec.min}, ${spec.max}], used ${c}`);
      return c;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 'false') return raw === 'true';
      errors.push(`${key}: expected true or false`);
      return spec.default;
    case 'enum':
      if (typeof raw === 'string' && spec.values.includes(raw)) return raw;
      errors.push(`${key}: expected one of ${spec.values.join(', ')}`);
      return spec.default;
    case 'text': {
      const s = String(raw);
      if (s.length > spec.max_length) notes.push(`${key}: shortened to ${spec.max_length} characters`);
      return s.slice(0, spec.max_length);
    }
    case 'vector': {
      if (!Array.isArray(raw) || raw.length !== spec.length || raw.some((x) => num(x) === null)) {
        errors.push(`${key}: expected ${spec.length} numbers`);
        return spec.default;
      }
      return raw.map((x, i) => {
        const v = num(x)!, c = clamp(v, spec.min, spec.max);
        if (c !== v) notes.push(`${key}[${i}]: ${v} is outside [${spec.min}, ${spec.max}], used ${c}`);
        return c;
      });
    }
    case 'matrix': {
      const shape_ok = Array.isArray(raw) && raw.length === spec.rows && raw.every((r) => Array.isArray(r) && r.length === spec.cols && r.every((x) => num(x) !== null));
      if (!shape_ok) {
        errors.push(`${key}: expected a ${spec.rows}x${spec.cols} matrix of numbers (rows first)`);
        return spec.default;
      }
      return (raw as unknown[][]).map((r, i) => r.map((x, j) => {
        const v = num(x)!, c = clamp(v, spec.min, spec.max);
        if (c !== v) notes.push(`${key}[${i}][${j}]: ${v} is outside [${spec.min}, ${spec.max}], used ${c}`);
        return c;
      }));
    }
  }
}

/** Check raw parameters (e.g. parsed from a model's JSON) against a visual's specs. */
export function check_params<P extends Params>(v: Visual<P>, raw: Record<string, unknown> = {}): ParamCheck<P> {
  const notes: string[] = [], errors: string[] = [];
  const out: Params = {};
  for (const [k, spec] of Object.entries(v.params) as [string, ParamSpec][]) out[k] = check_one(k, spec, raw[k], notes, errors);
  for (const k of Object.keys(raw)) if (!(k in v.params)) errors.push(`${k}: ${v.name} has no such parameter`);
  return { ok: errors.length === 0, params: out as P, notes, errors };
}

/** Compact text for one parameter, e.g. `A: matrix 2x2 in [-3, 3], default [[1,1],[0,1]] - the matrix`. */
export function describe_param(key: string, s: ParamSpec): string {
  const d = JSON.stringify(s.default);
  switch (s.type) {
    case 'number':
    case 'integer':
      return `${key}: ${s.type} in [${s.min}, ${s.max}] =${d} - ${s.doc}`;
    case 'vector':
      return `${key}: ${s.length} numbers in [${s.min}, ${s.max}] =${d} - ${s.doc}`;
    case 'matrix':
      return `${key}: ${s.rows}x${s.cols} matrix in [${s.min}, ${s.max}] =${d} - ${s.doc}`;
    case 'enum':
      return `${key}: one of ${s.values.join('|')} =${d} - ${s.doc}`;
    case 'boolean':
      return `${key}: boolean =${d} - ${s.doc}`;
    case 'text':
      return `${key}: text (max ${s.max_length}) =${d} - ${s.doc}`;
  }
}
