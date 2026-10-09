// Python semantics for code transpiled by tools/py2js.py (web extension).
//
// Values map as: int/float -> number, str -> string, list/tuple -> PyList (an
// Array subclass), numpy arrays -> plain (nested) arrays, dict -> plain object,
// None -> null, complex -> Complex. Operators go through the helpers below so
// `UP + LEFT` adds vectors while `[a] + [b]` concatenates lists.
import { Group, Mobject } from '../../mobject/mobject';
import { Complex, toComplex } from '../../utils/complex';
import { callable } from '../../utils/callable';
import { toList, fromList } from '../../utils/points';
import { isKwargs, KW } from '../../utils/pyargs';

// ---------------------------------------------------------------- core types
/** A Python list or tuple. */
export class PyList<T = any> extends Array<T> {}
export const L = <T>(...items: T[]): PyList<T> => {
  const l = new PyList<T>();
  for (const x of items) l.push(x);
  return l;
};
export const toPyList = <T>(it: Iterable<T> | ArrayLike<T>): PyList<T> => {
  const l = new PyList<T>();
  for (const x of iter(it) as Iterable<T>) l.push(x);
  return l;
};
/** Keyword arguments at a call site. */
export { KW };
export function kw<T extends object>(o: T): T {
  Object.defineProperty(o, KW, { value: true, enumerable: false });
  return o;
}
export const REQ = Symbol('required');
/** A slice `a:b:c`. */
export class Slice {
  constructor(public start: number | null, public stop: number | null, public step: number | null) {}
  indices(n: number): [number, number, number] {
    const step = this.step ?? 1;
    const norm = (x: number | null, d: number, lo: number, hi: number) => (x === null ? d : x < 0 ? Math.max(lo, x + n) : Math.min(x, hi));
    if (step > 0) return [norm(this.start, 0, 0, n), norm(this.stop, n, 0, n), step];
    return [norm(this.start, n - 1, -1, n - 1), norm(this.stop, -1, -1, n - 1), step];
  }
}
export const slice = (a: number | null = null, b: number | null = null, c: number | null = null) => new Slice(a, b, c);
/** A multi-axis index `x[i, j]`. */
export class IndexTuple extends Array<any> {}
export const T = (...items: any[]): IndexTuple => {
  const t = new IndexTuple();
  for (const x of items) t.push(x);
  return t;
};

export class PyError extends Error {
  constructor(public pytype: string, message: string) {
    super(`${pytype}: ${message}`);
  }
}
const typeError = (m: string) => new PyError('TypeError', m);

// ---------------------------------------------------------------- arguments
const isPlain = (x: unknown): x is Record<string, any> => isKwargs(x);

/**
 * Resolve Python parameters. `spec` names each parameter: `a` positional,
 * `*args`, `!k` keyword-only, `**kw`. A trailing object is keyword arguments
 * when tagged by kw() or when it cannot be a positional argument.
 */
export function params(args: ArrayLike<unknown>, spec: readonly string[], defaults: readonly unknown[]): any[] {
  const a = Array.from(args);
  let k: Record<string, any> = {};
  const nPos = spec.filter((s) => !s.startsWith('*') && !s.startsWith('!')).length;
  const hasStar = spec.some((s) => s.startsWith('*') && !s.startsWith('**'));
  const hasKw = spec.some((s) => s.startsWith('**'));
  if (a.length) {
    const last = a[a.length - 1] as any;
    if (last && typeof last === 'object' && (last[KW] || (isPlain(last) && a.length > nPos && (!hasStar || hasKw)))) {
      k = { ...last };
      a.pop();
    }
  }
  const out: any[] = [];
  let i = 0;
  spec.forEach((s, idx) => {
    if (s.startsWith('**')) {
      out.push(kw(k));
      k = {};
      return;
    }
    if (s.startsWith('*')) {
      out.push(toPyList(a.slice(i)));
      i = a.length;
      return;
    }
    const kwOnly = s.startsWith('!');
    const name = kwOnly ? s.slice(1) : s;
    if (!kwOnly && i < a.length) {
      out.push(a[i++]);
      return;
    }
    if (name in k) {
      out.push(k[name]);
      delete k[name];
      return;
    }
    if (defaults[idx] === REQ) throw typeError(`missing required argument: '${name}'`);
    out.push(defaults[idx]);
  });
  if (i < a.length) throw typeError(`takes ${nPos} positional arguments but ${a.length} were given`);
  const extra = Object.keys(k);
  if (extra.length && !spec.some((s) => s.startsWith('**'))) throw typeError(`got an unexpected keyword argument '${extra[0]}'`);
  return out;
}

// ---------------------------------------------------------------- truthiness, comparison
export function truthy(x: unknown): boolean {
  if (x === null || x === undefined) return false;
  if (typeof x === 'boolean') return x;
  if (typeof x === 'number') return x !== 0 && !Number.isNaN(x);
  if (typeof x === 'string') return x.length > 0;
  if (Array.isArray(x)) return x.length > 0;
  if (x instanceof Map || x instanceof Set) return x.size > 0;
  if (x instanceof Complex) return x.re !== 0 || x.im !== 0;
  if (typeof x === 'object' && typeof (x as any).__bool__ === 'function') return !!(x as any).__bool__();
  if (isPlain(x)) return Object.keys(x).length > 0;
  return true;
}
export const not = (x: unknown) => !truthy(x);
export const or = (a: unknown, b: () => unknown) => (truthy(a) ? a : b());
export const and = (a: unknown, b: () => unknown) => (truthy(a) ? b() : a);

const isNumArray = (x: unknown): boolean => {
  if (!Array.isArray(x)) return ArrayBuffer.isView(x);
  if (x.length === 0) return !(x instanceof PyList);
  const f = x[0];
  return typeof f === 'number' || typeof f === 'boolean' || f instanceof Complex || (Array.isArray(f) && isNumArray(f));
};
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a instanceof Complex || b instanceof Complex) return toComplex(a).re === toComplex(b).re && toComplex(a).im === toComplex(b).im;
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  if (a && typeof a.__eq__ === 'function') return !!a.__eq__(b);
  return false;
}
/** `==`: elementwise for numpy arrays, structural for lists, identity for objects. */
export function eq(a: any, b: any): any {
  if (typeof a === 'number' || typeof a === 'string' || a === null || a === undefined || typeof a === 'boolean') {
    if (Array.isArray(b) && !(b instanceof PyList)) return bc(a, b, (x, y) => x === y);
    if (b instanceof Complex) return deepEqual(a, b);
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b) && (a instanceof PyList || b instanceof PyList) && !(isNumArray(a) && !(a instanceof PyList)) && !(isNumArray(b) && !(b instanceof PyList))) return deepEqual(a, b);
  if (Array.isArray(a) && (!(a instanceof PyList) || (Array.isArray(b) && !(b instanceof PyList)))) {
    if (a instanceof PyList && b instanceof PyList) return deepEqual(a, b);
    return bc(a, b, (x, y) => x === y);
  }
  return deepEqual(a, b);
}
export const ne = (a: any, b: any): any => {
  const r = eq(a, b);
  return Array.isArray(r) ? bc(r, false, (x: any) => !x) : !r;
};
export function lt(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b) && (a instanceof PyList || b instanceof PyList)) return cmpSeq(a, b) < 0;
  if (Array.isArray(a) || Array.isArray(b)) return bc(a, b, (x, y) => x < y);
  return a < b;
}
export function le(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b) && (a instanceof PyList || b instanceof PyList)) return cmpSeq(a, b) <= 0;
  if (Array.isArray(a) || Array.isArray(b)) return bc(a, b, (x, y) => x <= y);
  return a <= b;
}
export const gt = (a: any, b: any): any => lt(b, a);
export const ge = (a: any, b: any): any => le(b, a);
function cmpSeq(a: any[], b: any[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (deepEqual(a[i], b[i])) continue;
    return lt(a[i], b[i]) ? -1 : 1;
  }
  return a.length - b.length;
}
export function contains(container: any, item: any): boolean {
  if (typeof container === 'string') return container.includes(item);
  if (Array.isArray(container)) return container.some((x) => deepEqual(x, item) || x === item);
  if (container instanceof Map || container instanceof Set) return container.has(item);
  if (container instanceof Mobject) return [...container].includes(item);
  if (container && typeof container.__contains__ === 'function') return !!container.__contains__(item);
  if (container && typeof container === 'object') return Object.prototype.hasOwnProperty.call(container, item);
  throw typeError(`argument of type '${typeName(container)}' is not iterable`);
}

// ---------------------------------------------------------------- arithmetic
function depth(x: any): number {
  let d = 0;
  while (Array.isArray(x) || ArrayBuffer.isView(x)) {
    d++;
    x = (x as any)[0];
  }
  return d;
}
const arr = (x: any): any[] => (ArrayBuffer.isView(x) ? Array.from(x as any) : x);
/** numpy broadcasting of `f` over nested arrays. */
export function bc(a: any, b: any, f: (x: any, y: any) => any): any {
  const aa = Array.isArray(a) || ArrayBuffer.isView(a), ba = Array.isArray(b) || ArrayBuffer.isView(b);
  if (!aa && !ba) return f(a, b);
  if (aa && !ba) return arr(a).map((x) => bc(x, b, f));
  if (!aa && ba) return arr(b).map((y) => bc(a, y, f));
  const A = arr(a), B = arr(b);
  const da = depth(A), db = depth(B);
  if (da > db) return A.map((x) => bc(x, B, f));
  if (db > da) return B.map((y) => bc(A, y, f));
  if (A.length === B.length) return A.map((x, i) => bc(x, B[i], f));
  if (A.length === 1) return B.map((y) => bc(A[0], y, f));
  if (B.length === 1) return A.map((x) => bc(x, B[0], f));
  throw new PyError('ValueError', `operands could not be broadcast together with shapes (${A.length},) (${B.length},)`);
}
export const map1 = (a: any, f: (x: any) => any): any => (Array.isArray(a) || ArrayBuffer.isView(a) ? arr(a).map((x) => map1(x, f)) : f(a));

const cplx = (a: any, b: any) => a instanceof Complex || b instanceof Complex;
const isSeqConcat = (a: any, b: any) => Array.isArray(a) && Array.isArray(b) && ((a instanceof PyList && b instanceof PyList) || !isNumArray(a) || !isNumArray(b));
const numOp = (a: any, b: any, f: (x: number, y: number) => number, cf?: (x: Complex, y: any) => Complex) =>
  bc(a, b, (x, y) => (cf && cplx(x, y) ? cf(toComplex(x), y) : f(x, y)));

export function add(a: any, b: any): any {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  if (isSeqConcat(a, b)) return toPyList([...a, ...b]);
  if (a instanceof Mobject && typeof (a as any).__add__ === 'function') return (a as any).__add__(b);
  if (a instanceof Mobject && b instanceof Mobject) return new (a.get_group_class())(a, b);
  if (a && typeof a.__add__ === 'function' && !(a instanceof Complex)) return a.__add__(b);
  if (b && typeof b.__radd__ === 'function') return b.__radd__(a);
  return numOp(a, b, (x, y) => x + y, (x, y) => x.add(y));
}
export function sub(a: any, b: any): any {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Mobject && b instanceof Mobject && typeof (a as any).__sub__ !== 'function') {
    const g = new (a.get_group_class())(...a.submobjects);
    g.remove(b);
    return g;
  }
  if (a instanceof Mobject && typeof (a as any).__sub__ === 'function') return (a as any).__sub__(b);
  if (a && typeof a.__sub__ === 'function' && !(a instanceof Complex)) return a.__sub__(b);
  if (a instanceof Set && b instanceof Set) return new Set([...a].filter((x) => !b.has(x)));
  return numOp(a, b, (x, y) => x - y, (x, y) => x.sub(y));
}
export function mul(a: any, b: any): any {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
  if (typeof b === 'string' && typeof a === 'number') return b.repeat(Math.max(0, a));
  if (a instanceof PyList && typeof b === 'number') return toPyList(Array.from({ length: Math.max(0, b) }, () => a).flat(1));
  if (b instanceof PyList && typeof a === 'number') return mul(b, a);
  if (a && typeof a.__mul__ === 'function' && !(a instanceof Complex)) return a.__mul__(b);
  if (b && typeof b.__rmul__ === 'function') return b.__rmul__(a);
  return numOp(a, b, (x, y) => x * y, (x, y) => x.mul(y));
}
export function div(a: any, b: any): any {
  if (typeof a === 'number' && typeof b === 'number') {
    if (b === 0) throw new PyError('ZeroDivisionError', 'division by zero');
    return a / b;
  }
  if (a && typeof a.__truediv__ === 'function' && !(a instanceof Complex)) return a.__truediv__(b);
  return numOp(a, b, (x, y) => x / y, (x, y) => x.div(y));
}
export const floordiv = (a: any, b: any): any => (a && typeof a.__floordiv__ === 'function' ? a.__floordiv__(b) : numOp(a, b, (x, y) => Math.floor(x / y)));
const inplace = (name: string, op: (a: any, b: any) => any) => (a: any, b: any): any => (a && typeof a[name] === 'function' ? a[name](b) : op(a, b));
export function mod(a: any, b: any): any {
  if (typeof a === 'string') return percentFormat(a, b);
  if (a && typeof a.__mod__ === 'function') return a.__mod__(b);
  return numOp(a, b, (x, y) => {
    const r = x % y;
    return r !== 0 && r < 0 !== y < 0 ? r + y : r;
  });
}
export const pow = (a: any, b: any): any => (a && typeof a.__pow__ === 'function' && !(a instanceof Complex) ? a.__pow__(b) : numOp(a, b, (x, y) => x ** y, (x, y) => x.pow(y)));
export const itruediv = inplace('__itruediv__', (a, b) => div(a, b));
export const ifloordiv = inplace('__ifloordiv__', (a, b) => floordiv(a, b));
export const imod = inplace('__imod__', (a, b) => mod(a, b));
export const ipow = inplace('__ipow__', (a, b) => pow(a, b));
export function neg(a: any): any {
  if (typeof a === 'number') return -a;
  if (a instanceof Complex) return a.neg();
  if (a && typeof a.__neg__ === 'function') return a.__neg__();
  return map1(a, (x) => (x instanceof Complex ? x.neg() : -x));
}
export const pos = (a: any): any => a;
export const invert = (a: any): any => map1(a, (x) => (typeof x === 'boolean' ? !x : ~x));
export const bitand = (a: any, b: any): any => (a instanceof Set ? new Set([...a].filter((x) => b.has(x))) : bc(a, b, (x, y) => (typeof x === 'boolean' ? x && y : x & y)));
export const bitor = (a: any, b: any): any => (a instanceof Set ? new Set([...a, ...b]) : isPlain(a) ? { ...a, ...b } : bc(a, b, (x, y) => (typeof x === 'boolean' ? x || y : x | y)));
export const bitxor = (a: any, b: any): any => bc(a, b, (x, y) => (typeof x === 'boolean' ? x !== y : x ^ y));
export const lshift = (a: any, b: any): any => bc(a, b, (x, y) => x * 2 ** y);
export const rshift = (a: any, b: any): any => bc(a, b, (x, y) => Math.floor(x / 2 ** y));
export function matmul(a: any, b: any): any {
  if (a && typeof a.__matmul__ === 'function') return a.__matmul__(b);
  if (b && typeof b.__rmatmul__ === 'function') return b.__rmatmul__(a);
  const A: any[] = arr(a).map(arr), B: any[] = arr(b).map((r: any) => (Array.isArray(r) || ArrayBuffer.isView(r) ? arr(r) : r));
  const aVec = !Array.isArray(A[0]), bVec = !Array.isArray(B[0]);
  if (aVec && bVec) return A.reduce((s: number, x: any, i: number) => s + x * B[i], 0);
  if (!aVec && bVec) return A.map((row: number[]) => row.reduce((s, x, i) => s + x * B[i], 0));
  if (aVec && !bVec) return B[0].map((_: number, j: number) => A.reduce((s: number, x: any, i: number) => s + x * B[i][j], 0));
  return A.map((row: number[]) => B[0].map((_: number, j: number) => row.reduce((s, x, i) => s + x * B[i][j], 0)));
}
/** Augmented assignment: lists and mobject groups mutate in place. */
export function iadd(a: any, b: any): any {
  if (a && typeof a.__iadd__ === 'function') return a.__iadd__(b);
  if (a instanceof PyList && Array.isArray(b) && isSeqConcat(a, b)) {
    for (const x of b) a.push(x);
    return a;
  }
  if (a instanceof Mobject && b instanceof Mobject) {
    if (typeof (a as any).__iadd__ === 'function') return (a as any).__iadd__(b);
    return a.add(b);
  }
  return add(a, b);
}
export function isub(a: any, b: any): any {
  if (a && typeof a.__isub__ === 'function') return a.__isub__(b);
  if (a instanceof Mobject && b instanceof Mobject) return a.remove(b);
  return sub(a, b);
}
export function imul(a: any, b: any): any {
  if (a && typeof a.__imul__ === 'function') return a.__imul__(b);
  if (a instanceof PyList && typeof b === 'number') {
    const copy = a.slice();
    a.length = 0;
    for (let i = 0; i < b; i++) for (const x of copy) a.push(x);
    return a;
  }
  return mul(a, b);
}

// ---------------------------------------------------------------- items and attributes
const normIndex = (i: number, n: number) => {
  const k = i < 0 ? i + n : i;
  if (k < 0 || k >= n) throw new PyError('IndexError', 'index out of range');
  return k;
};
function sliceSeq<T>(seq: ArrayLike<T>, s: Slice): T[] {
  const [start, stop, step] = s.indices(seq.length);
  const out: T[] = [];
  if (step > 0) for (let k = start; k < stop; k += step) out.push(seq[k]);
  else for (let k = start; k > stop; k += step) out.push(seq[k]);
  return out;
}
function ndIndex(a: any, keys: any[]): any {
  if (!keys.length) return a;
  const [k, ...rest] = keys;
  if (k instanceof Slice) return sliceSeq(arr(a), k).map((row) => ndIndex(row, rest));
  if (Array.isArray(k)) return k.map((i) => ndIndex(arr(a)[normIndex(i, a.length)], rest));
  return ndIndex(arr(a)[normIndex(k, a.length)], rest);
}
export function getitem(obj: any, key: any): any {
  if (obj instanceof Mobject) {
    if (key instanceof Slice) return obj.get_slice(key.start, key.stop, key.step ?? 1);
    if (typeof (obj as any).__getitem__ === 'function') return (obj as any).__getitem__(key);
    if (typeof key === 'number') return obj.get(key);
    if (Array.isArray(key)) return new (obj.get_group_class())(...key.map((i: number) => obj.get(i)));
    return (obj as any).get(key);
  }
  if (typeof obj === 'string') {
    if (key instanceof Slice) return sliceSeq(obj.split(''), key).join('');
    return obj[normIndex(key, obj.length)];
  }
  if (Array.isArray(obj) || ArrayBuffer.isView(obj)) {
    if (key instanceof IndexTuple) return ndIndex(obj, [...key]);
    if (key instanceof Slice) {
      const r = sliceSeq(obj as any, key);
      return obj instanceof PyList ? toPyList(r) : r;
    }
    if (Array.isArray(key)) {
      if (key.length && typeof key[0] === 'boolean') return arr(obj).filter((_: any, i: number) => key[i]);
      return key.map((i: number) => (obj as any)[normIndex(i, (obj as any).length)]);
    }
    if (typeof key !== 'number') throw typeError('list indices must be integers or slices');
    return (obj as any)[normIndex(key, (obj as any).length)];
  }
  if (obj instanceof Map) {
    if (!obj.has(key)) throw new PyError('KeyError', String(key));
    return obj.get(key);
  }
  if (obj && typeof obj.__getitem__ === 'function') return obj.__getitem__(key);
  if (obj && typeof obj === 'object') {
    if (!(key in obj)) throw new PyError('KeyError', repr(key));
    return obj[key];
  }
  throw typeError(`'${typeName(obj)}' object is not subscriptable`);
}
export function setitem(obj: any, key: any, value: any): void {
  if (obj instanceof Mobject) {
    if (typeof (obj as any).__setitem__ === 'function') return void (obj as any).__setitem__(key, value);
    if (typeof (obj as any).set_item === 'function') return void (obj as any).set_item(key, value);
    obj.submobjects[normIndex(key, obj.submobjects.length)] = value;
    return;
  }
  if (Array.isArray(obj) || ArrayBuffer.isView(obj)) {
    if (key instanceof IndexTuple) {
      const [k, ...rest] = key;
      const rows = k instanceof Slice ? sliceIdx((obj as any).length, k) : [normIndex(k, (obj as any).length)];
      for (const r of rows) {
        if (rest.length === 1 && !(rest[0] instanceof Slice)) (obj as any)[r][normIndex(rest[0], (obj as any)[r].length)] = value;
        else setitem((obj as any)[r], rest.length === 1 ? rest[0] : T(...rest), value);
      }
      return;
    }
    if (key instanceof Slice) {
      const idx = sliceIdx((obj as any).length, key);
      if ((key.step ?? 1) === 1 && Array.isArray(value) && Array.isArray(obj)) {
        obj.splice(idx.length ? idx[0] : key.indices(obj.length)[0], idx.length, ...value);
      } else idx.forEach((i, j) => ((obj as any)[i] = Array.isArray(value) ? value[j] : value));
      return;
    }
    (obj as any)[normIndex(key, (obj as any).length)] = value;
    return;
  }
  if (obj instanceof Map) return void obj.set(key, value);
  if (obj && typeof obj.__setitem__ === 'function') return void obj.__setitem__(key, value);
  obj[key] = value;
}
const sliceIdx = (n: number, s: Slice) => sliceSeq(Array.from({ length: n }, (_, i) => i), s);
export function delitem(obj: any, key: any): void {
  if (Array.isArray(obj)) {
    if (key instanceof Slice) {
      const idx = new Set(sliceIdx(obj.length, key));
      const keep = obj.filter((_, i) => !idx.has(i));
      obj.length = 0;
      obj.push(...keep);
    } else obj.splice(normIndex(key, obj.length), 1);
  } else if (obj instanceof Map) obj.delete(key);
  else if (obj instanceof Mobject) obj.remove(obj.get(key));
  else delete obj[key];
}

const boundCache = new WeakMap<object, Map<string, Function>>();
/** `obj.name` as a value: methods come back bound (and identical each time), like Python. */
export function bound(obj: any, name: string): any {
  if (obj === null || obj === undefined) throw new PyError('AttributeError', `'NoneType' object has no attribute '${name}'`);
  const v = obj[name];
  if (typeof v !== 'function' || v.prototype !== undefined || (v as any).__self__ !== undefined || name === 'animate' || name === 'always') {
    if (v === undefined && !(name in Object(obj))) return pyattr(obj, name);
    return v;
  }
  // `Cls.method` / `Cls.prototype.method` is the plain function in Python too
  if (typeof obj === 'function' || (obj.constructor && obj.constructor.prototype === obj)) return v;
  let m = boundCache.get(obj);
  if (!m) boundCache.set(obj, (m = new Map()));
  const cached = m.get(name) as any;
  if (cached && cached.__func__ === v) return cached;
  const b: any = v.bind(obj);
  b.__self__ = obj;
  b.__name__ = name;
  b.__func__ = v;
  if ((v as any).time_based !== undefined) b.time_based = (v as any).time_based;
  m.set(name, b);
  return b;
}
/** Attributes of Python built-in values that JS values spell differently. */
function pyattr(obj: any, name: string): any {
  if (name === '__dict__') return obj;
  if (name === '__name__') return typeof obj === 'function' ? obj.__name__ ?? obj.name : undefined;
  if (name === '__class__') return obj?.constructor;
  if (name === '__doc__') return null;
  if (obj instanceof Complex) {
    if (name === 'real') return obj.re;
    if (name === 'imag') return obj.im;
  }
  if (typeof obj === 'number') {
    if (name === 'real') return obj;
    if (name === 'imag') return 0;
  }
  if (Array.isArray(obj) || ArrayBuffer.isView(obj)) {
    if (name === 'T') return transpose(obj);
    if (name === 'shape') return toPyList(shape(obj));
    if (name === 'size') return shape(obj).reduce((a, b) => a * b, 1);
    if (name === 'ndim') return depth(obj);
    if (name === 'real') return map1(obj, (x) => (x instanceof Complex ? x.re : x));
    if (name === 'imag') return map1(obj, (x) => (x instanceof Complex ? x.im : 0));
  }
  return undefined;
}
export function shape(a: any): number[] {
  const s: number[] = [];
  let x = a;
  while (Array.isArray(x) || ArrayBuffer.isView(x)) {
    s.push((x as any).length);
    x = (x as any)[0];
  }
  return s;
}
export const transpose = (a: any): any => {
  const A = arr(a).map(arr);
  if (!Array.isArray(A[0])) return A;
  return A[0].map((_: any, j: number) => A.map((r: any) => r[j]));
};
/** getattr for attribute loads that may need translation (points, numpy attrs). */
export function getattr(obj: any, name: string, dflt?: any): any {
  if (obj instanceof Mobject && name === 'points') return toList(obj.points);
  const v = bound(obj, name);
  if (v === undefined && !(obj !== null && typeof obj === 'object' && name in obj)) {
    if (arguments.length > 2) return dflt;
    throw new PyError('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`);
  }
  return v;
}
export function setattr(obj: any, name: string, value: any): void {
  if (obj instanceof Mobject && name === 'points') {
    obj.points = Array.isArray(value) ? fromList(value.length && !Array.isArray(value[0]) ? [value] : value) : value;
    return;
  }
  obj[name] = value;
}
export const hasattr = (obj: any, name: string): boolean => obj !== null && obj !== undefined && (name in Object(obj) || pyattr(obj, name) !== undefined);
export const delattr = (obj: any, name: string): void => void delete obj[name];

// ---------------------------------------------------------------- iteration
export function iter(x: any): Iterable<any> {
  if (x === null || x === undefined) throw typeError(`'NoneType' object is not iterable`);
  if (typeof x === 'string' || Array.isArray(x) || ArrayBuffer.isView(x)) return x as Iterable<any>;
  if (x instanceof Map) return x.keys();
  if (typeof x[Symbol.iterator] === 'function') return x;
  if (typeof x.__iter__ === 'function') return x.__iter__();
  if (isPlain(x)) return Object.keys(x);
  throw typeError(`'${typeName(x)}' object is not iterable`);
}
export function len(x: any): number {
  if (typeof x === 'string' || Array.isArray(x) || ArrayBuffer.isView(x)) return (x as any).length;
  if (x instanceof Map || x instanceof Set) return x.size;
  if (x instanceof Mobject) return typeof (x as any).__len__ === 'function' ? (x as any).__len__() : [...x].length;
  if (x && typeof x.__len__ === 'function') return x.__len__();
  if (isPlain(x)) return Object.keys(x).length;
  throw typeError(`object of type '${typeName(x)}' has no len()`);
}

// ---------------------------------------------------------------- str / repr / format
export function typeName(x: any): string {
  if (x === null || x === undefined) return 'NoneType';
  if (typeof x === 'number') return Number.isInteger(x) ? 'int' : 'float';
  if (typeof x === 'string') return 'str';
  if (typeof x === 'boolean') return 'bool';
  if (x instanceof PyList) return 'list';
  if (Array.isArray(x)) return 'ndarray';
  if (isPlain(x)) return 'dict';
  return x.constructor?.name ?? 'object';
}
export function repr(x: any): string {
  if (typeof x === 'string') return `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return str(x, true);
}
export function str(x: any, inner = false): string {
  if (x === null || x === undefined) return 'None';
  if (x === true) return 'True';
  if (x === false) return 'False';
  if (typeof x === 'number') {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
    return String(x).replace(/e([+-])(\d)$/, 'e$10$2');
  }
  if (typeof x === 'string') return inner ? repr(x) : x;
  if (x instanceof Complex) return `(${str(x.re)}${x.im >= 0 ? '+' : '-'}${str(Math.abs(x.im))}j)`;
  if (x instanceof PyList) return `[${x.map((v) => repr(v)).join(', ')}]`;
  if (Array.isArray(x) || ArrayBuffer.isView(x)) return `[${arr(x).map((v) => str(v, true)).join(' ')}]`;
  if (isPlain(x)) return `{${Object.entries(x).map(([k, v]) => `${repr(k)}: ${repr(v)}`).join(', ')}}`;
  if (typeof x.__str__ === 'function') return x.__str__();
  if (typeof x === 'function') return x.prototype && /^class\b/.test(Function.prototype.toString.call(x)) ? `<class '${x.name}'>` : `<function ${x.__name__ ?? x.name}>`;
  return String(x);
}
/** Python's format mini-language: `format(3.14159, '.2f')`. */
export function format(v: any, spec = ''): string {
  if (!spec) return str(v);
  const m = /^(?:(.)?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/.exec(spec);
  if (!m) return str(v);
  let [, fill, align, sign, , zero, width, group, prec, type] = m;
  let s: string;
  const p = prec === undefined ? undefined : +prec;
  if (typeof v === 'number') {
    const a = Math.abs(v);
    switch (type) {
      case 'f': case 'F': s = a.toFixed(p ?? 6); break;
      case 'e': case 'E': s = a.toExponential(p ?? 6).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') s = s.toUpperCase(); break;
      case '%': s = (a * 100).toFixed(p ?? 6) + '%'; break;
      case 'd': case 'n': s = String(Math.round(a)); break;
      case 'x': s = Math.round(a).toString(16); break;
      case 'X': s = Math.round(a).toString(16).toUpperCase(); break;
      case 'o': s = Math.round(a).toString(8); break;
      case 'b': s = Math.round(a).toString(2); break;
      case 'g': case 'G': default:
        if (p === undefined && !type) s = str(a);
        else {
          const P = p === 0 ? 1 : p ?? 6;
          const exp = a === 0 ? 0 : Math.floor(Math.log10(a));
          s = exp < -4 || exp >= P ? a.toExponential(P - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2') : String(+a.toPrecision(P));
        }
    }
    if (group) {
      const [ip, fp] = s.split('.');
      s = ip.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (fp !== undefined ? '.' + fp : '');
    }
    const neg = v < 0 || Object.is(v, -0);
    const sg = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
    if (zero && !align) {
      fill = '0';
      align = '=';
    }
    s = sg + s;
    if (align === '=' && width && s.length < +width) return sg + (fill ?? ' ').repeat(+width - s.length) + s.slice(sg.length);
  } else {
    s = str(v);
    if (p !== undefined) s = s.slice(0, p);
  }
  if (width && s.length < +width) {
    const pad = (fill ?? ' ').repeat(+width - s.length);
    const al = align ?? (typeof v === 'number' ? '>' : '<');
    if (al === '<') s = s + pad;
    else if (al === '^') s = pad.slice(0, Math.floor(pad.length / 2)) + s + pad.slice(Math.floor(pad.length / 2));
    else s = pad + s;
  }
  return s;
}
function percentFormat(fmt: string, args: any): string {
  const vals = Array.isArray(args) ? [...args] : [args];
  return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifrgeEx%])/g, (_m, flags: string, width: string, prec: string, t: string) => {
    if (t === '%') return '%';
    const v = vals.shift();
    const spec = `${flags.includes('-') ? '<' : ''}${flags.includes('+') ? '+' : ''}${flags.includes('0') ? '0' : ''}${width ?? ''}${prec !== undefined ? '.' + prec : ''}${t === 's' || t === 'r' ? '' : t === 'i' ? 'd' : t}`;
    return t === 'r' ? repr(v) : format(v, spec);
  });
}
/** str.format() */
export function strformat(fmt: string, ...args: any[]): string {
  const kwargs = args.length && (args[args.length - 1]?.[KW] || isPlain(args[args.length - 1])) ? args.pop() : {};
  let auto = 0;
  return fmt.replace(/\{\{|\}\}|\{([^{}:!]*)(?:!([rs]))?(?::([^{}]*))?\}/g, (m, field: string, conv: string, spec: string) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    let v: any;
    const [head, ...rest] = (field ?? '').split('.');
    if (head === '') v = args[auto++];
    else if (/^\d+$/.test(head)) v = args[+head];
    else v = kwargs[head];
    for (const r of rest) v = v[r];
    if (conv === 'r') v = repr(v);
    return format(v, spec ?? '');
  });
}

// ---------------------------------------------------------------- methods of built-in types
/** `obj.name(...args)` where obj may be a str / list / dict / ndarray. */
export function call(obj: any, name: string, ...args: any[]): any {
  if (typeof obj === 'string') return strMethod(obj, name, args);
  if (Array.isArray(obj)) {
    const r = listMethod(obj, name, args);
    if (r !== NOT_HANDLED) return r;
  } else if (isPlain(obj) && typeof obj[name] !== 'function') {
    const r = dictMethod(obj, name, args);
    if (r !== NOT_HANDLED) return r;
  } else if (obj instanceof Set) {
    if (name === 'add') return void obj.add(args[0]);
    if (name === 'discard' || name === 'remove') return void obj.delete(args[0]);
  } else if (typeof obj === 'number') {
    if (name === 'is_integer') return Number.isInteger(obj);
    if (name === 'conjugate') return obj;
  } else if (obj instanceof Complex && name === 'conjugate') return obj.conjugate();
  const f = obj?.[name];
  if (typeof f !== 'function') throw new PyError('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`);
  return f.apply(obj, args);
}
const NOT_HANDLED = Symbol('not handled');
function takeKw(args: any[]): Record<string, any> {
  const last = args[args.length - 1];
  if (last && typeof last === 'object' && (last[KW] || isPlain(last))) return args.pop();
  return {};
}
function strMethod(s: string, name: string, args: any[]): any {
  switch (name) {
    case 'join': return Array.from(iter(args[0]), (x: any) => x).join(s);
    case 'split': {
      const [sep = null, max = -1] = args;
      if (sep === null) {
        const parts = s.trim().split(/\s+/).filter((x) => x.length);
        return toPyList(max >= 0 ? [...parts.slice(0, max), parts.slice(max).join(' ')].filter((x, i) => i < max || x) : parts);
      }
      const parts = s.split(sep);
      return toPyList(max >= 0 && parts.length > max + 1 ? [...parts.slice(0, max), parts.slice(max).join(sep)] : parts);
    }
    case 'strip': return args[0] ? s.replace(new RegExp(`^[${esc(args[0])}]+|[${esc(args[0])}]+$`, 'g'), '') : s.trim();
    case 'lstrip': return args[0] ? s.replace(new RegExp(`^[${esc(args[0])}]+`), '') : s.trimStart();
    case 'rstrip': return args[0] ? s.replace(new RegExp(`[${esc(args[0])}]+$`), '') : s.trimEnd();
    case 'upper': return s.toUpperCase();
    case 'lower': return s.toLowerCase();
    case 'title': return s.replace(/\b\w/g, (c) => c.toUpperCase());
    case 'capitalize': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    case 'startswith': return Array.isArray(args[0]) ? args[0].some((p: string) => s.startsWith(p)) : s.startsWith(args[0]);
    case 'endswith': return Array.isArray(args[0]) ? args[0].some((p: string) => s.endsWith(p)) : s.endsWith(args[0]);
    case 'replace': return args[2] === undefined ? s.split(args[0]).join(args[1]) : s.split(args[0]).reduce((acc, part, i, all) => (i === 0 ? part : acc + (i <= args[2] ? args[1] : args[0]) + part), '');
    case 'find': return s.indexOf(args[0], args[1] ?? 0);
    case 'rfind': return s.lastIndexOf(args[0]);
    case 'index': {
      const i = s.indexOf(args[0]);
      if (i < 0) throw new PyError('ValueError', 'substring not found');
      return i;
    }
    case 'count': return s.split(args[0]).length - 1;
    case 'format': return strformat(s, ...args);
    case 'splitlines': return toPyList(s.split(/\r?\n/));
    case 'isdigit': return /^\d+$/.test(s);
    case 'isalpha': return /^[A-Za-z]+$/.test(s);
    case 'isspace': return /^\s+$/.test(s);
    case 'zfill': return s.padStart(args[0], '0');
    case 'center': return format(s, `${args[1] ?? ' '}^${args[0]}`);
    case 'ljust': return s.padEnd(args[0], args[1] ?? ' ');
    case 'rjust': return s.padStart(args[0], args[1] ?? ' ');
    case 'encode': return s;
  }
  const f = (s as any)[name];
  if (typeof f === 'function') return f.apply(s, args);
  throw new PyError('AttributeError', `'str' object has no attribute '${name}'`);
}
const esc = (x: string) => x.replace(/[\]\\^-]/g, '\\$&');
function listMethod(a: any[], name: string, args: any[]): any {
  switch (name) {
    case 'append': a.push(args[0]); return null;
    case 'extend': for (const x of iter(args[0])) a.push(x); return null;
    case 'insert': a.splice(args[0] < 0 ? Math.max(0, a.length + args[0]) : args[0], 0, args[1]); return null;
    case 'pop': {
      if (!a.length) throw new PyError('IndexError', 'pop from empty list');
      const i = args.length ? normIndex(args[0], a.length) : a.length - 1;
      return a.splice(i, 1)[0];
    }
    case 'remove': {
      const i = a.findIndex((x) => deepEqual(x, args[0]));
      if (i < 0) throw new PyError('ValueError', 'list.remove(x): x not in list');
      a.splice(i, 1);
      return null;
    }
    case 'index': {
      const i = a.findIndex((x) => deepEqual(x, args[0]));
      if (i < 0) throw new PyError('ValueError', `${repr(args[0])} is not in list`);
      return i;
    }
    case 'count': return a.filter((x) => deepEqual(x, args[0])).length;
    case 'reverse': a.reverse(); return null;
    case 'sort': {
      const o = takeKw(args);
      const s = sorted(a, kw({ key: o.key ?? null, reverse: o.reverse ?? false }));
      a.splice(0, a.length, ...s);
      return null;
    }
    case 'copy': return a instanceof PyList ? toPyList(a) : deepCopyArr(a);
    case 'clear': a.length = 0; return null;
    case 'tolist': return toPyList(a.map((x) => (Array.isArray(x) ? listMethod(x, 'tolist', []) : x)));
    case 'flatten': case 'ravel': return a.flat(Infinity);
    case 'reshape': return reshape(a, args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
    case 'astype': return a;
    case 'dot': return matmul(a, args[0]);
    case 'sum': return sumAll(a);
    case 'mean': return sumAll(a) / a.flat(Infinity).length;
    case 'max': return Math.max(...(a.flat(Infinity) as number[]));
    case 'min': return Math.min(...(a.flat(Infinity) as number[]));
    case 'any': return a.flat(Infinity).some(truthy);
    case 'all': return a.flat(Infinity).every(truthy);
    case 'round': return map1(a, (x) => round(x, args[0] ?? 0));
    case 'conjugate': return map1(a, (x) => (x instanceof Complex ? x.conjugate() : x));
  }
  return NOT_HANDLED;
}
export const deepCopy = (a: any): any => (Array.isArray(a) ? a.map(deepCopy) : a);
const deepCopyArr = deepCopy;
const sumAll = (a: any[]): number => (a.flat(Infinity) as number[]).reduce((s, x) => s + x, 0);
export function reshape(a: any, shp: number[]): any {
  const flat = arr(a).flat(Infinity);
  const known = shp.filter((d) => d >= 0).reduce((x, y) => x * y, 1);
  const dims = shp.map((d) => (d < 0 ? flat.length / known : d));
  const build = (off: number, k: number): any => {
    if (k === dims.length - 1) return flat.slice(off, off + dims[k]);
    const stride = dims.slice(k + 1).reduce((x, y) => x * y, 1);
    return Array.from({ length: dims[k] }, (_, i) => build(off + i * stride, k + 1));
  };
  return build(0, 0);
}
function dictMethod(d: Record<string, any>, name: string, args: any[]): any {
  switch (name) {
    case 'items': return toPyList(Object.entries(d).map(([k, v]) => L(k, v)));
    case 'keys': return toPyList(Object.keys(d));
    case 'values': return toPyList(Object.values(d));
    case 'get': return args[0] in d ? d[args[0]] : args[1] ?? null;
    case 'update': Object.assign(d, ...args.map((x) => ({ ...x }))); return null;
    case 'pop': {
      if (!(args[0] in d)) {
        if (args.length > 1) return args[1];
        throw new PyError('KeyError', String(args[0]));
      }
      const v = d[args[0]];
      delete d[args[0]];
      return v;
    }
    case 'setdefault': if (!(args[0] in d)) d[args[0]] = args[1] ?? null; return d[args[0]];
    case 'copy': return { ...d };
    case 'clear': for (const k of Object.keys(d)) delete d[k]; return null;
  }
  return NOT_HANDLED;
}

// ---------------------------------------------------------------- builtins
export function range(a: number, b?: number, step = 1): PyList<number> {
  const [start, stop] = b === undefined ? [0, a] : [a, b];
  const out = new PyList<number>();
  if (step > 0) for (let i = start; i < stop; i += step) out.push(i);
  else for (let i = start; i > stop; i += step) out.push(i);
  return out;
}
export function enumerate(it: any, start = 0): PyList<PyList<any>> {
  let i = start;
  return toPyList(Array.from(iter(it), (x) => L(i++, x)));
}
export function zip(...its: any[]): PyList<PyList<any>> {
  if (its.length && its[its.length - 1]?.[KW]) its.pop();
  const arrs = its.map((x) => Array.from(iter(x)));
  const n = arrs.length ? Math.min(...arrs.map((a) => a.length)) : 0;
  return toPyList(Array.from({ length: n }, (_, i) => toPyList(arrs.map((a) => a[i]))));
}
export function map(f: any, ...its: any[]): PyList<any> {
  const arrs = its.map((x) => Array.from(iter(x)));
  const n = Math.min(...arrs.map((a) => a.length));
  return toPyList(Array.from({ length: n }, (_, i) => f(...arrs.map((a) => a[i]))));
}
export const filter = (f: any, it: any): PyList<any> => toPyList(Array.from(iter(it)).filter((x) => (f === null ? truthy(x) : truthy(f(x)))));
export function sorted(it: any, o: Record<string, any> = {}): PyList<any> {
  const key = o.key ?? ((x: any) => x);
  const items = Array.from(iter(it)).map((x, i) => [key(x), i, x] as const);
  items.sort((p, q) => (deepEqual(p[0], q[0]) ? p[1] - q[1] : lt(p[0], q[0]) ? -1 : 1));
  const out = items.map((t) => t[2]);
  if (o.reverse) {
    // stable reverse: python reverses comparison, keeping equal items in order
    const groups: any[][] = [];
    for (const t of items) {
      const g = groups[groups.length - 1];
      if (g && deepEqual(g[0][0], t[0])) g.push(t);
      else groups.push([t]);
    }
    return toPyList(groups.reverse().flatMap((g) => g.map((t) => t[2])));
  }
  return toPyList(out);
}
export const reversed = (it: any): PyList<any> => toPyList(Array.from(iter(it)).reverse());
export function sum(it: any, start: any = 0): any {
  let s = start;
  for (const x of iter(it)) s = add(s, x);
  return s;
}
function extremum(sign: 1 | -1, args: any[]): any {
  const o = args.length && args[args.length - 1]?.[KW] ? args.pop() : {};
  const items = args.length === 1 ? Array.from(iter(args[0])) : args;
  if (!items.length) {
    if ('default' in o) return o.default;
    throw new PyError('ValueError', 'arg is an empty sequence');
  }
  const key = o.key ?? ((x: any) => x);
  let best = items[0], bk = key(best);
  for (const x of items.slice(1)) {
    const k = key(x);
    if (sign > 0 ? lt(bk, k) : lt(k, bk)) {
      best = x;
      bk = k;
    }
  }
  return best;
}
export const max = (...args: any[]) => extremum(1, args);
export const min = (...args: any[]) => extremum(-1, args);
export function abs(x: any): any {
  if (typeof x === 'number') return Math.abs(x);
  if (x instanceof Complex) return x.abs();
  if (x && typeof x.__abs__ === 'function') return x.__abs__();
  return map1(x, (v) => (v instanceof Complex ? v.abs() : Math.abs(v)));
}
/** Python's round: half to even. */
export function round(x: number, n: number | null = null): number {
  const f = 10 ** (n ?? 0);
  const y = x * f;
  let r = Math.round(y);
  if (Math.abs(y % 1) === 0.5) r = 2 * Math.round(y / 2);
  return n === null ? r : r / f;
}
export function int(x: any = 0, base?: number): number {
  if (typeof x === 'string') return parseInt(x.trim(), base ?? 10);
  if (typeof x === 'boolean') return x ? 1 : 0;
  return Math.trunc(x);
}
export function float(x: any = 0): number {
  if (typeof x === 'string') {
    const t = x.trim().toLowerCase();
    if (t === 'inf' || t === '+inf' || t === 'infinity') return Infinity;
    if (t === '-inf' || t === '-infinity') return -Infinity;
    if (t === 'nan') return NaN;
    return parseFloat(t);
  }
  return Number(x);
}
export const bool = (x: any = false): boolean => truthy(x);
export const list = (it: any = []): PyList<any> => toPyList(Array.from(iter(it)));
export const tuple = list;
export function dict(...args: any[]): any {
  const out: Record<string, any> = {};
  for (const a of args) {
    if (Array.isArray(a)) for (const [k, v] of a) out[k] = v;
    else if (a && typeof a === 'object') Object.assign(out, a);
  }
  return out;
}
export const set = (it: any = []): Set<any> => new Set(iter(it));
export const frozenset = set;
export const print = (...args: any[]): void => {
  const o = args.length && args[args.length - 1]?.[KW] ? args.pop() : {};
  console.log(args.map((a) => str(a)).join(o.sep ?? ' '));
};
const PY_TYPES: Record<string, (x: any) => boolean> = {
  int: (x) => typeof x === 'number' && Number.isInteger(x),
  float: (x) => typeof x === 'number',
  complex: (x) => x instanceof Complex,
  str: (x) => typeof x === 'string',
  bool: (x) => typeof x === 'boolean',
  list: (x) => x instanceof PyList,
  tuple: (x) => x instanceof PyList,
  dict: (x) => isPlain(x),
  set: (x) => x instanceof Set,
};
export function isinstance(x: any, cls: any): boolean {
  if (Array.isArray(cls)) return cls.some((c) => isinstance(x, c));
  if (typeof cls === 'function' && cls.__pytype__) return PY_TYPES[cls.__pytype__](x);
  if (typeof cls === 'function') return x instanceof cls;
  return false;
}
for (const [name, f] of Object.entries({ int, float, str, bool, list, tuple, dict, set })) (f as any).__pytype__ = name;
export const issubclass = (a: any, b: any): boolean => (Array.isArray(b) ? b.some((c) => issubclass(a, c)) : a === b || a.prototype instanceof b);
export const callable_ = (x: any): boolean => typeof x === 'function';
export const type = (x: any): any => (x === null || x === undefined ? null : typeof x === 'object' ? x.constructor : ({ number: float, string: str, boolean: bool } as any)[typeof x]);
export const any = (it: any): boolean => Array.from(iter(it)).some(truthy);
export const all = (it: any): boolean => Array.from(iter(it)).every(truthy);
export const divmod = (a: number, b: number): PyList<number> => L(Math.floor(a / b), mod(a, b));
export const chr = (n: number): string => String.fromCodePoint(n);
export const ord = (c: string): number => c.codePointAt(0)!;
export const hex = (n: number): string => (n < 0 ? '-0x' + (-n).toString(16) : '0x' + n.toString(16));
export const bin = (n: number): string => (n < 0 ? '-0b' + (-n).toString(2) : '0b' + n.toString(2));
let idCounter = 1;
const ids = new WeakMap<object, number>();
export const id = (x: any): number => {
  if (typeof x !== 'object' || x === null) return 0;
  if (!ids.has(x)) ids.set(x, idCounter++);
  return ids.get(x)!;
};
export function next(it: any, dflt?: any): any {
  const r = it.next();
  if (r.done) {
    if (arguments.length > 1) return dflt;
    throw new PyError('StopIteration', '');
  }
  return r.value;
}
export const iter_ = (x: any) => iter(x)[Symbol.iterator]();
export const complex_ = (re: any = 0, im = 0): Complex => (typeof re === 'string' ? parseComplex(re) : new Complex(re, im));
function parseComplex(s: string): Complex {
  const m = /^\(?([+-]?[\d.e]+)?([+-][\d.e]*)j\)?$/.exec(s.replace(/\s/g, ''));
  return m ? new Complex(+(m[1] ?? 0), m[2] === '+' || m[2] === '-' ? +(m[2] + '1') : +m[2]) : new Complex(+s, 0);
}
export const hash = (x: any): number => (typeof x === 'number' ? x : id(x));
export function assert_(cond: any, msg?: any): void {
  if (!truthy(cond)) throw new PyError('AssertionError', msg === undefined ? '' : str(msg));
}
export function exc(name: string): any {
  const cls = class extends PyError {
    constructor(msg = '') {
      super(name, str(msg));
    }
  };
  Object.defineProperty(cls, 'name', { value: name });
  return cls;
}
/** `except E:` - does the thrown value match? */
export function isexc(e: any, cls: any): boolean {
  if (Array.isArray(cls)) return cls.some((c) => isexc(e, c));
  if (cls === BaseException || cls === Exception) return true;
  if (typeof cls === 'function' && e instanceof cls) return true;
  if (e instanceof PyError && cls?.name) return e.pytype === cls.name;
  if (cls?.name === 'TypeError') return e instanceof TypeError;
  if (cls?.name === 'ValueError' || cls?.name === 'IndexError' || cls?.name === 'KeyError') return e instanceof PyError ? e.pytype === cls.name : e instanceof RangeError;
  return false;
}
export const BaseException = exc('BaseException');
export const Exception = exc('Exception');

/** Class decorator used for every transpiled class: callable without `new`. */
export const pyclass = <C extends new (...a: any[]) => any>(cls: C, attrs: Record<string, any> = {}): C => {
  for (const [k, v] of Object.entries(attrs)) {
    (cls as any)[k] = v;
    if (!(k in cls.prototype)) Object.defineProperty(cls.prototype, k, { value: v, writable: true, configurable: true });
  }
  return callable(cls) as unknown as C;
};

/** Group for `mob1 + mob2` when a class has no __add__. */
export { Group };

export const builtins = {
  len, range, enumerate, zip, map, filter, sorted, reversed, sum, max, min, abs, round, int, float, bool, str, repr, list, tuple, dict,
  set, frozenset, print, isinstance, issubclass, callable: callable_, type, any, all, divmod, chr, ord, hex, bin, id, next, iter: iter_,
  complex: complex_, hash, format, getattr, setattr, hasattr, delattr, pow: (a: any, b: any) => pow(a, b), object: Object,
  Exception, BaseException, ValueError: exc('ValueError'), TypeError: exc('TypeError'), IndexError: exc('IndexError'),
  KeyError: exc('KeyError'), AttributeError: exc('AttributeError'), NotImplementedError: exc('NotImplementedError'),
  RuntimeError: exc('RuntimeError'), ZeroDivisionError: exc('ZeroDivisionError'), StopIteration: exc('StopIteration'),
  AssertionError: exc('AssertionError'), NotImplemented: null,
};
