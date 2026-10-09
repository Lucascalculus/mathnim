// Python's `collections` (defaultdict, OrderedDict) for transpiled scenes - web extension.
import { callable } from '../../utils/callable';
import { HashDict } from './networkx';

/** collections.defaultdict: missing keys are created with `default_factory()`. */
export class defaultdict<V = any> extends HashDict<V> {
  declare default_factory: (() => V) | null;
  constructor(default_factory: (() => V) | null = null, init: unknown = null) {
    super(init);
    this.default_factory = default_factory;
  }
  override __getitem__(k: unknown): V {
    if (!this.has(k)) return this.__missing__(k);
    return super.__getitem__(k);
  }
  __missing__(k: unknown): V {
    if (this.default_factory === null) throw new RangeError(`KeyError: ${String(k)}`);
    const v = this.default_factory();
    this.set(k, v);
    return v;
  }
}

/** `import collections` / `from collections import defaultdict` for transpiled scenes. */
export const collections: Record<string, any> = { defaultdict: callable(defaultdict), OrderedDict: callable(HashDict) };
