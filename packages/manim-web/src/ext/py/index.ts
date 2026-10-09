// Run manim scene code transpiled from Python (tools/py2js.py) - web extension.
//
//   const mod = load_transpiled(js);        // { SquareToCircle, ... }
//   const player = new ScenePlayer(new mod.SquareToCircle(), canvas);
import * as M from '../../index';
import { Complex } from '../../utils/complex';
import { math, np, random } from './numpy';
import * as R from './runtime';
import { global_random, nx } from './networkx';
import { collections } from './collections';

const MODULES: Record<string, any> = {
  numpy: np, 'numpy.random': np.random, 'numpy.linalg': np.linalg, math, random, manim: { ...M, __version__: '0.21.0' }, // manim.__version__ (the API version ported)
  networkx: nx, 'networkx.drawing.layout': nx.layout, collections,
};
// networkx's seed=None draws from numpy's / Python's global random state
Object.assign(global_random, { numpy: { random: () => np.random.random_sample() }, python: { random: () => random.random() } });
/** Names every scene can use without importing (python builtins, plus what `from manim import *` gives). */
function lookup(name: string): any {
  if (name in R.builtins) return (R.builtins as any)[name];
  if (name === 'override_animation') return override_animation;
  if (name.startsWith('OpenGL') && name.slice(6) in M) return (M as any)[name.slice(6)]; // web: one renderer
  if (name === 'np' || name === 'numpy') return np;
  if (name === 'math') return math;
  if (name === 'random') return random;
  if (name in M) return (M as any)[name];
  const missing = (..._a: unknown[]) => {
    throw new R.PyError('NameError', `name '${name}' is not defined (not available in manim-web)`);
  };
  (missing as any).__missing__ = name;
  return missing;
}
function import_(mod: string, name?: string): any {
  const m = MODULES[mod] ?? (mod.startsWith('manim') ? M : undefined);
  if (m === undefined) throw new R.PyError('ImportError', `No module named '${mod}'`);
  if (name === undefined) return m;
  if (name in m) return m[name];
  if (mod.startsWith('manim') && name in M) return (M as any)[name];
  throw new R.PyError('ImportError', `cannot import name '${name}' from '${mod}'`);
}
const raise_ = (x: any): any => (typeof x === 'function' ? new x() : x);
/** A method decorator: `@override_animation(FadeIn)` or any function wrapping the method. */
function decorate_method(cls: any, name: string, deco: any): void {
  if (deco && deco.__override_animation__) {
    const method = cls.prototype[name];
    (M.Mobject as any).add_animation_override.call(cls, deco.__override_animation__, (mob: any, ...args: any[]) => method.apply(mob, args));
    return;
  }
  cls.prototype[name] = deco(cls.prototype[name]);
}
/** manim's @override_animation(AnimationClass) decorator. */
function override_animation(animation_class: any): any {
  const d = (f: any) => f;
  (d as any).__override_animation__ = animation_class.__wrapped_class__ ?? unwrap(animation_class);
  return d;
}
const unwrap = (c: any) => c.prototype?.constructor ?? c;
const enter = (c: any): any => (c && typeof c.__enter__ === 'function' ? c.__enter__() : c);
const exit = (c: any): void => void (c && typeof c.__exit__ === 'function' && c.__exit__(null, null, null));

/** The `$` object transpiled code runs against. */
export const runtime = { ...R, import_, raise_, enter, exit, decorate_method, complex: (re: number, im: number) => new Complex(re, im), g: lookup };

/** Evaluate transpiled code; returns its top-level classes and functions. */
export function load_transpiled(js: string): Record<string, any> {
  const f = new Function('$', '$g', 'M', js);
  return f(runtime, lookup, M);
}
export { np, math, random };
