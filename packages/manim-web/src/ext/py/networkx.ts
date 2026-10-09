// networkx (the part manim uses) - web extension.
//
// manim's Graph keeps its structure in a networkx graph and places vertices
// with networkx's layout functions. This module re-implements those pieces
// with networkx's algorithms, node orders and default parameters (so layouts
// match manim's), and it is also the `import networkx as nx` module of
// transpiled scenes (see `nx` at the bottom).
//
// Python dicts keyed by hashables (numbers, strings, tuples) become HashDict;
// Python sets whose iteration order matters are emulated by PySet.
import { callable } from '../../utils/callable';
import { isKwargs, KW, pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { MT19937, python_seed } from './random';

export type Node = any;
type Attr = Record<string, any>;

const keyError = (k: unknown) => new RangeError(`KeyError: ${String(k)}`);
const nxError = (msg: string) => new Error(`NetworkXError: ${msg}`);

// ---------------------------------------------------------------- dict with hashable keys
/**
 * Key of a Python hashable. Matches how transpiled dict literals key plain
 * objects (`{(1, 2): x}` -> "1,2"), so both can be looked up with the same value.
 */
export const hkey = (x: unknown): string => String(x);

/** A Python dict keyed by hashables (tuples compare by value), in insertion order. */
export class HashDict<V = any> {
  declare _map: Map<string, [unknown, V]>;
  constructor(init: unknown = null) {
    this._map = new Map();
    if (init !== null && init !== undefined) this.update(init);
  }
  get size(): number {
    return this._map.size;
  }
  __len__(): number {
    return this._map.size;
  }
  has(k: unknown): boolean {
    return this._map.has(hkey(k));
  }
  __contains__(k: unknown): boolean {
    return this._map.has(hkey(k));
  }
  /** Python `d.get(k, default)`. */
  get(k: unknown, dflt?: V): V | undefined {
    const e = this._map.get(hkey(k));
    return e ? e[1] : dflt;
  }
  __getitem__(k: unknown): V {
    const e = this._map.get(hkey(k));
    if (!e) throw keyError(k);
    return e[1];
  }
  set(k: unknown, v: V): this {
    const key = hkey(k);
    const e = this._map.get(key);
    if (e) e[1] = v;
    else this._map.set(key, [k, v]);
    return this;
  }
  __setitem__(k: unknown, v: V): void {
    this.set(k, v);
  }
  delete(k: unknown): boolean {
    return this._map.delete(hkey(k));
  }
  __delitem__(k: unknown): void {
    if (!this._map.delete(hkey(k))) throw keyError(k);
  }
  /** Python `d.pop(k[, default])`. */
  pop(k: unknown, ...dflt: V[]): V {
    const key = hkey(k);
    const e = this._map.get(key);
    if (!e) {
      if (dflt.length) return dflt[0];
      throw keyError(k);
    }
    this._map.delete(key);
    return e[1];
  }
  setdefault(k: unknown, dflt: V): V {
    if (!this.has(k)) this.set(k, dflt);
    return this.__getitem__(k);
  }
  keys(): any[] {
    return [...this._map.values()].map((e) => e[0]);
  }
  values(): V[] {
    return [...this._map.values()].map((e) => e[1]);
  }
  items(): [any, V][] {
    return [...this._map.values()].map((e) => [e[0], e[1]]);
  }
  clear(): void {
    this._map.clear();
  }
  copy(): HashDict<V> {
    return new HashDict<V>(this);
  }
  /** Python `d.update(other)`: other may be a HashDict, Map, plain object or list of pairs. */
  update(other: unknown): this {
    for (const [k, v] of dict_items(other)) this.set(k, v as V);
    return this;
  }
  [Symbol.iterator](): Iterator<any> {
    return this.keys()[Symbol.iterator]();
  }
  __iter__(): Iterable<any> {
    return this.keys();
  }
  __str__(): string {
    return `{${this.items().map(([k, v]) => `${repr(k)}: ${repr(v)}`).join(', ')}}`;
  }
  toString(): string {
    return this.__str__();
  }
}
const repr = (x: unknown): string => (typeof x === 'string' ? `'${x}'` : Array.isArray(x) ? `(${x.map(repr).join(', ')})` : String(x));

/** (key, value) pairs of any dict-like value (HashDict, Map, plain object, pairs, `.items()`). */
export function dict_items(d: unknown): [any, any][] {
  if (d === null || d === undefined) return [];
  if (d instanceof HashDict) return d.items();
  if (d instanceof Map) return [...d.entries()];
  if (Array.isArray(d)) return d.map((p) => [p[0], p[1]]);
  if (isKwargs(d)) return Object.entries(d);
  if (typeof (d as any).items === 'function') return Array.from((d as any).items(), (p: any) => [p[0], p[1]]);
  throw new TypeError(`'${(d as any)?.constructor?.name}' object is not a mapping`);
}
/** `key in d` for any dict-like value. */
export function dict_has(d: unknown, k: unknown): boolean {
  if (d === null || d === undefined) return false;
  if (d instanceof HashDict) return d.has(k);
  if (d instanceof Map) return d.has(k) || d.has(hkey(k));
  if (typeof (d as any).__contains__ === 'function') return !!(d as any).__contains__(k);
  if (typeof d === 'object') return Object.prototype.hasOwnProperty.call(d, hkey(k));
  return false;
}
/** `d[k]` (or `dflt` when missing) for any dict-like value. */
export function dict_get(d: unknown, k: unknown, dflt?: any): any {
  if (!dict_has(d, k)) return dflt;
  if (d instanceof HashDict) return d.get(k);
  if (d instanceof Map) return d.has(k) ? d.get(k) : d.get(hkey(k));
  if (typeof (d as any).__getitem__ === 'function') return (d as any).__getitem__(k);
  return (d as any)[hkey(k)];
}
/** Is `x` a dict-like value (not a function, array or mobject)? */
export const is_dict = (x: unknown): boolean => x instanceof HashDict || x instanceof Map || isKwargs(x) || (!!x && typeof x === 'object' && typeof (x as any).items === 'function' && typeof (x as any).__getitem__ === 'function');

// ---------------------------------------------------------------- CPython set iteration order
const M64 = (1n << 64n) - 1n;
const XXPRIME_1 = 11400714785074694791n, XXPRIME_2 = 14029467366897019727n, XXPRIME_5 = 2870177450012600261n;
const HASH_MODULUS = (1n << 61n) - 1n;
/** CPython's hash() for ints, bools and tuples of them (unsigned 64 bit); null when it is salted (str) or unknown. */
function pyhash(x: unknown): bigint | null {
  if (typeof x === 'boolean') return x ? 1n : 0n;
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) return null;
    const b = BigInt(x);
    let h = b >= 0n ? b % HASH_MODULUS : -(-b % HASH_MODULUS);
    if (h === -1n) h = -2n;
    return h & M64;
  }
  if (Array.isArray(x)) {
    let acc = XXPRIME_5;
    for (const item of x) {
      const lane = pyhash(item);
      if (lane === null) return null;
      acc = (acc + lane * XXPRIME_2) & M64;
      acc = ((acc << 31n) | (acc >> 33n)) & M64;
      acc = (acc * XXPRIME_1) & M64;
    }
    acc = (acc + (BigInt(x.length) ^ (XXPRIME_5 ^ 3527539n))) & M64;
    if (acc === M64) return 1546275796n;
    return acc;
  }
  return null;
}

/**
 * A Python set that iterates and pops in CPython's order (hash-table slot
 * order) when all elements hash deterministically (ints, tuples of ints);
 * otherwise in insertion order (web: string hashes are salted per process in
 * CPython, so their order is not reproducible anyway).
 */
export class PySet<T = any> {
  declare table: ({ key: T; hash: bigint } | null | 'dummy')[];
  declare fill: number;
  declare used: number;
  declare finger: number;
  declare fallback: Map<string, T> | null;
  constructor(items: Iterable<T> = []) {
    this.table = new Array(8).fill(null);
    this.fill = 0;
    this.used = 0;
    this.finger = 0;
    this.fallback = null;
    for (const x of items) this.add(x);
  }
  get size(): number {
    return this.fallback ? this.fallback.size : this.used;
  }
  private find(x: T, hash: bigint): number {
    const mask = BigInt(this.table.length - 1);
    let i = hash & mask;
    let perturb = hash;
    for (;;) {
      const probes = Number(i) + 9 <= Number(mask) ? 9 : 0;
      for (let j = 0; j <= probes; j++) {
        const e = this.table[Number(i) + j];
        if (e === null) return -1;
        if (e !== 'dummy' && e.hash === hash && hkey(e.key) === hkey(x)) return Number(i) + j;
      }
      perturb >>= 5n;
      i = (i * 5n + 1n + perturb) & mask;
    }
  }
  has(x: T): boolean {
    if (this.fallback) return this.fallback.has(hkey(x));
    const h = pyhash(x);
    return h !== null && this.find(x, h) >= 0;
  }
  add(x: T): void {
    if (this.fallback) {
      if (!this.fallback.has(hkey(x))) this.fallback.set(hkey(x), x);
      return;
    }
    const hash = pyhash(x);
    if (hash === null) {
      this.fallback = new Map([...this].map((y) => [hkey(y), y]));
      this.fallback.set(hkey(x), x);
      return;
    }
    const mask = BigInt(this.table.length - 1);
    let i = hash & mask;
    let perturb = hash;
    let freeslot = -1;
    for (;;) {
      const probes = Number(i) + 9 <= Number(mask) ? 9 : 0;
      for (let j = 0; j <= probes; j++) {
        const idx = Number(i) + j;
        const e = this.table[idx];
        if (e === null) {
          if (freeslot >= 0) {
            this.table[freeslot] = { key: x, hash };
            this.used++;
            return;
          }
          this.table[idx] = { key: x, hash };
          this.fill++;
          this.used++;
          if (this.fill * 5 >= Number(mask) * 3) this.resize(this.used > 50000 ? this.used * 2 : this.used * 4);
          return;
        }
        if (e === 'dummy') {
          if (freeslot < 0) freeslot = idx;
        } else if (e.hash === hash && hkey(e.key) === hkey(x)) return;
      }
      perturb >>= 5n;
      i = (i * 5n + 1n + perturb) & mask;
    }
  }
  private resize(minused: number): void {
    let newsize = 8;
    while (newsize <= minused) newsize <<= 1;
    const old = this.table;
    this.table = new Array(newsize).fill(null);
    const mask = BigInt(newsize - 1);
    for (const e of old) {
      if (e === null || e === 'dummy') continue;
      let i = e.hash & mask;
      let perturb = e.hash;
      for (;;) {
        if (this.table[Number(i)] === null) break;
        let placed = -1;
        if (Number(i) + 9 <= Number(mask)) {
          for (let j = 1; j <= 9; j++) {
            if (this.table[Number(i) + j] === null) {
              placed = Number(i) + j;
              break;
            }
          }
        }
        if (placed >= 0) {
          i = BigInt(placed);
          break;
        }
        perturb >>= 5n;
        i = (i * 5n + 1n + perturb) & mask;
      }
      this.table[Number(i)] = e;
    }
    this.fill = this.used;
  }
  discard(x: T): void {
    if (this.fallback) {
      this.fallback.delete(hkey(x));
      return;
    }
    const h = pyhash(x);
    if (h === null) return;
    const idx = this.find(x, h);
    if (idx >= 0) {
      this.table[idx] = 'dummy';
      this.used--;
    }
  }
  pop(): T {
    if (this.fallback) {
      const first = this.fallback.entries().next();
      if (first.done) throw keyError('pop from an empty set');
      this.fallback.delete(first.value[0]);
      return first.value[1];
    }
    if (this.used === 0) throw keyError('pop from an empty set');
    const mask = this.table.length - 1;
    let idx = this.finger & mask;
    for (;;) {
      const e = this.table[idx];
      if (e !== null && e !== 'dummy') break;
      idx++;
      if (idx > mask) idx = 0;
    }
    const e = this.table[idx] as { key: T };
    this.table[idx] = 'dummy';
    this.used--;
    this.finger = idx + 1;
    return e.key;
  }
  *[Symbol.iterator](): Iterator<T> {
    if (this.fallback) {
      yield* this.fallback.values();
      return;
    }
    for (const e of this.table) if (e !== null && e !== 'dummy') yield e.key;
  }
}

// ---------------------------------------------------------------- graphs
interface Rec {
  n: Node;
  attr: Attr;
}
const kwOf = (args: unknown[]): [unknown[], Kwargs] => starArgs(args);
/** A function object that behaves like a networkx view: iterable, callable, sized and indexable. */
function view(items: () => any[], call: (...a: any[]) => any, getitem: (k: any) => any, contains: (k: any) => boolean): any {
  const f: any = function (...a: any[]) {
    return call(...a);
  };
  f[Symbol.iterator] = () => items()[Symbol.iterator]();
  f.__iter__ = () => items();
  f.__len__ = () => items().length;
  f.__getitem__ = getitem;
  f.__contains__ = contains;
  f.__str__ = () => `[${items().map(repr).join(', ')}]`;
  f.toString = f.__str__;
  return f;
}

/** networkx.Graph: an undirected graph; nodes and neighbours keep insertion order. */
export class NxGraph {
  declare graph: Attr;
  declare _node: Map<string, Rec>;
  declare _adj: Map<string, Map<string, Rec>>;

  constructor(...args: unknown[]) {
    const [pos, kw] = kwOf(args);
    this._init_storage();
    const data = pos[0] ?? kw.incoming_graph_data;
    if (data !== undefined && data !== null) this._from_data(data);
    for (const [k, v] of Object.entries(kw)) if (k !== 'incoming_graph_data') this.graph[k] = v;
  }
  protected _init_storage(): void {
    this.graph = {};
    this._node = new Map();
    this._adj = new Map();
  }
  protected _from_data(data: any): void {
    if (data instanceof NxGraph) {
      Object.assign(this.graph, data.graph);
      for (const r of data._node.values()) this.add_node(r.n, { ...r.attr });
      for (const [u, v, d] of data.edge_list(true)) this.add_edge(u, v, { ...d });
    } else if (is_dict(data)) {
      for (const [u, nbrs] of dict_items(data)) {
        this.add_node(u);
        for (const v of is_dict(nbrs) ? dict_items(nbrs).map((p) => p[0]) : nbrs) this.add_edge(u, v);
      }
    } else this.add_edges_from(data);
  }
  is_directed(): boolean {
    return false;
  }
  is_multigraph(): boolean {
    return false;
  }
  get name(): string {
    return this.graph.name ?? '';
  }
  set name(s: string) {
    this.graph.name = s;
  }
  // ------------------------------------------------ python protocol
  __len__(): number {
    return this._node.size;
  }
  [Symbol.iterator](): Iterator<Node> {
    return this.node_list()[Symbol.iterator]();
  }
  __iter__(): Node[] {
    return this.node_list();
  }
  __contains__(n: Node): boolean {
    return this._node.has(hkey(n));
  }
  /** `G[u]`: the neighbours of u mapped to the edge attributes. */
  __getitem__(n: Node): HashDict<Attr> {
    const nbrs = this._adj.get(hkey(n));
    if (!nbrs) throw keyError(n);
    const d = new HashDict<Attr>();
    for (const r of nbrs.values()) d.set(r.n, r.attr);
    return d;
  }
  __str__(): string {
    const nm = this.name ? ` named '${this.name}'` : '';
    return `${this.constructor.name.replace(/^Nx/, '')}${nm} with ${this.number_of_nodes()} nodes and ${this.number_of_edges()} edges`;
  }
  toString(): string {
    return this.__str__();
  }
  // ------------------------------------------------ nodes
  /** The nodes, in insertion order. */
  node_list(): Node[] {
    return Array.from(this._node.values(), (r) => r.n);
  }
  /** The attribute dict of a node. */
  node_attr(n: Node): Attr {
    const r = this._node.get(hkey(n));
    if (!r) throw keyError(n);
    return r.attr;
  }
  protected _new_node(k: string, n: Node): Rec {
    const r = { n, attr: {} };
    this._node.set(k, r);
    this._adj.set(k, new Map());
    return r;
  }
  add_node(...args: unknown[]): void {
    const [[n], attr] = kwOf(args);
    if (n === null || n === undefined) throw new Error('ValueError: None cannot be a node');
    const k = hkey(n);
    const r = this._node.get(k) ?? this._new_node(k, n);
    Object.assign(r.attr, attr);
  }
  add_nodes_from(...args: unknown[]): void {
    const [[nodes], attr] = kwOf(args);
    for (let n of nodes as Iterable<any>) {
      let d: Attr = attr;
      if (Array.isArray(n) && n.length === 2 && isKwargs(n[1])) {
        d = { ...attr, ...n[1] };
        n = n[0];
      }
      this.add_node(n, d);
    }
  }
  remove_node(n: Node): void {
    const k = hkey(n);
    const nbrs = this._adj.get(k);
    if (!nbrs) throw nxError(`The node ${String(n)} is not in the graph.`);
    this._node.delete(k);
    for (const u of nbrs.keys()) this._adj.get(u)!.delete(k);
    this._adj.delete(k);
  }
  remove_nodes_from(nodes: Iterable<Node>): void {
    for (const n of nodes) if (this.has_node(n)) this.remove_node(n);
  }
  has_node(n: Node): boolean {
    return this._node.has(hkey(n));
  }
  number_of_nodes(): number {
    return this._node.size;
  }
  order(): number {
    return this._node.size;
  }
  /** `G.nodes`: iterable/callable/indexable view of the nodes (`G.nodes(data=True)`, `G.nodes[n]`). */
  get nodes(): any {
    return view(
      () => this.node_list(),
      (...a: any[]) => {
        const o = pyargs(a, ['data', 'default'], { data: false, default: null });
        if (o.data === false) return this.node_list();
        return Array.from(this._node.values(), (r) => [r.n, o.data === true ? r.attr : (r.attr[o.data] ?? o.default)]);
      },
      (n) => this.node_attr(n),
      (n) => this.has_node(n),
    );
  }
  // ------------------------------------------------ edges
  add_edge(...args: unknown[]): void {
    const [[u, v], attr] = kwOf(args);
    const ku = hkey(u), kv = hkey(v);
    if (!this._node.has(ku)) this._new_node(ku, u);
    if (!this._node.has(kv)) this._new_node(kv, v);
    const nbrs = this._adj.get(ku)!;
    const rec = nbrs.get(kv);
    const dd = rec ? rec.attr : {};
    Object.assign(dd, attr);
    this._set_edge(ku, u, kv, v, dd);
  }
  protected _set_edge(ku: string, u: Node, kv: string, v: Node, dd: Attr): void {
    if (!this._adj.get(ku)!.has(kv)) this._adj.get(ku)!.set(kv, { n: v, attr: dd });
    if (!this._adj.get(kv)!.has(ku)) this._adj.get(kv)!.set(ku, { n: u, attr: dd });
  }
  add_edges_from(...args: unknown[]): void {
    const [[ebunch], attr] = kwOf(args);
    for (const e of ebunch as Iterable<any>) {
      const ee = Array.from(e as Iterable<any>);
      if (ee.length === 3) this.add_edge(ee[0], ee[1], { ...attr, ...ee[2] });
      else if (ee.length === 2) this.add_edge(ee[0], ee[1], { ...attr });
      else throw nxError(`Edge tuple ${String(e)} must be a 2-tuple or 3-tuple.`);
    }
  }
  add_weighted_edges_from(...args: unknown[]): void {
    const [[ebunch, weight = 'weight'], attr] = kwOf(args);
    for (const [u, v, w] of ebunch as Iterable<any>) this.add_edge(u, v, { ...attr, [weight as string]: w });
  }
  remove_edge(u: Node, v: Node): void {
    const ku = hkey(u), kv = hkey(v);
    if (!this._adj.get(ku)?.has(kv)) throw nxError(`The edge ${String(u)}-${String(v)} is not in the graph`);
    this._adj.get(ku)!.delete(kv);
    if (ku !== kv) this._adj.get(kv)!.delete(ku);
  }
  remove_edges_from(ebunch: Iterable<any>): void {
    for (const e of ebunch) if (this.has_edge(e[0], e[1])) this.remove_edge(e[0], e[1]);
  }
  has_edge(u: Node, v: Node): boolean {
    return !!this._adj.get(hkey(u))?.has(hkey(v));
  }
  /** The edges as [u, v] (or [u, v, data] when `data`), in networkx's order. */
  edge_list(data = false): any[][] {
    const out: any[][] = [];
    const seen = new Set<string>();
    for (const [k, nbrs] of this._adj) {
      const u = this._node.get(k)!.n;
      for (const [kv, r] of nbrs) if (!seen.has(kv)) out.push(data ? [u, r.n, r.attr] : [u, r.n]);
      seen.add(k);
    }
    return out;
  }
  number_of_edges(u: Node = null, v: Node = null): number {
    if (u === null || u === undefined) return this.edge_list().length;
    return this.has_edge(u, v) ? 1 : 0;
  }
  size(...args: unknown[]): number {
    const o = pyargs(args, ['weight'], { weight: null });
    if (o.weight === null) return this.number_of_edges();
    return this.edge_list(true).reduce((s, e) => s + (e[2][o.weight] ?? 1), 0);
  }
  /** `G.edges`: iterable/callable/indexable view of the edges (`G.edges(data=True)`, `G.edges[u, v]`). */
  get edges(): any {
    return view(
      () => this.edge_list(),
      (...a: any[]) => {
        const o = pyargs(a, ['nbunch', 'data', 'default'], { nbunch: null, data: false, default: null });
        let es = this.edge_list(true);
        if (o.nbunch !== null) {
          const nb = new Set((this.has_node(o.nbunch) ? [o.nbunch] : Array.from(o.nbunch as Iterable<any>)).map(hkey));
          es = es.filter((e) => nb.has(hkey(e[0])) || nb.has(hkey(e[1])));
        }
        if (o.data === false) return es.map((e) => [e[0], e[1]]);
        return es.map((e) => [e[0], e[1], o.data === true ? e[2] : (e[2][o.data] ?? o.default)]);
      },
      (e) => {
        const r = this._adj.get(hkey(e[0]))?.get(hkey(e[1]));
        if (!r) throw keyError(e);
        return r.attr;
      },
      (e) => Array.isArray(e) && this.has_edge(e[0], e[1]),
    );
  }
  // ------------------------------------------------ adjacency
  /** The neighbours of n (successors for directed graphs). */
  neighbors(n: Node): Node[] {
    const nbrs = this._adj.get(hkey(n));
    if (!nbrs) throw nxError(`The node ${String(n)} is not in the graph.`);
    return Array.from(nbrs.values(), (r) => r.n);
  }
  get adj(): HashDict<HashDict<Attr>> {
    const d = new HashDict<HashDict<Attr>>();
    for (const r of this._node.values()) d.set(r.n, this.__getitem__(r.n));
    return d;
  }
  /** `G.degree`: `G.degree[n]`, `G.degree(n)`, or iterate (node, degree) pairs. */
  get degree(): any {
    const deg = (n: Node, weight: string | null = null): number => {
      const nbrs = this._adj.get(hkey(n));
      if (!nbrs) throw keyError(n);
      let d = 0;
      for (const [k, r] of nbrs) {
        const w = weight === null ? 1 : (r.attr[weight] ?? 1);
        d += k === hkey(n) ? 2 * w : w;
      }
      return d + this._in_degree(n, weight);
    };
    return view(
      () => this.node_list().map((n) => [n, deg(n)]),
      (...a: any[]) => {
        const o = pyargs(a, ['nbunch', 'weight'], { nbunch: null, weight: null });
        if (o.nbunch !== null && this.has_node(o.nbunch)) return deg(o.nbunch, o.weight);
        const nodes = o.nbunch === null ? this.node_list() : Array.from(o.nbunch as Iterable<any>);
        return nodes.map((n) => [n, deg(n, o.weight)]);
      },
      (n) => deg(n),
      (n) => this.has_node(n),
    );
  }
  protected _in_degree(_n: Node, _weight: string | null): number {
    return 0;
  }
  // ------------------------------------------------ conversions
  copy(): this {
    const G = new (this.constructor as any)() as this;
    Object.assign(G.graph, this.graph);
    for (const r of this._node.values()) G.add_node(r.n, { ...r.attr });
    for (const [u, v, d] of this.edge_list(true)) G.add_edge(u, v, { ...d });
    return G;
  }
  to_undirected(): NxGraph {
    const G = new NxGraph();
    Object.assign(G.graph, this.graph);
    for (const r of this._node.values()) G.add_node(r.n, { ...r.attr });
    for (const [u, v, d] of this.edge_list(true)) G.add_edge(u, v, { ...d });
    return G;
  }
  to_directed(): NxDiGraph {
    const G = new NxDiGraph();
    Object.assign(G.graph, this.graph);
    for (const r of this._node.values()) G.add_node(r.n, { ...r.attr });
    for (const [k, nbrs] of this._adj) for (const r of nbrs.values()) G.add_edge(this._node.get(k)!.n, r.n, { ...r.attr });
    return G;
  }
  /** The induced subgraph on `nodes` (a copy; networkx returns a view). */
  subgraph(nodes: Iterable<Node>): this {
    const keep = new Set(Array.from(nodes, hkey));
    const G = new (this.constructor as any)() as this;
    for (const r of this._node.values()) if (keep.has(hkey(r.n))) G.add_node(r.n, r.attr);
    for (const [u, v, d] of this.edge_list(true)) if (keep.has(hkey(u)) && keep.has(hkey(v))) G.add_edge(u, v, d);
    return G;
  }
  clear(): void {
    this._init_storage();
  }
}

/** networkx.DiGraph: a directed graph. */
export class NxDiGraph extends NxGraph {
  declare _pred: Map<string, Map<string, Rec>>;
  protected override _init_storage(): void {
    super._init_storage();
    this._pred = new Map();
  }
  override is_directed(): boolean {
    return true;
  }
  protected override _new_node(k: string, n: Node): Rec {
    this._pred.set(k, new Map());
    return super._new_node(k, n);
  }
  protected override _set_edge(ku: string, u: Node, kv: string, v: Node, dd: Attr): void {
    if (!this._adj.get(ku)!.has(kv)) this._adj.get(ku)!.set(kv, { n: v, attr: dd });
    if (!this._pred.get(kv)!.has(ku)) this._pred.get(kv)!.set(ku, { n: u, attr: dd });
  }
  override remove_node(n: Node): void {
    const k = hkey(n);
    if (!this._node.has(k)) throw nxError(`The node ${String(n)} is not in the digraph.`);
    this._node.delete(k);
    for (const u of this._adj.get(k)!.keys()) this._pred.get(u)!.delete(k);
    this._adj.delete(k);
    for (const u of this._pred.get(k)!.keys()) this._adj.get(u)!.delete(k);
    this._pred.delete(k);
  }
  override remove_edge(u: Node, v: Node): void {
    const ku = hkey(u), kv = hkey(v);
    if (!this._adj.get(ku)?.has(kv)) throw nxError(`The edge ${String(u)}-${String(v)} not in graph.`);
    this._adj.get(ku)!.delete(kv);
    this._pred.get(kv)!.delete(ku);
  }
  override edge_list(data = false): any[][] {
    const out: any[][] = [];
    for (const [k, nbrs] of this._adj) {
      const u = this._node.get(k)!.n;
      for (const r of nbrs.values()) out.push(data ? [u, r.n, r.attr] : [u, r.n]);
    }
    return out;
  }
  successors(n: Node): Node[] {
    return this.neighbors(n);
  }
  predecessors(n: Node): Node[] {
    const p = this._pred.get(hkey(n));
    if (!p) throw nxError(`The node ${String(n)} is not in the digraph.`);
    return Array.from(p.values(), (r) => r.n);
  }
  get succ(): HashDict<HashDict<Attr>> {
    return this.adj;
  }
  get pred(): HashDict<HashDict<Attr>> {
    const d = new HashDict<HashDict<Attr>>();
    for (const [k, p] of this._pred) {
      const h = new HashDict<Attr>();
      for (const r of p.values()) h.set(r.n, r.attr);
      d.set(this._node.get(k)!.n, h);
    }
    return d;
  }
  protected override _in_degree(n: Node, weight: string | null): number {
    let d = 0;
    for (const [k, r] of this._pred.get(hkey(n)) ?? []) if (k !== hkey(n)) d += weight === null ? 1 : (r.attr[weight] ?? 1);
    return d;
  }
  in_degree(n: Node): number {
    return (this._pred.get(hkey(n))?.size ?? 0);
  }
  out_degree(n: Node): number {
    return (this._adj.get(hkey(n))?.size ?? 0);
  }
  reverse(): NxDiGraph {
    const G = new NxDiGraph();
    Object.assign(G.graph, this.graph);
    for (const r of this._node.values()) G.add_node(r.n, { ...r.attr });
    for (const [u, v, d] of this.edge_list(true)) G.add_edge(v, u, { ...d });
    return G;
  }
}

const asGraph = (G: any): NxGraph => {
  if (G instanceof NxGraph) return G;
  const H = new NxGraph();
  H.add_nodes_from(G);
  return H;
};

// ---------------------------------------------------------------- algorithms
/** Connected components (weakly connected for directed graphs), each in BFS order. */
export function connected_components(G: NxGraph): Node[][] {
  const seen = new Set<string>();
  const out: Node[][] = [];
  const nbrs = (n: Node): Node[] => (G instanceof NxDiGraph ? [...G.successors(n), ...G.predecessors(n)] : G.neighbors(n));
  for (const s of G.node_list()) {
    if (seen.has(hkey(s))) continue;
    const comp: Node[] = [s];
    seen.add(hkey(s));
    for (let i = 0; i < comp.length; i++) {
      for (const w of nbrs(comp[i])) {
        if (!seen.has(hkey(w))) {
          seen.add(hkey(w));
          comp.push(w);
        }
      }
    }
    out.push(comp);
  }
  return out;
}
export function is_connected(G: NxGraph): boolean {
  if (G.__len__() === 0) throw new Error('NetworkXPointlessConcept: Connectivity is undefined for the null graph.');
  return connected_components(G).length === 1;
}
export const is_weakly_connected = is_connected;
export function number_connected_components(G: NxGraph): number {
  return connected_components(G).length;
}
/** Is G a tree (connected, n - 1 edges; weakly connected for directed graphs)? */
export function is_tree(G: NxGraph): boolean {
  if (G.__len__() === 0) throw new Error('NetworkXPointlessConcept: G has no nodes.');
  return G.__len__() - 1 === G.number_of_edges() && is_connected(G);
}
/** Distances from `source` (Dijkstra with edge attribute `weight`, default 1; BFS when weight is null). */
function single_source_lengths(G: NxGraph, source: Node, weight: string | null): HashDict<number> {
  const dist = new HashDict<number>();
  if (weight === null) {
    dist.set(source, 0);
    let level = [source], d = 0;
    while (level.length) {
      d++;
      const next: Node[] = [];
      for (const u of level) for (const v of G.neighbors(u)) if (!dist.has(v)) {
        dist.set(v, d);
        next.push(v);
      }
      level = next;
    }
    return dist;
  }
  // networkx's _dijkstra_multisource: pop the smallest (distance, insertion count)
  const seen = new HashDict<number>();
  const fringe: [number, number, Node][] = [];
  let c = 0;
  seen.set(source, 0);
  fringe.push([0, c++, source]);
  while (fringe.length) {
    let best = 0;
    for (let i = 1; i < fringe.length; i++) {
      const a = fringe[i], b = fringe[best];
      if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best = i;
    }
    const [d, , v] = fringe.splice(best, 1)[0];
    if (dist.has(v)) continue;
    dist.set(v, d);
    for (const [u, e] of G.__getitem__(v).items()) {
      const vu = d + (e[weight] ?? 1);
      if (dist.has(u)) continue;
      if (!seen.has(u) || vu < seen.get(u)!) {
        seen.set(u, vu);
        fringe.push([vu, c++, u]);
      }
    }
  }
  return dist;
}
/** networkx.shortest_path_length (unweighted when weight is None, Dijkstra otherwise). */
export function shortest_path_length(...args: unknown[]): any {
  const o = pyargs(args, ['G', 'source', 'target', 'weight', 'method'], { source: null, target: null, weight: null, method: 'dijkstra' });
  const G: NxGraph = o.G;
  const weight = o.weight;
  if (o.source !== null) {
    const d = single_source_lengths(G, o.source, weight);
    if (o.target !== null) {
      if (!d.has(o.target)) throw new Error(`NetworkXNoPath: Target ${String(o.target)} cannot be reached from given sources`);
      return d.get(o.target);
    }
    return d;
  }
  if (o.target !== null) {
    const H = G instanceof NxDiGraph ? G.reverse() : G;
    return single_source_lengths(H, o.target, weight);
  }
  const all = new HashDict<HashDict<number>>();
  for (const n of G.node_list()) all.set(n, single_source_lengths(G, n, weight));
  return all;
}
export function all_pairs_shortest_path_length(G: NxGraph): HashDict<HashDict<number>> {
  return shortest_path_length(G, { weight: null });
}
/** Dense adjacency matrix in node order (edge attribute `weight`, default 1). */
export function to_numpy_array(...args: unknown[]): number[][] {
  const o = pyargs(args, ['G', 'nodelist', 'dtype', 'order', 'multigraph_weight', 'weight', 'nonedge'], { nodelist: null, weight: 'weight', nonedge: 0.0 });
  const G: NxGraph = o.G;
  const nodes: Node[] = o.nodelist ?? G.node_list();
  const idx = new Map(nodes.map((n, i) => [hkey(n), i]));
  const A = nodes.map(() => nodes.map(() => o.nonedge as number));
  for (const [u, v, d] of G.edge_list(true)) {
    const i = idx.get(hkey(u)), j = idx.get(hkey(v));
    if (i === undefined || j === undefined) continue;
    const w = o.weight === null ? 1 : (d[o.weight] ?? 1.0);
    A[i][j] = w;
    if (!G.is_directed()) A[j][i] = w;
  }
  return A;
}
export function get_node_attributes(G: NxGraph, name: string): HashDict<any> {
  const d = new HashDict<any>();
  for (const n of G.node_list()) {
    const a = G.node_attr(n);
    if (name in a) d.set(n, a[name]);
  }
  return d;
}
export function set_node_attributes(G: NxGraph, values: any, name: string | null = null): void {
  for (const [n, v] of dict_items(values)) {
    if (!G.has_node(n)) continue;
    if (name === null) Object.assign(G.node_attr(n), v);
    else G.node_attr(n)[name] = v;
  }
}
/** networkx.utils.groups: {value: set of keys}; the sets iterate in CPython order. */
export function groups(many_to_one: HashDict<any>): HashDict<PySet> {
  const out = new HashDict<PySet>();
  for (const [v, k] of many_to_one.items()) {
    if (!out.has(k)) out.set(k, new PySet());
    out.get(k)!.add(v);
  }
  return out;
}

// ---------------------------------------------------------------- generators
const range = (a: number, b?: number): number[] => {
  const [s, e] = b === undefined ? [0, a] : [a, b];
  return Array.from({ length: Math.max(0, e - s) }, (_, i) => s + i);
};
/** networkx's @nodes_or_number: an int n means range(n). */
const nodesOrNumber = (n: any): Node[] => (typeof n === 'number' ? range(n) : Array.from(n as Iterable<Node>));
const pairwise = (xs: Node[], cyclic = false): Node[][] => {
  const out = xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
  if (cyclic && xs.length > 0) out.push([xs[xs.length - 1], xs[0]]);
  return out;
};
const combinations2 = (xs: Node[]): Node[][] => xs.flatMap((x, i) => xs.slice(i + 1).map((y) => [x, y]));
const permutations2 = (xs: Node[]): Node[][] => xs.flatMap((x, i) => xs.filter((_, j) => j !== i).map((y) => [x, y]));
function createUsing(create_using: any): NxGraph {
  if (create_using === null || create_using === undefined) return new NxGraph();
  if (typeof create_using === 'function') return new create_using();
  create_using.clear();
  return create_using;
}

export function empty_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using', 'default'], { n: 0, create_using: null, default: null });
  const G = o.create_using === null && o.default ? new o.default() : createUsing(o.create_using);
  G.add_nodes_from(nodesOrNumber(o.n));
  return G;
}
export function complete_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const nodes = nodesOrNumber(o.n);
  const G = empty_graph(nodes, o.create_using);
  if (nodes.length > 1) G.add_edges_from(G.is_directed() ? permutations2(nodes) : combinations2(nodes));
  return G;
}
export function path_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const nodes = nodesOrNumber(o.n);
  const G = empty_graph(nodes, o.create_using);
  G.add_edges_from(pairwise(nodes));
  return G;
}
export function cycle_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const nodes = nodesOrNumber(o.n);
  const G = empty_graph(nodes, o.create_using);
  G.add_edges_from(pairwise(nodes, true));
  return G;
}
export function star_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const nodes = nodesOrNumber(o.n);
  if (typeof o.n === 'number') nodes.push(o.n);
  const G = empty_graph(nodes, o.create_using);
  if (nodes.length > 1) G.add_edges_from(nodes.slice(1).map((v) => [nodes[0], v]));
  return G;
}
export function wheel_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const nodes = nodesOrNumber(o.n);
  const G = empty_graph(nodes, o.create_using);
  if (nodes.length > 1) {
    const [hub, ...rim] = nodes;
    G.add_edges_from(rim.map((v) => [hub, v]));
    if (rim.length > 1) G.add_edges_from(pairwise(rim, true));
  }
  return G;
}
export function full_rary_tree(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['r', 'n', 'create_using'], { create_using: null });
  const G = empty_graph(o.n, o.create_using);
  if (o.r > 0) G.add_edges_from(range(1, o.n).map((c) => [Math.floor((c - 1) / o.r), c]));
  return G;
}
export function balanced_tree(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['r', 'h', 'create_using'], { create_using: null });
  const n = o.r === 1 ? o.h + 1 : Math.floor((1 - o.r ** (o.h + 1)) / (1 - o.r));
  return full_rary_tree(o.r, n, o.create_using);
}
export function binomial_tree(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const G = empty_graph(1, o.create_using);
  let N = 1;
  for (let i = 0; i < o.n; i++) {
    G.add_edges_from(G.edge_list().map(([u, v]) => [u + N, v + N]));
    G.add_edge(0, N);
    N *= 2;
  }
  return G;
}
export function complete_bipartite_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n1', 'n2', 'create_using'], { create_using: null });
  const G = createUsing(o.create_using);
  const top = nodesOrNumber(o.n1);
  let bottom = nodesOrNumber(o.n2);
  if (typeof o.n1 === 'number' && typeof o.n2 === 'number') bottom = bottom.map((i) => o.n1 + i);
  G.add_nodes_from(top, { bipartite: 0 });
  G.add_nodes_from(bottom, { bipartite: 1 });
  G.add_edges_from(top.flatMap((u) => bottom.map((v) => [u, v])));
  G.graph.name = `complete_bipartite_graph(${top.length}, ${bottom.length})`;
  return G;
}
export function complete_multipartite_graph(...subset_sizes: any[]): NxGraph {
  const G = new NxGraph();
  if (!subset_sizes.length) return G;
  let subsets: Node[][];
  if (subset_sizes.every((s) => typeof s === 'number')) {
    let start = 0;
    subsets = subset_sizes.map((s) => range(start, (start += s)));
  } else subsets = subset_sizes.map((s) => Array.from(s as Iterable<Node>));
  subsets.forEach((s, i) => G.add_nodes_from(s, { subset: i }));
  for (let i = 0; i < subsets.length; i++) for (let j = i + 1; j < subsets.length; j++) G.add_edges_from(subsets[i].flatMap((u) => subsets[j].map((v) => [u, v])));
  return G;
}
export function turan_graph(n: number, r: number): NxGraph {
  const parts = [...Array(r - (n % r)).fill(Math.floor(n / r)), ...Array(n % r).fill(Math.floor(n / r) + 1)];
  return complete_multipartite_graph(...parts);
}
export function ladder_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const G = empty_graph(2 * o.n, o.create_using);
  G.add_edges_from(pairwise(range(o.n)));
  G.add_edges_from(pairwise(range(o.n, 2 * o.n)));
  G.add_edges_from(range(o.n).map((v) => [v, v + o.n]));
  return G;
}
export function circular_ladder_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'create_using'], { create_using: null });
  const G = ladder_graph(o.n, o.create_using);
  G.add_edge(0, o.n - 1);
  G.add_edge(o.n, 2 * o.n - 1);
  return G;
}
export function barbell_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['m1', 'm2', 'create_using'], { create_using: null });
  const { m1, m2 } = o;
  const G = complete_graph(m1, o.create_using);
  G.add_nodes_from(range(m1, m1 + m2 - 1));
  if (m2 > 1) G.add_edges_from(pairwise(range(m1, m1 + m2)));
  G.add_edges_from(range(m1 + m2, 2 * m1 + m2).flatMap((u) => range(u + 1, 2 * m1 + m2).map((v) => [u, v])));
  G.add_edge(m1 - 1, m1);
  if (m2 > 0) G.add_edge(m1 + m2 - 1, m1 + m2);
  return G;
}
export function lollipop_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['m', 'n', 'create_using'], { create_using: null });
  const m_nodes = nodesOrNumber(o.m);
  let n_nodes = nodesOrNumber(o.n);
  if (typeof o.m === 'number' && typeof o.n === 'number') n_nodes = range(m_nodes.length, m_nodes.length + o.n);
  const G = complete_graph(m_nodes, o.create_using);
  G.add_nodes_from(n_nodes);
  if (n_nodes.length > 1) G.add_edges_from(pairwise(n_nodes));
  if (m_nodes.length > 0 && n_nodes.length > 0) G.add_edge(m_nodes[m_nodes.length - 1], n_nodes[0]);
  return G;
}
export function grid_2d_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['m', 'n', 'periodic', 'create_using'], { periodic: false, create_using: null });
  const G = createUsing(o.create_using);
  const rows = nodesOrNumber(o.m), cols = nodesOrNumber(o.n);
  G.add_nodes_from(rows.flatMap((i) => cols.map((j) => [i, j])));
  G.add_edges_from(pairwise(rows).flatMap(([pi, i]) => cols.map((j) => [[i, j], [pi, j]])));
  G.add_edges_from(rows.flatMap((i) => pairwise(cols).map(([pj, j]) => [[i, j], [i, pj]])));
  const [pr, pc] = Array.isArray(o.periodic) ? o.periodic : [o.periodic, o.periodic];
  if (pr && rows.length > 2) G.add_edges_from(cols.map((j) => [[rows[0], j], [rows[rows.length - 1], j]]));
  if (pc && cols.length > 2) G.add_edges_from(rows.map((i) => [[i, cols[0]], [i, cols[cols.length - 1]]]));
  if (G.is_directed()) G.add_edges_from(G.edge_list().map(([u, v]) => [v, u]));
  return G;
}
/** From a dict of neighbour lists. */
export function from_dict_of_lists(d: any, create_using: any = null): NxGraph {
  const G = createUsing(create_using);
  G.add_nodes_from(dict_items(d).map((p) => p[0]));
  G.add_edges_from(dict_items(d).flatMap(([u, nbrs]) => Array.from(nbrs as Iterable<Node>, (v) => [u, v])));
  return G;
}
export function petersen_graph(create_using: any = null): NxGraph {
  const G = from_dict_of_lists({ 0: [1, 4, 5], 1: [0, 2, 6], 2: [1, 3, 7], 3: [2, 4, 8], 4: [3, 0, 9], 5: [0, 7, 8], 6: [1, 8, 9], 7: [2, 5, 9], 8: [3, 5, 6], 9: [4, 6, 7] }, create_using);
  // plain-object keys come back as strings: rebuild with int nodes
  const H = createUsing(create_using);
  H.add_nodes_from(G.node_list().map(Number));
  H.add_edges_from(G.edge_list().map(([u, v]) => [Number(u), Number(v)]));
  H.graph.name = 'Petersen Graph';
  return H;
}
/**
 * Where `seed=None` draws from: numpy's global RandomState and Python's global
 * `random` (networkx's default). Transpiled scenes plug in their `np.random` /
 * `random` modules (ext/py/index.ts), so `np.random.seed(n)` fixes layouts like in manim.
 */
export const global_random: { numpy: { random(): number }; python: { random(): number } } = { numpy: new MT19937(), python: new MT19937() };
/** Python's `random` module state for a networkx `seed` argument. */
function pyRandom(seed: any): { random(): number } {
  if (seed && typeof seed.random === 'function') return seed;
  if (typeof seed !== 'number') return global_random.python;
  const mt = new MT19937();
  python_seed(mt, seed);
  return mt;
}
/** G(n, p) random graph (networkx.gnp_random_graph / erdos_renyi_graph / binomial_graph). */
export function gnp_random_graph(...args: unknown[]): NxGraph {
  const o = pyargs(args, ['n', 'p', 'seed', 'directed', 'create_using'], { seed: null, directed: false, create_using: null });
  const create_using = o.create_using ?? (o.directed ? NxDiGraph : NxGraph);
  if (o.p >= 1) return complete_graph(o.n, create_using);
  const G = empty_graph(o.n, create_using);
  if (o.p <= 0) return G;
  const rng = pyRandom(o.seed);
  const nodes = range(o.n);
  for (const [u, v] of o.directed ? permutations2(nodes) : combinations2(nodes)) if (rng.random() < o.p) G.add_edge(u, v);
  return G;
}
export const erdos_renyi_graph = gnp_random_graph;
export const binomial_graph = gnp_random_graph;
/** Add a path of nodes to G. */
export function add_path(G: NxGraph, nodes: Iterable<Node>, attr: Kwargs = {}): void {
  const ns = Array.from(nodes);
  if (!ns.length) return;
  G.add_node(ns[0]);
  G.add_edges_from(pairwise(ns), attr);
}
export function add_cycle(G: NxGraph, nodes: Iterable<Node>, attr: Kwargs = {}): void {
  const ns = Array.from(nodes);
  if (!ns.length) return;
  G.add_node(ns[0]);
  G.add_edges_from(pairwise(ns, true), attr);
}
export function add_star(G: NxGraph, nodes: Iterable<Node>, attr: Kwargs = {}): void {
  const [c, ...rest] = Array.from(nodes);
  if (c === undefined) return;
  G.add_node(c);
  G.add_edges_from(rest.map((v) => [c, v]), attr);
}
export function relabel_nodes(G: NxGraph, mapping: any, copy = true): NxGraph {
  const f = typeof mapping === 'function' ? mapping : (n: Node) => (dict_has(mapping, n) ? dict_get(mapping, n) : n);
  const H = new (G.constructor as any)() as NxGraph;
  for (const n of G.node_list()) H.add_node(f(n), { ...G.node_attr(n) });
  for (const [u, v, d] of G.edge_list(true)) H.add_edge(f(u), f(v), { ...d });
  if (!copy) {
    G.clear();
    for (const n of H.node_list()) G.add_node(n, H.node_attr(n));
    for (const [u, v, d] of H.edge_list(true)) G.add_edge(u, v, d);
    return G;
  }
  return H;
}

// ---------------------------------------------------------------- numerics
/** networkx.rescale_layout (in place): centre on the mean, then scale so max |coord| = scale. */
export function rescale_layout(pos: number[][], scale = 1): number[][] {
  const n = pos.length;
  if (!n) return pos;
  const dim = pos[0].length;
  for (let k = 0; k < dim; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pos[i][k];
    const mean = s / n;
    for (let i = 0; i < n; i++) pos[i][k] -= mean;
  }
  let lim = 0;
  for (const p of pos) for (const x of p) lim = Math.max(lim, Math.abs(x));
  if (lim > 0) {
    const f = scale / lim;
    for (const p of pos) for (let k = 0; k < dim; k++) p[k] *= f;
  }
  return pos;
}
export function rescale_layout_dict(pos: any, scale = 1): HashDict<number[]> {
  const items = dict_items(pos);
  const arr = rescale_layout(items.map(([, v]) => Array.from(v as number[])), scale);
  return new HashDict(items.map(([k], i) => [k, arr[i]]));
}

const dotv = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** MINPACK-2 dcstep: safeguarded cubic/quadratic step for dcsrch. */
function dcstep(st: { stx: number; fx: number; dx: number; sty: number; fy: number; dy: number; stp: number; brackt: boolean }, fp: number, dp: number, stpmin: number, stpmax: number): void {
  const { stx, fx, dx, sty, fy, dy, stp } = st;
  const sgnd = dp * (dx / Math.abs(dx));
  let stpf: number;
  if (fp > fx) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = s * Math.sqrt((theta / s) ** 2 - (dx / s) * (dp / s));
    if (stp < stx) gamma = -gamma;
    const p = gamma - dx + theta, q = gamma - dx + gamma + dp, r = p / q;
    const stpc = stx + r * (stp - stx);
    const stpq = stx + (dx / ((fx - fp) / (stp - stx) + dx) / 2) * (stp - stx);
    stpf = Math.abs(stpc - stx) < Math.abs(stpq - stx) ? stpc : stpc + (stpq - stpc) / 2;
    st.brackt = true;
  } else if (sgnd < 0) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = s * Math.sqrt((theta / s) ** 2 - (dx / s) * (dp / s));
    if (stp > stx) gamma = -gamma;
    const p = gamma - dp + theta, q = gamma - dp + gamma + dx, r = p / q;
    const stpc = stp + r * (stx - stp);
    const stpq = stp + (dp / (dp - dx)) * (stx - stp);
    stpf = Math.abs(stpc - stp) > Math.abs(stpq - stp) ? stpc : stpq;
    st.brackt = true;
  } else if (Math.abs(dp) < Math.abs(dx)) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = s * Math.sqrt(Math.max(0, (theta / s) ** 2 - (dx / s) * (dp / s)));
    if (stp > stx) gamma = -gamma;
    const p = gamma - dp + theta, q = gamma + (dx - dp) + gamma, r = p / q;
    let stpc: number;
    if (r < 0 && gamma !== 0) stpc = stp + r * (stx - stp);
    else if (stp > stx) stpc = stpmax;
    else stpc = stpmin;
    const stpq = stp + (dp / (dp - dx)) * (stx - stp);
    if (st.brackt) {
      stpf = Math.abs(stpc - stp) < Math.abs(stpq - stp) ? stpc : stpq;
      stpf = stp > stx ? Math.min(stp + 0.66 * (sty - stp), stpf) : Math.max(stp + 0.66 * (sty - stp), stpf);
    } else {
      stpf = Math.abs(stpc - stp) > Math.abs(stpq - stp) ? stpc : stpq;
      stpf = Math.max(stpmin, Math.min(stpmax, stpf));
    }
  } else if (st.brackt) {
    const theta = (3 * (fp - fy)) / (sty - stp) + dy + dp;
    const s = Math.max(Math.abs(theta), Math.abs(dy), Math.abs(dp));
    let gamma = s * Math.sqrt((theta / s) ** 2 - (dy / s) * (dp / s));
    if (stp > sty) gamma = -gamma;
    const p = gamma - dp + theta, q = gamma - dp + gamma + dy, r = p / q;
    stpf = stp + r * (sty - stp);
  } else stpf = stp > stx ? stpmax : stpmin;
  if (fp > fx) {
    st.sty = stp;
    st.fy = fp;
    st.dy = dp;
  } else {
    if (sgnd < 0) {
      st.sty = stx;
      st.fy = fx;
      st.dy = dx;
    }
    st.stx = stp;
    st.fx = fp;
    st.dx = dp;
  }
  st.stp = stpf;
}

/** MINPACK-2 dcsrch (Moré-Thuente line search), as called by L-BFGS-B. */
class Dcsrch {
  declare st: { stx: number; fx: number; dx: number; sty: number; fy: number; dy: number; stp: number; brackt: boolean };
  declare stage: number;
  declare finit: number;
  declare ginit: number;
  declare gtest: number;
  declare width: number;
  declare width1: number;
  declare stmin: number;
  declare stmax: number;
  constructor(public ftol: number, public gtol: number, public xtol: number, public stpmin: number, public stpmax: number) {}
  /** First call: returns 'FG' (evaluate at this.st.stp) or an 'ERROR'. */
  start(f: number, g: number, stp: number): string {
    if (stp < this.stpmin || stp > this.stpmax || g >= 0) return 'ERROR';
    this.st = { stx: 0, fx: f, dx: g, sty: 0, fy: f, dy: g, stp, brackt: false };
    this.stage = 1;
    this.finit = f;
    this.ginit = g;
    this.gtest = this.ftol * g;
    this.width = this.stpmax - this.stpmin;
    this.width1 = this.width / 0.5;
    this.stmin = 0;
    this.stmax = stp + 4.0 * stp;
    return 'FG';
  }
  /** Subsequent calls with f, g at st.stp: 'FG', 'CONVERGENCE' or 'WARNING'. */
  next(f: number, g: number): string {
    const st = this.st;
    const ftest = this.finit + st.stp * this.gtest;
    if (this.stage === 1 && f <= ftest && g >= 0) this.stage = 2;
    let task = '';
    if (st.brackt && (st.stp <= this.stmin || st.stp >= this.stmax)) task = 'WARNING';
    if (st.brackt && this.stmax - this.stmin <= this.xtol * this.stmax) task = 'WARNING';
    if (st.stp === this.stpmax && f <= ftest && g <= this.gtest) task = 'WARNING';
    if (st.stp === this.stpmin && (f > ftest || g >= this.gtest)) task = 'WARNING';
    if (f <= ftest && Math.abs(g) <= this.gtol * -this.ginit) task = 'CONVERGENCE';
    if (task) return task;
    if (this.stage === 1 && f <= st.fx && f > ftest) {
      const gt = this.gtest;
      const fm = f - st.stp * gt;
      st.fx -= st.stx * gt;
      st.fy -= st.sty * gt;
      st.dx -= gt;
      st.dy -= gt;
      dcstep(st, fm, g - gt, this.stmin, this.stmax);
      st.fx += st.stx * gt;
      st.fy += st.sty * gt;
      st.dx += gt;
      st.dy += gt;
    } else dcstep(st, f, g, this.stmin, this.stmax);
    if (st.brackt) {
      if (Math.abs(st.sty - st.stx) >= 0.66 * this.width1) st.stp = st.stx + 0.5 * (st.sty - st.stx);
      this.width1 = this.width;
      this.width = Math.abs(st.sty - st.stx);
    }
    if (st.brackt) {
      this.stmin = Math.min(st.stx, st.sty);
      this.stmax = Math.max(st.stx, st.sty);
    } else {
      this.stmin = st.stp + 1.1 * (st.stp - st.stx);
      this.stmax = st.stp + 4.0 * (st.stp - st.stx);
    }
    st.stp = Math.max(st.stp, this.stpmin);
    st.stp = Math.min(st.stp, this.stpmax);
    if ((st.brackt && (st.stp <= this.stmin || st.stp >= this.stmax)) || (st.brackt && this.stmax - this.stmin <= this.xtol * this.stmax)) st.stp = st.stx;
    return 'FG';
  }
}

/**
 * scipy.optimize.minimize(fun, x0, method='L-BFGS-B', jac=True) without
 * bounds: L-BFGS-B's iteration (first step along -g of length 1/|g|, the
 * limited-memory direction, dcsrch line search, restarts, and scipy's default
 * stopping rules ftol=2.22e-9, gtol=1e-5, maxcor=10).
 */
export function minimize_lbfgsb(fg: (x: Float64Array) => [number, Float64Array], x0: ArrayLike<number>, opts: { maxcor?: number; ftol?: number; gtol?: number; maxiter?: number; maxls?: number; callback?: (x: Float64Array, f: number) => void } = {}): Float64Array {
  const m = opts.maxcor ?? 10, ftol = opts.ftol ?? 2.220446049250313e-9, pgtol = opts.gtol ?? 1e-5;
  const maxiter = opts.maxiter ?? 15000, maxls = opts.maxls ?? 20;
  const n = x0.length;
  const EPS = 2.220446049250313e-16;
  let x = Float64Array.from(x0);
  let [f, g] = fg(x);
  const infnorm = (v: Float64Array) => v.reduce((s, a) => Math.max(s, Math.abs(a)), 0);
  if (infnorm(g) <= pgtol) return x;
  let S: Float64Array[] = [], Y: Float64Array[] = [], R: number[] = [];
  let theta = 1;
  let iter = 0;
  for (let nit = 0; nit < maxiter; ) {
    // direction: z = x - H g (L-BFGS two-loop recursion, H0 = I / theta)
    const z = new Float64Array(n);
    if (S.length === 0) {
      const dtm = dotv(g, g) / (theta * dotv(g, g));
      for (let i = 0; i < n; i++) z[i] = x[i] + dtm * -g[i];
    } else {
      const q = Float64Array.from(g, (v) => -v);
      const alpha = new Array(S.length);
      for (let i = S.length - 1; i >= 0; i--) {
        alpha[i] = dotv(S[i], q) / R[i];
        for (let j = 0; j < n; j++) q[j] -= alpha[i] * Y[i][j];
      }
      for (let j = 0; j < n; j++) q[j] /= theta;
      for (let i = 0; i < S.length; i++) {
        const beta = dotv(Y[i], q) / R[i];
        for (let j = 0; j < n; j++) q[j] += S[i][j] * (alpha[i] - beta);
      }
      for (let i = 0; i < n; i++) z[i] = x[i] + q[i];
    }
    const d = Float64Array.from(z, (v, i) => v - x[i]);
    // line search (lnsrlb)
    const dtd = dotv(d, d);
    const dnorm = Math.sqrt(dtd);
    const t = x.slice(), r = g.slice(), fold = f;
    const ls = new Dcsrch(1e-3, 0.9, 0.1, 0, 1e10);
    let stp = iter === 0 ? Math.min(1 / dnorm, 1e10) : 1;
    let gd = dotv(g, d);
    const gdold = gd;
    let ok = gd < 0;
    let ifun = 0, iback = 0;
    if (ok) {
      let task = ls.start(f, gd, stp);
      for (;;) {
        if (task === 'FG') {
          stp = ls.st.stp;
          ifun++;
          iback = ifun - 1;
          if (iback >= maxls) {
            ok = false;
            break;
          }
          x = stp === 1 ? z.slice() : Float64Array.from(d, (v, i) => stp * v + t[i]);
          [f, g] = fg(x);
          gd = dotv(g, d);
          task = ls.next(f, gd);
        } else if (task === 'ERROR') {
          ok = false;
          break;
        } else break;
      }
      stp = ls.st.stp;
    }
    if (!ok) {
      x = t;
      g = r;
      f = fold;
      if (S.length === 0) return x;
      S = [];
      Y = [];
      R = [];
      theta = 1;
      continue;
    }
    iter++;
    nit++;
    opts.callback?.(x, f);
    if (infnorm(g) <= pgtol) break;
    if (fold - f <= ftol * Math.max(Math.abs(fold), Math.abs(f), 1)) break;
    const y = Float64Array.from(g, (v, i) => v - r[i]);
    const rr = dotv(y, y);
    let dr: number, ddum: number;
    if (stp === 1) {
      dr = gd - gdold;
      ddum = -gdold;
    } else {
      dr = (gd - gdold) * stp;
      for (let i = 0; i < n; i++) d[i] *= stp;
      ddum = -gdold * stp;
    }
    if (dr <= EPS * ddum) continue;
    S.push(d);
    Y.push(y);
    R.push(dr);
    if (S.length > m) {
      S.shift();
      Y.shift();
      R.shift();
    }
    theta = rr / dr;
  }
  return x;
}

/** Eigen-decomposition of a symmetric matrix (cyclic Jacobi): [values, vectors as columns]. */
export function symmetric_eig(A: number[][]): [number[], number[][]] {
  const n = A.length;
  const a = A.map((row) => row.slice());
  const V: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const tau = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return [a.map((row, i) => row[i]), V];
}

// numpy's float32 sin/cos (Cody-Waite reduction + minimax polynomials with
// FMA, max 1.5 ulp) - networkx computes circle angles in float32, and these
// differ from correctly rounded values in the last bit.
const f32 = Math.fround;
const fma32 = (a: number, b: number, c: number) => f32(a * b + c);
// float32 constants 0x1.45f306p-1, -0x1.921fb0p+0, -0x1.5110b4p-22, -0x1.846988p-48
const TWO_OVER_PI = 0.6366197466850281, PIO2_HI = -1.570796012878418, PIO2_MED = -3.1391647326017846e-7, PIO2_LO = -5.390302529957765e-15;
const RINT_MAGIC = 12582912;
const COS_C = [0.000024372266125283204, -0.001388652017340064, 0.04166661947965622, -0.5, 1];
const SIN_C = [0.0000028404097065504175, -0.00019856491417158395, 0.008333397097885609, -0.1666666716337204];
function np_sincos_f32(x: number, cos: boolean): number {
  x = f32(x);
  if (Math.abs(x) > (cos ? 71476.0625 : 117435.992) || !Number.isFinite(x)) return f32(cos ? Math.cos(x) : Math.sin(x));
  const q = f32(f32(f32(x * TWO_OVER_PI) + RINT_MAGIC) - RINT_MAGIC);
  let r = fma32(q, PIO2_HI, x);
  r = fma32(q, PIO2_MED, r);
  r = fma32(q, PIO2_LO, r);
  const r2 = f32(r * r);
  let c = fma32(COS_C[0], r2, COS_C[1]);
  for (let k = 2; k < 5; k++) c = fma32(c, r2, COS_C[k]);
  let s = fma32(SIN_C[0], r2, SIN_C[1]);
  s = fma32(s, r2, SIN_C[2]);
  s = fma32(s, r2, SIN_C[3]);
  s = fma32(s, r2, 0);
  s = fma32(s, r, r);
  const iq = ((q | 0) + (cos ? 1 : 0)) >>> 0;
  const v = (iq & 1) === 0 ? s : c;
  return (iq & 2) === 2 ? -v : v;
}
/** numpy.cos on a float32 value. */
export const np_cos_f32 = (x: number): number => np_sincos_f32(x, true);
/** numpy.sin on a float32 value. */
export const np_sin_f32 = (x: number): number => np_sincos_f32(x, false);

// ---------------------------------------------------------------- layouts
/** numpy.random.RandomState for a networkx `seed` (None: numpy's global state). */
function npRandom(seed: any): { random(): number } {
  if (seed && typeof seed.random_sample === 'function') return { random: () => seed.random_sample() };
  if (seed && typeof seed.random === 'function') return seed;
  if (typeof seed !== 'number') return global_random.numpy;
  return new MT19937(seed >>> 0);
}
function processParams(G: any, center: any, dim: number): [NxGraph, number[]] {
  const c = center === null || center === undefined ? new Array(dim).fill(0) : Array.from(center as number[]);
  if (c.length !== dim) throw new Error('ValueError: length of center coordinates must match dimension of layout');
  return [asGraph(G), c];
}
const toDict = (nodes: Node[], pos: number[][], center: number[]): HashDict<number[]> =>
  new HashDict(nodes.map((n, i) => [n, pos[i].map((v, k) => v + (center[k] ?? 0))]));
const storePos = (G: NxGraph, pos: HashDict<number[]>, name: string | null) => {
  if (name !== null && name !== undefined) set_node_attributes(G, pos, name);
  return pos;
};

/** networkx.random_layout: uniform in [0, 1)^dim (float32, like networkx). */
export function random_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'center', 'dim', 'seed', 'store_pos_as'], { center: null, dim: 2, seed: null, store_pos_as: null });
  const [G, center] = processParams(o.G, o.center, o.dim);
  const rng = npRandom(o.seed);
  const nodes = G.node_list();
  const pos = nodes.map(() => Array.from({ length: o.dim }, () => rng.random()));
  return storePos(G, new HashDict(nodes.map((n, i) => [n, pos[i].map((v, k) => f32(v + center[k]))])), o.store_pos_as);
}
/** networkx.circular_layout: nodes on a circle, in node order. */
export function circular_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'scale', 'center', 'dim', 'store_pos_as'], { scale: 1, center: null, dim: 2, store_pos_as: null });
  if (o.dim < 2) throw new Error('ValueError: cannot handle dimensions < 2');
  const [G, center] = processParams(o.G, o.center, o.dim);
  const nodes = G.node_list(), n = nodes.length;
  if (n === 0) return new HashDict();
  if (n === 1) return storePos(G, new HashDict([[nodes[0], center]]), o.store_pos_as);
  const step = 1 / n;
  const pos = nodes.map((_, i) => {
    const theta = f32(i * step * 2 * Math.PI);
    return [np_cos_f32(theta), np_sin_f32(theta), ...new Array(o.dim - 2).fill(0)];
  });
  return storePos(G, toDict(nodes, rescale_layout(pos, o.scale), center), o.store_pos_as);
}
/** networkx.shell_layout: concentric circles (float32 angles, like networkx). */
export function shell_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'nlist', 'rotate', 'scale', 'center', 'dim', 'store_pos_as'], { nlist: null, rotate: null, scale: 1, center: null, dim: 2, store_pos_as: null });
  if (o.dim !== 2) throw new Error('ValueError: can only handle 2 dimensions');
  const [G, center] = processParams(o.G, o.center, o.dim);
  const all = G.node_list();
  if (all.length === 0) return new HashDict();
  if (all.length === 1) return new HashDict([[all[0], center]]);
  const nlist: Node[][] = o.nlist ? Array.from(o.nlist as Iterable<Iterable<Node>>, (l) => Array.from(l)) : [all];
  const radius_bump = o.scale / nlist.length;
  let radius = nlist[0].length === 1 ? 0.0 : radius_bump;
  const rotate = o.rotate ?? Math.PI / nlist.length;
  let first_theta = rotate;
  const npos = new HashDict<number[]>();
  for (const nodes of nlist) {
    const step = (2 * Math.PI) / nodes.length;
    nodes.forEach((v, i) => {
      const theta = f32(f32(i * step) + f32(first_theta));
      npos.set(v, [f32(f32(radius) * np_cos_f32(theta)) + center[0], f32(f32(radius) * np_sin_f32(theta)) + center[1]]);
    });
    radius += radius_bump;
    first_theta += rotate;
  }
  return storePos(G, npos, o.store_pos_as);
}
/** networkx.bipartite_layout: two columns. */
export function bipartite_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'nodes', 'align', 'scale', 'center', 'aspect_ratio', 'store_pos_as'], { nodes: null, align: 'vertical', scale: 1, center: null, aspect_ratio: 4 / 3, store_pos_as: null });
  const [G, center] = processParams(o.G, o.center, 2);
  if (G.__len__() === 0) return new HashDict();
  const width = o.aspect_ratio;
  const top = new PySet<Node>(o.nodes ?? []);
  const bottom = new PySet<Node>(G.node_list().filter((v) => !top.has(v)));
  const nodes = [...top, ...bottom];
  const lin = (k: number) => (k === 1 ? [0] : Array.from({ length: k }, (_, i) => (i === k - 1 ? 1 : i * (1 / (k - 1)))));
  const pos = [...lin(top.size).map((y) => [0 - width / 2, y - 0.5]), ...lin(bottom.size).map((y) => [width - width / 2, y - 0.5])];
  rescale_layout(pos, o.scale);
  const out = pos.map((p) => (o.align === 'horizontal' ? [p[1] + center[1], p[0] + center[0]] : [p[0] + center[0], p[1] + center[1]]));
  return storePos(G, new HashDict(nodes.map((n, i) => [n, out[i]])), o.store_pos_as);
}
/**
 * networkx.spring_layout (Fruchterman-Reingold, dense "force" method).
 * web: graphs with >= 500 nodes also use the dense method (networkx switches to
 * its sparse "energy" optimiser there).
 */
export function spring_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'k', 'pos', 'fixed', 'iterations', 'threshold', 'weight', 'scale', 'center', 'dim', 'seed', 'store_pos_as'], {
    k: null, pos: null, fixed: null, iterations: 50, threshold: 1e-4, weight: 'weight', scale: 1, center: null, dim: 2, seed: null, store_pos_as: null,
  });
  const [G, center] = processParams(o.G, o.center, o.dim);
  const nodes = G.node_list(), n = nodes.length;
  const rng = npRandom(o.seed);
  let fixed: number[] | null = null;
  let pos_arr: number[][] | null = null;
  let k: number | null = o.k;
  if (o.fixed !== null) {
    if (o.pos === null) throw new Error('ValueError: nodes are fixed without positions given');
    const idx = new Map(nodes.map((v, i) => [hkey(v), i]));
    fixed = Array.from(o.fixed as Iterable<Node>).filter((v) => idx.has(hkey(v))).map((v) => idx.get(hkey(v))!);
  }
  let dom_size = 1;
  if (o.pos !== null) {
    dom_size = Math.max(...dict_items(o.pos).flatMap(([, p]) => Array.from(p as number[])));
    if (dom_size === 0) dom_size = 1;
    pos_arr = nodes.map(() => Array.from({ length: o.dim }, (_, d) => rng.random() * dom_size + center[d]));
    nodes.forEach((v, i) => {
      if (dict_has(o.pos, v)) pos_arr![i] = Array.from(dict_get(o.pos, v) as number[]);
    });
  }
  if (n === 0) return new HashDict();
  if (n === 1) return storePos(G, new HashDict([[nodes[0], center]]), o.store_pos_as);
  const A = to_numpy_array(G, { weight: o.weight });
  if (k === null && fixed !== null) k = dom_size / Math.sqrt(n);
  let pos = fruchterman_reingold(A, k, pos_arr, fixed, o.iterations, o.threshold, o.dim, rng);
  if (fixed === null && o.scale !== null) pos = rescale_layout(pos, o.scale);
  else center.fill(0);
  return storePos(G, toDict(nodes, pos, center), o.store_pos_as);
}
export const fruchterman_reingold_layout = spring_layout;

function fruchterman_reingold(A: number[][], k: number | null, pos0: number[][] | null, fixed: number[] | null, iterations: number, threshold: number, dim: number, rng: { random(): number }): number[][] {
  const n = A.length;
  const pos = pos0 ?? Array.from({ length: n }, () => Array.from({ length: dim }, () => rng.random()));
  const kk = k ?? Math.sqrt(1.0 / n);
  const col = (d: number) => pos.map((p) => p[d]);
  let t = Math.max(Math.max(...col(0)) - Math.min(...col(0)), Math.max(...col(1)) - Math.min(...col(1))) * 0.1;
  const dt = t / (iterations + 1);
  const fixedSet = new Set(fixed ?? []);
  const delta = new Float64Array(dim);
  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => new Array(dim).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let d2 = 0;
        for (let c = 0; c < dim; c++) {
          delta[c] = pos[i][c] - pos[j][c];
          d2 += delta[c] * delta[c];
        }
        const dist = Math.max(Math.sqrt(d2), 0.01);
        const f = (kk * kk) / dist ** 2 - (A[i][j] * dist) / kk;
        for (let c = 0; c < dim; c++) disp[i][c] += delta[c] * f;
      }
    }
    let sq = 0;
    for (let i = 0; i < n; i++) {
      let l2 = 0;
      for (let c = 0; c < dim; c++) l2 += disp[i][c] * disp[i][c];
      const length = Math.max(Math.sqrt(l2), 0.01);
      for (let c = 0; c < dim; c++) {
        const dp = fixedSet.has(i) ? 0 : disp[i][c] * (t / length);
        pos[i][c] += dp;
        sq += dp * dp;
      }
    }
    t -= dt;
    if (Math.sqrt(sq) / n < threshold) break;
  }
  return pos;
}

/** networkx.kamada_kawai_layout: minimises the Kamada-Kawai energy with L-BFGS from the circular layout. */
export function kamada_kawai_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'dist', 'pos', 'weight', 'scale', 'center', 'dim', 'store_pos_as'], { dist: null, pos: null, weight: 'weight', scale: 1, center: null, dim: 2, store_pos_as: null });
  const [G, center] = processParams(o.G, o.center, o.dim);
  const nodes = G.node_list(), n = nodes.length;
  if (n === 0) return new HashDict();
  const dist = o.dist ?? shortest_path_length(G, { weight: o.weight });
  const dist_mtx = nodes.map(() => new Array(n).fill(1e6));
  nodes.forEach((nr, row) => {
    if (!dict_has(dist, nr)) return;
    const rdist = dict_get(dist, nr);
    nodes.forEach((nc, c) => {
      if (dict_has(rdist, nc)) dist_mtx[row][c] = dict_get(rdist, nc);
    });
  });
  let pos: any = o.pos;
  if (pos === null) {
    if (o.dim >= 3) pos = random_layout(G, { dim: o.dim });
    else if (o.dim === 2) pos = circular_layout(G, { dim: o.dim });
    else pos = new HashDict(nodes.map((v, i) => [v, [n === 1 ? 0 : i * (1 / (n - 1))]]));
  }
  const x0 = nodes.flatMap((v) => Array.from(dict_get(pos, v) as number[]));
  const res = kamada_kawai_solve(dist_mtx, x0, o.dim);
  return storePos(G, toDict(nodes, rescale_layout(res, o.scale), center), o.store_pos_as);
}
function kamada_kawai_solve(dist_mtx: number[][], x0: number[], dim: number): number[][] {
  const n = dist_mtx.length;
  const meanweight = 0.001;
  const invdist = dist_mtx.map((row, i) => row.map((d, j) => 1 / (d + (i === j ? 0.001 : 0))));
  const fg = (x: Float64Array): [number, Float64Array] => {
    const grad = new Float64Array(n * dim);
    let cost = 0;
    const delta = new Float64Array(dim);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let d2 = 0;
        for (let c = 0; c < dim; c++) {
          delta[c] = x[i * dim + c] - x[j * dim + c];
          d2 += delta[c] * delta[c];
        }
        const nodesep = Math.sqrt(d2);
        const inv = 1 / (nodesep + (i === j ? 0.001 : 0));
        const offset = i === j ? 0 : nodesep * invdist[i][j] - 1.0;
        cost += offset * offset;
        const w = invdist[i][j] * offset * inv;
        for (let c = 0; c < dim; c++) {
          grad[i * dim + c] += w * delta[c];
          grad[j * dim + c] -= w * delta[c];
        }
      }
    }
    cost *= 0.5;
    const sumpos = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) for (let c = 0; c < dim; c++) sumpos[c] += x[i * dim + c];
    cost += 0.5 * meanweight * sumpos.reduce((s, v) => s + v * v, 0);
    for (let i = 0; i < n; i++) for (let c = 0; c < dim; c++) grad[i * dim + c] += meanweight * sumpos[c];
    return [cost, grad];
  };
  const x = minimize_lbfgsb(fg, x0);
  return Array.from({ length: n }, (_, i) => Array.from(x.subarray(i * dim, (i + 1) * dim)));
}

/**
 * networkx.spectral_layout: eigenvectors of the graph Laplacian.
 * web: eigenvectors come from a Jacobi solver; their sign (and the basis of
 * repeated eigenvalues) may differ from LAPACK's, mirroring the layout.
 */
export function spectral_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'weight', 'scale', 'center', 'dim', 'store_pos_as'], { weight: 'weight', scale: 1, center: null, dim: 2, store_pos_as: null });
  const [G, center] = processParams(o.G, o.center, o.dim);
  const nodes = G.node_list(), n = nodes.length;
  if (n <= 2) {
    const pos = n === 0 ? [] : n === 1 ? [center] : [new Array(o.dim).fill(0), center.map((c) => c * 2.0)];
    return new HashDict(nodes.map((v, i) => [v, pos[i]]));
  }
  const A = to_numpy_array(G, { weight: o.weight });
  if (G.is_directed()) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i < j) A[i][j] = A[j][i] = A[i][j] + A[j][i];
  const deg = A.map((row) => row.reduce((s, v) => s + v, 0));
  const L = A.map((row, i) => row.map((v, j) => (i === j ? deg[i] : 0) - v));
  const [vals, vecs] = symmetric_eig(L);
  const sorted = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const cols = sorted.map((k) => vecs.map((row) => row[k]));
  // web: numpy's eig (LAPACK) fixes neither the sign of an eigenvector nor the
  // basis of a repeated eigenvalue. Deterministic choices that reproduce
  // numpy on manim's examples: a simple eigenvector has its largest-magnitude
  // component positive; a repeated eigenvalue's basis starts with the
  // projection of node 0 (as LAPACK's Hessenberg reduction starts from e_1),
  // then Gram-Schmidt of the projections of the last nodes.
  for (let a = 0; a < n; ) {
    let b = a + 1;
    while (b < n && Math.abs(vals[sorted[b]] - vals[sorted[a]]) <= 1e-8 * Math.max(1, Math.abs(vals[sorted[a]]))) b++;
    const group = cols.slice(a, b);
    if (group.length === 1) {
      const v = group[0];
      let big = 0;
      for (let i = 0; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[big]) + 1e-12) big = i;
      if (v[big] < 0) for (let i = 0; i < n; i++) v[i] = -v[i];
    } else {
      const proj = (k: number) => Array.from({ length: n }, (_, i) => group.reduce((s, v) => s + v[i] * v[k], 0));
      const basis: number[][] = [];
      for (const k of [0, ...range(n).slice(1).reverse()]) {
        if (basis.length === group.length) break;
        const q = proj(k);
        for (const bv of basis) {
          const d = dotv(bv, q);
          for (let i = 0; i < n; i++) q[i] -= d * bv[i];
        }
        const nq = Math.sqrt(dotv(q, q));
        if (nq < 1e-8) continue;
        const sgn = q[k] < 0 ? -1 : 1;
        basis.push(q.map((x) => (sgn * x) / nq));
      }
      if (basis.length === group.length) basis.forEach((bv, j) => (cols[a + j] = bv));
    }
    a = b;
  }
  const pos = nodes.map((_, i) => {
    const p = cols.slice(1, o.dim + 1).map((v) => v[i]);
    while (p.length < o.dim) p.push(0);
    return p;
  });
  return storePos(G, toDict(nodes, rescale_layout(pos, o.scale), center), o.store_pos_as);
}
/** networkx.spiral_layout. */
export function spiral_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'scale', 'center', 'dim', 'resolution', 'equidistant', 'store_pos_as'], { scale: 1, center: null, dim: 2, resolution: 0.35, equidistant: false, store_pos_as: null });
  if (o.dim !== 2) throw new Error('ValueError: can only handle 2 dimensions');
  const [G, center] = processParams(o.G, o.center, o.dim);
  const nodes = G.node_list();
  if (nodes.length === 0) return new HashDict();
  if (nodes.length === 1) return storePos(G, new HashDict([[nodes[0], center]]), o.store_pos_as);
  let pos: number[][];
  if (o.equidistant) {
    const chord = 1, step = 0.5;
    let theta = o.resolution;
    theta += chord / (step * theta);
    pos = nodes.map(() => {
      const r = step * theta;
      theta += chord / r;
      return [Math.cos(theta) * r, Math.sin(theta) * r];
    });
  } else pos = nodes.map((_, i) => [i * Math.cos(o.resolution * i), i * Math.sin(o.resolution * i)]);
  return storePos(G, toDict(nodes, rescale_layout(pos, o.scale), center), o.store_pos_as);
}
/** networkx.multipartite_layout: one column per subset (node attribute `subset_key` or a dict of layers). */
export function multipartite_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'subset_key', 'align', 'scale', 'center', 'store_pos_as'], { subset_key: 'subset', align: 'vertical', scale: 1, center: null, store_pos_as: null });
  if (o.align !== 'vertical' && o.align !== 'horizontal') throw new Error('ValueError: align must be either vertical or horizontal.');
  const [G, center] = processParams(o.G, o.center, 2);
  if (G.__len__() === 0) return new HashDict();
  let layers: [any, Iterable<Node>][];
  if (typeof o.subset_key === 'string') {
    const node_to_subset = get_node_attributes(G, o.subset_key);
    if (node_to_subset.size !== G.__len__()) throw nxError(`all nodes need a subset_key attribute: ${o.subset_key}`);
    layers = groups(node_to_subset).items();
  } else {
    layers = dict_items(o.subset_key);
    if (G.__len__() !== layers.reduce((s, [, l]) => s + Array.from(l).length, 0)) throw nxError('all nodes must be in one subset of `subset_key` dict');
  }
  const keys = layers.map((l) => l[0]);
  if (keys.every((k) => typeof k === 'number') || keys.every((k) => typeof k === 'string')) layers = layers.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const width = layers.length;
  const pos: number[][] = [];
  const nodes: Node[] = [];
  layers.forEach(([, layer], i) => {
    const ls = Array.from(layer);
    const height = ls.length;
    ls.forEach((v, y) => pos.push([i - (width - 1) / 2, y - (height - 1) / 2]));
    nodes.push(...ls);
  });
  rescale_layout(pos, o.scale);
  const out = pos.map((p) => [p[0] + center[0], p[1] + center[1]]);
  if (o.align === 'horizontal') out.forEach((p) => p.reverse());
  return storePos(G, new HashDict(nodes.map((n, i) => [n, out[i]])), o.store_pos_as);
}

// ---------------------------------------------------------------- planarity (Left-Right planarity test)
type Edge = [Node, Node];
const edgeEq = (a: Edge | null | undefined, b: Edge | null | undefined): boolean => !!a && !!b && hkey(a[0]) === hkey(b[0]) && hkey(a[1]) === hkey(b[1]);
class Interval {
  constructor(public low: Edge | null = null, public high: Edge | null = null) {}
  empty(): boolean {
    return this.low === null && this.high === null;
  }
  copy(): Interval {
    return new Interval(this.low, this.high);
  }
  conflicting(b: Edge, st: LRPlanarity): boolean {
    return !this.empty() && st.lowpt.get(this.high)! > st.lowpt.get(b)!;
  }
}
// networkx's ConflictPair uses shared mutable default Intervals; keep that behaviour
const DEFAULT_LEFT = new Interval(), DEFAULT_RIGHT = new Interval();
class ConflictPair {
  constructor(public left: Interval = DEFAULT_LEFT, public right: Interval = DEFAULT_RIGHT) {}
  swap(): void {
    [this.left, this.right] = [this.right, this.left];
  }
  lowest(st: LRPlanarity): number {
    if (this.left.empty()) return st.lowpt.get(this.right.low)!;
    if (this.right.empty()) return st.lowpt.get(this.left.low)!;
    return Math.min(st.lowpt.get(this.left.low)!, st.lowpt.get(this.right.low)!);
  }
}
const top_of_stack = <T>(l: T[]): T | null => (l.length ? l[l.length - 1] : null);

/** networkx's LRPlanarity (recursive variant; same embedding as the iterative one). */
class LRPlanarity {
  G: NxGraph;
  roots: Node[] = [];
  height = new HashDict<number | null>();
  lowpt = new HashDict<number>();
  lowpt2 = new HashDict<number>();
  nesting_depth = new HashDict<number>();
  parent_edge = new HashDict<Edge | null>();
  DG = new NxDiGraph();
  ordered_adjs = new HashDict<Node[]>();
  ref = new HashDict<Edge | null>();
  side = new HashDict<number>();
  S: ConflictPair[] = [];
  stack_bottom = new HashDict<ConflictPair | null>();
  lowpt_edge = new HashDict<Edge>();
  left_ref = new HashDict<Node>();
  right_ref = new HashDict<Node>();
  embedding = new PlanarEmbedding();
  constructor(G: NxGraph) {
    this.G = new NxGraph();
    this.G.add_nodes_from(G.node_list());
    for (const [u, v] of G.edge_list()) if (hkey(u) !== hkey(v)) this.G.add_edge(u, v);
    this.DG.add_nodes_from(G.node_list());
  }
  private h(v: Node): number | null {
    return this.height.get(v) ?? null;
  }
  private sideOf(e: Edge | null): number {
    return this.side.get(e) ?? 1;
  }
  lr_planarity(): PlanarEmbedding | null {
    if (this.G.order() > 2 && this.G.size() > 3 * this.G.order() - 6) return null;
    for (const v of this.G.node_list()) {
      if (this.h(v) === null) {
        this.height.set(v, 0);
        this.roots.push(v);
        this.dfs_orientation(v);
      }
    }
    const sortAdj = (v: Node) => this.DG.neighbors(v).slice().sort((a, b) => this.nesting_depth.get([v, a])! - this.nesting_depth.get([v, b])!);
    for (const v of this.DG.node_list()) this.ordered_adjs.set(v, sortAdj(v));
    for (const v of this.roots) if (!this.dfs_testing(v)) return null;
    for (const e of this.DG.edge_list() as Edge[]) this.nesting_depth.set(e, this.sign(e) * this.nesting_depth.get(e)!);
    this.embedding.add_nodes_from(this.DG.node_list());
    for (const v of this.DG.node_list()) {
      this.ordered_adjs.set(v, sortAdj(v));
      let previous: Node = null;
      for (const w of this.ordered_adjs.get(v)!) {
        this.embedding.add_half_edge(v, w, { ccw: previous });
        previous = w;
      }
    }
    for (const v of this.roots) this.dfs_embedding(v);
    return this.embedding;
  }
  dfs_orientation(v: Node): void {
    const e = this.parent_edge.get(v) ?? null;
    for (const w of this.G.neighbors(v)) {
      if (this.DG.has_edge(v, w) || this.DG.has_edge(w, v)) continue;
      const vw: Edge = [v, w];
      this.DG.add_edge(v, w);
      this.lowpt.set(vw, this.h(v)!);
      this.lowpt2.set(vw, this.h(v)!);
      if (this.h(w) === null) {
        this.parent_edge.set(w, vw);
        this.height.set(w, this.h(v)! + 1);
        this.dfs_orientation(w);
      } else this.lowpt.set(vw, this.h(w)!);
      this.nesting_depth.set(vw, 2 * this.lowpt.get(vw)!);
      if (this.lowpt2.get(vw)! < this.h(v)!) this.nesting_depth.set(vw, this.nesting_depth.get(vw)! + 1);
      if (e !== null) {
        if (this.lowpt.get(vw)! < this.lowpt.get(e)!) {
          this.lowpt2.set(e, Math.min(this.lowpt.get(e)!, this.lowpt2.get(vw)!));
          this.lowpt.set(e, this.lowpt.get(vw)!);
        } else if (this.lowpt.get(vw)! > this.lowpt.get(e)!) this.lowpt2.set(e, Math.min(this.lowpt2.get(e)!, this.lowpt.get(vw)!));
        else this.lowpt2.set(e, Math.min(this.lowpt2.get(e)!, this.lowpt2.get(vw)!));
      }
    }
  }
  dfs_testing(v: Node): boolean {
    const e = this.parent_edge.get(v) ?? null;
    const adjs = this.ordered_adjs.get(v)!;
    for (const w of adjs) {
      const ei: Edge = [v, w];
      this.stack_bottom.set(ei, top_of_stack(this.S));
      if (edgeEq(ei, this.parent_edge.get(w))) {
        if (!this.dfs_testing(w)) return false;
      } else {
        this.lowpt_edge.set(ei, ei);
        this.S.push(new ConflictPair(undefined, new Interval(ei, ei)));
      }
      if (this.lowpt.get(ei)! < this.h(v)!) {
        if (hkey(w) === hkey(adjs[0])) this.lowpt_edge.set(e, this.lowpt_edge.get(ei)!);
        else if (!this.add_constraints(ei, e!)) return false;
      }
    }
    if (e !== null) this.remove_back_edges(e);
    return true;
  }
  add_constraints(ei: Edge, e: Edge): boolean {
    const P = new ConflictPair();
    for (;;) {
      const Q = this.S.pop()!;
      if (!Q.left.empty()) Q.swap();
      if (!Q.left.empty()) return false;
      if (this.lowpt.get(Q.right.low)! > this.lowpt.get(e)!) {
        if (P.right.empty()) P.right = Q.right.copy();
        else this.ref.set(P.right.low, Q.right.high);
        P.right.low = Q.right.low;
      } else this.ref.set(Q.right.low, this.lowpt_edge.get(e)!);
      if (top_of_stack(this.S) === (this.stack_bottom.get(ei) ?? null)) break;
    }
    while (top_of_stack(this.S)!.left.conflicting(ei, this) || top_of_stack(this.S)!.right.conflicting(ei, this)) {
      const Q = this.S.pop()!;
      if (Q.right.conflicting(ei, this)) Q.swap();
      if (Q.right.conflicting(ei, this)) return false;
      this.ref.set(P.right.low, Q.right.high);
      if (Q.right.low !== null) P.right.low = Q.right.low;
      if (P.left.empty()) P.left = Q.left.copy();
      else this.ref.set(P.left.low, Q.left.high);
      P.left.low = Q.left.low;
    }
    if (!(P.left.empty() && P.right.empty())) this.S.push(P);
    return true;
  }
  remove_back_edges(e: Edge): void {
    const u = e[0];
    while (this.S.length && top_of_stack(this.S)!.lowest(this) === this.h(u)) {
      const P = this.S.pop()!;
      if (P.left.low !== null) this.side.set(P.left.low, -1);
    }
    if (this.S.length) {
      const P = this.S.pop()!;
      while (P.left.high !== null && hkey(P.left.high[1]) === hkey(u)) P.left.high = this.ref.get(P.left.high) ?? null;
      if (P.left.high === null && P.left.low !== null) {
        this.ref.set(P.left.low, P.right.low);
        this.side.set(P.left.low, -1);
        P.left.low = null;
      }
      while (P.right.high !== null && hkey(P.right.high[1]) === hkey(u)) P.right.high = this.ref.get(P.right.high) ?? null;
      if (P.right.high === null && P.right.low !== null) {
        this.ref.set(P.right.low, P.left.low);
        this.side.set(P.right.low, -1);
        P.right.low = null;
      }
      this.S.push(P);
    }
    if (this.lowpt.get(e)! < this.h(u)!) {
      const hl = top_of_stack(this.S)!.left.high, hr = top_of_stack(this.S)!.right.high;
      if (hl !== null && (hr === null || this.lowpt.get(hl)! > this.lowpt.get(hr)!)) this.ref.set(e, hl);
      else this.ref.set(e, hr);
    }
  }
  dfs_embedding(v: Node): void {
    for (const w of this.ordered_adjs.get(v)!) {
      const ei: Edge = [v, w];
      if (edgeEq(ei, this.parent_edge.get(w))) {
        this.embedding.add_half_edge_first(w, v);
        this.left_ref.set(v, w);
        this.right_ref.set(v, w);
        this.dfs_embedding(w);
      } else if (this.sideOf(ei) === 1) this.embedding.add_half_edge(w, v, { ccw: this.right_ref.get(w) });
      else {
        this.embedding.add_half_edge(w, v, { cw: this.left_ref.get(w) });
        this.left_ref.set(w, v);
      }
    }
  }
  sign(e: Edge): number {
    const r = this.ref.get(e) ?? null;
    if (r !== null) {
      this.side.set(e, this.sideOf(e) * this.sign(r));
      this.ref.set(e, null);
    }
    return this.sideOf(e);
  }
}

/** networkx.PlanarEmbedding: a DiGraph of half-edges with cw/ccw neighbour references. */
export class PlanarEmbedding extends NxDiGraph {
  constructor(...args: unknown[]) {
    super();
    const data = args[0];
    if (data instanceof NxGraph) {
      Object.assign(this.graph, data.graph);
      for (const r of data._node.values()) super.add_node(r.n, { ...r.attr });
      for (const [k, nbrs] of data._adj) for (const r of nbrs.values()) super.add_edge(data._node.get(k)!.n, r.n, { ...r.attr });
    }
  }
  override is_directed(): boolean {
    return false;
  }
  private succs(v: Node): Map<string, Rec> | undefined {
    return this._adj.get(hkey(v));
  }
  private lastKey(m: Map<string, Rec>): string {
    let last = '';
    for (const k of m.keys()) last = k;
    return last;
  }
  /** The neighbours of v in clockwise order. */
  neighbors_cw_order(v: Node): Node[] {
    const succs = this.succs(v)!;
    if (!succs.size) return [];
    const startK = this.lastKey(succs);
    const out: Node[] = [succs.get(startK)!.n];
    let cur = succs.get(startK)!.attr.cw;
    while (hkey(cur) !== startK) {
      out.push(cur);
      cur = succs.get(hkey(cur))!.attr.cw;
    }
    return out;
  }
  add_half_edge(start_node: Node, end_node: Node, kw: { cw?: Node; ccw?: Node } = {}): void {
    const cw = kw.cw ?? null, ccw = kw.ccw ?? null;
    const succs = this.succs(start_node);
    if (succs && succs.size) {
      const leftmost = this.lastKey(succs);
      let move: boolean;
      if (cw !== null) {
        if (!succs.has(hkey(cw))) throw nxError('Invalid clockwise reference node.');
        if (ccw !== null) throw nxError('Only one of cw/ccw can be specified.');
        const ref_ccw = succs.get(hkey(cw))!.attr.ccw;
        super.add_edge(start_node, end_node, { cw, ccw: ref_ccw });
        succs.get(hkey(ref_ccw))!.attr.cw = end_node;
        succs.get(hkey(cw))!.attr.ccw = end_node;
        move = hkey(cw) !== leftmost;
      } else if (ccw !== null) {
        if (!succs.has(hkey(ccw))) throw nxError('Invalid counterclockwise reference node.');
        const ref_cw = succs.get(hkey(ccw))!.attr.cw;
        super.add_edge(start_node, end_node, { cw: ref_cw, ccw });
        succs.get(hkey(ref_cw))!.attr.ccw = end_node;
        succs.get(hkey(ccw))!.attr.cw = end_node;
        move = true;
      } else throw nxError('Node already has out-half-edge(s), either cw or ccw reference node required.');
      if (move) {
        const rec = succs.get(leftmost)!;
        succs.delete(leftmost);
        succs.set(leftmost, rec);
      }
    } else {
      if (cw !== null || ccw !== null) throw nxError('Invalid reference node.');
      super.add_edge(start_node, end_node, { ccw: end_node, cw: end_node });
    }
  }
  add_half_edge_first(start_node: Node, end_node: Node): void {
    const succs = this.succs(start_node);
    const leftmost = succs && succs.size ? succs.get(this.lastKey(succs))!.n : null;
    this.add_half_edge(start_node, end_node, { cw: leftmost });
  }
  connect_components(v: Node, w: Node): void {
    let s = this.succs(v);
    let ref = s && s.size ? s.get(this.lastKey(s))!.n : null;
    this.add_half_edge(v, w, { cw: ref });
    s = this.succs(w);
    ref = s && s.size ? s.get(this.lastKey(s))!.n : null;
    this.add_half_edge(w, v, { cw: ref });
  }
  next_face_half_edge(v: Node, w: Node): [Node, Node] {
    return [w, this._adj.get(hkey(w))!.get(hkey(v))!.attr.ccw];
  }
  traverse_face(v: Node, w: Node, mark: Set<string> | null = null): Node[] {
    const marks = mark ?? new Set<string>();
    const face = [v];
    marks.add(hkey([v, w]));
    let prev = v, cur = w;
    const incoming = this._adj.get(hkey(v))!.get(hkey(w))!.attr.cw;
    while (hkey(cur) !== hkey(v) || hkey(prev) !== hkey(incoming)) {
      face.push(cur);
      [prev, cur] = this.next_face_half_edge(prev, cur);
      if (marks.has(hkey([prev, cur]))) throw new Error('NetworkXException: Bad planar embedding. Impossible face.');
      marks.add(hkey([prev, cur]));
    }
    return face;
  }
}

/** networkx.check_planarity: [is_planar, embedding or null]. */
export function check_planarity(G: NxGraph): [boolean, PlanarEmbedding | null] {
  const emb = new LRPlanarity(asGraph(G)).lr_planarity();
  return emb === null ? [false, null] : [true, emb];
}
export const is_planar = (G: NxGraph): boolean => check_planarity(G)[0];

function make_bi_connected(emb: PlanarEmbedding, starting_node: Node, outgoing_node: Node, edges_counted: Set<string>): Node[] {
  if (edges_counted.has(hkey([starting_node, outgoing_node]))) return [];
  edges_counted.add(hkey([starting_node, outgoing_node]));
  let v1 = starting_node, v2 = outgoing_node;
  const face_list = [starting_node];
  const face_set = new Set([hkey(starting_node)]);
  let [, v3] = emb.next_face_half_edge(v1, v2);
  while (hkey(v2) !== hkey(starting_node) || hkey(v3) !== hkey(outgoing_node)) {
    if (hkey(v1) === hkey(v2)) throw new Error('NetworkXException: Invalid half-edge');
    if (face_set.has(hkey(v2))) {
      emb.add_half_edge(v1, v3, { ccw: v2 });
      emb.add_half_edge(v3, v1, { cw: v2 });
      edges_counted.add(hkey([v2, v3]));
      edges_counted.add(hkey([v3, v1]));
      v2 = v1;
    } else {
      face_set.add(hkey(v2));
      face_list.push(v2);
    }
    v1 = v2;
    [v2, v3] = emb.next_face_half_edge(v2, v3);
    edges_counted.add(hkey([v1, v2]));
  }
  return face_list;
}
function triangulate_face(emb: PlanarEmbedding, v1: Node, v2: Node): void {
  let [, v3] = emb.next_face_half_edge(v1, v2);
  let [, v4] = emb.next_face_half_edge(v2, v3);
  if (hkey(v1) === hkey(v2) || hkey(v1) === hkey(v3)) return;
  while (hkey(v1) !== hkey(v4)) {
    if (emb.has_edge(v1, v3)) [v1, v2, v3] = [v2, v3, v4];
    else {
      emb.add_half_edge(v1, v3, { ccw: v2 });
      emb.add_half_edge(v3, v1, { cw: v2 });
      [v1, v2, v3] = [v1, v3, v4];
    }
    [, v4] = emb.next_face_half_edge(v2, v3);
  }
}
function triangulate_embedding(embedding: PlanarEmbedding, fully_triangulate = true): [PlanarEmbedding, Node[]] {
  if (embedding.__len__() <= 1) return [embedding, embedding.node_list()];
  const emb = new PlanarEmbedding(embedding);
  const component_nodes = connected_components(emb).map((c) => new PySet(c)[Symbol.iterator]().next().value);
  for (let i = 0; i < component_nodes.length - 1; i++) emb.connect_components(component_nodes[i], component_nodes[i + 1]);
  let outer_face: Node[] = [];
  const face_list: Node[][] = [];
  const edges_visited = new Set<string>();
  for (const v of emb.node_list()) {
    for (const w of emb.neighbors_cw_order(v)) {
      const new_face = make_bi_connected(emb, v, w, edges_visited);
      if (new_face.length) {
        face_list.push(new_face);
        if (new_face.length > outer_face.length) outer_face = new_face;
      }
    }
  }
  for (const face of face_list) if (face !== outer_face || fully_triangulate) triangulate_face(emb, face[0], face[1]);
  if (fully_triangulate) {
    const v1 = outer_face[0], v2 = outer_face[1];
    const v3 = emb._adj.get(hkey(v2))!.get(hkey(v1))!.attr.ccw;
    outer_face = [v1, v2, v3];
  }
  return [emb, outer_face];
}
function get_canonical_ordering(emb: PlanarEmbedding, outer_face: Node[]): [Node, Node[]][] {
  const v1 = outer_face[0], v2 = outer_face[1];
  const chords = new HashDict<number>();
  const marked = new Set<string>();
  const ready_to_pick = new PySet<Node>(outer_face);
  const ccw_nbr = new HashDict<Node>(), cw_nbr = new HashDict<Node>();
  let prev = v2;
  for (let i = 2; i < outer_face.length; i++) {
    ccw_nbr.set(prev, outer_face[i]);
    prev = outer_face[i];
  }
  ccw_nbr.set(prev, v1);
  prev = v1;
  for (let i = outer_face.length - 1; i > 0; i--) {
    cw_nbr.set(prev, outer_face[i]);
    prev = outer_face[i];
  }
  const is_outer_face_nbr = (x: Node, y: Node) => {
    if (!ccw_nbr.has(x)) return hkey(cw_nbr.get(x)) === hkey(y);
    if (!cw_nbr.has(x)) return hkey(ccw_nbr.get(x)) === hkey(y);
    return hkey(ccw_nbr.get(x)) === hkey(y) || hkey(cw_nbr.get(x)) === hkey(y);
  };
  const is_on_outer_face = (x: Node) => !marked.has(hkey(x)) && (ccw_nbr.has(x) || hkey(x) === hkey(v1));
  for (const v of outer_face) {
    for (const nbr of emb.neighbors_cw_order(v)) {
      if (is_on_outer_face(nbr) && !is_outer_face_nbr(v, nbr)) {
        chords.set(v, (chords.get(v) ?? 0) + 1);
        ready_to_pick.discard(v);
      }
    }
  }
  const n = emb.__len__();
  const ordering: [Node, Node[]][] = new Array(n);
  ordering[0] = [v1, []];
  ordering[1] = [v2, []];
  ready_to_pick.discard(v1);
  ready_to_pick.discard(v2);
  for (let k = n - 1; k > 1; k--) {
    const v = ready_to_pick.pop();
    marked.add(hkey(v));
    let wp: Node = null, wq: Node = null;
    for (const nbr of emb.neighbors_cw_order(v)) {
      if (marked.has(hkey(nbr))) continue;
      if (is_on_outer_face(nbr)) {
        if (hkey(nbr) === hkey(v1)) wp = v1;
        else if (hkey(nbr) === hkey(v2)) wq = v2;
        else if (hkey(cw_nbr.get(nbr)) === hkey(v)) wp = nbr;
        else wq = nbr;
      }
      if (wp !== null && wq !== null) break;
    }
    const wp_wq = [wp];
    let nbr = wp;
    while (hkey(nbr) !== hkey(wq)) {
      const next_nbr = emb._adj.get(hkey(v))!.get(hkey(nbr))!.attr.ccw;
      wp_wq.push(next_nbr);
      cw_nbr.set(nbr, next_nbr);
      ccw_nbr.set(next_nbr, nbr);
      nbr = next_nbr;
    }
    if (wp_wq.length === 2) {
      chords.set(wp, (chords.get(wp) ?? 0) - 1);
      if (chords.get(wp) === 0) ready_to_pick.add(wp);
      chords.set(wq, (chords.get(wq) ?? 0) - 1);
      if (chords.get(wq) === 0) ready_to_pick.add(wq);
    } else {
      const new_face_nodes = new PySet<Node>(wp_wq.slice(1, -1));
      for (const w of new_face_nodes) {
        ready_to_pick.add(w);
        for (const nb of emb.neighbors_cw_order(w)) {
          if (is_on_outer_face(nb) && !is_outer_face_nbr(w, nb)) {
            chords.set(w, (chords.get(w) ?? 0) + 1);
            ready_to_pick.discard(w);
            if (!new_face_nodes.has(nb)) {
              chords.set(nb, (chords.get(nb) ?? 0) + 1);
              ready_to_pick.discard(nb);
            }
          }
        }
      }
    }
    ordering[k] = [v, wp_wq];
  }
  return ordering;
}
/** networkx.combinatorial_embedding_to_pos (Chrobak-Payne straight-line drawing on an integer grid). */
export function combinatorial_embedding_to_pos(embedding: PlanarEmbedding, fully_triangulate = false): HashDict<number[]> {
  const pos = new HashDict<number[]>();
  if (embedding.__len__() < 4) {
    const dflt = [[0, 0], [2, 0], [1, 1]];
    embedding.node_list().forEach((v, i) => pos.set(v, dflt[i]));
    return pos;
  }
  const [emb, outer_face] = triangulate_embedding(embedding, fully_triangulate);
  const left = new HashDict<Node>(), right = new HashDict<Node>(), dx = new HashDict<number>(), y = new HashDict<number>();
  const order = get_canonical_ordering(emb, outer_face);
  const [v1, v2, v3] = [order[0][0], order[1][0], order[2][0]];
  dx.set(v1, 0), y.set(v1, 0), right.set(v1, v3), left.set(v1, null);
  dx.set(v2, 1), y.set(v2, 0), right.set(v2, null), left.set(v2, null);
  dx.set(v3, 1), y.set(v3, 1), right.set(v3, v2), left.set(v3, null);
  for (let k = 3; k < order.length; k++) {
    const [vk, nbrs] = order[k];
    const wp = nbrs[0], wp1 = nbrs[1], wq = nbrs[nbrs.length - 1], wq1 = nbrs[nbrs.length - 2];
    const multi = nbrs.length > 2;
    dx.set(wp1, dx.get(wp1)! + 1);
    dx.set(wq, dx.get(wq)! + 1);
    const dwpq = nbrs.slice(1).reduce((s, x) => s + dx.get(x)!, 0);
    dx.set(vk, Math.floor((-y.get(wp)! + dwpq + y.get(wq)!) / 2));
    y.set(vk, Math.floor((y.get(wp)! + dwpq + y.get(wq)!) / 2));
    dx.set(wq, dwpq - dx.get(vk)!);
    if (multi) dx.set(wp1, dx.get(wp1)! - dx.get(vk)!);
    right.set(wp, vk);
    right.set(vk, wq);
    if (multi) {
      left.set(vk, wp1);
      right.set(wq1, null);
    } else left.set(vk, null);
  }
  pos.set(v1, [0, y.get(v1)!]);
  const remaining = [v1];
  while (remaining.length) {
    const parent = remaining.pop();
    for (const tree of [left, right]) {
      const child = tree.get(parent) ?? null;
      if (child !== null) {
        pos.set(child, [pos.get(parent)![0] + dx.get(child)!, y.get(child)!]);
        remaining.push(child);
      }
    }
  }
  return pos;
}
/** networkx.planar_layout: a crossing-free straight-line drawing (for planar graphs). */
export function planar_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['G', 'scale', 'center', 'dim', 'store_pos_as'], { scale: 1, center: null, dim: 2, store_pos_as: null });
  if (o.dim !== 2) throw new Error('ValueError: can only handle 2 dimensions');
  const [G, center] = processParams(o.G, o.center, o.dim);
  if (G.__len__() === 0) return new HashDict();
  let embedding: PlanarEmbedding;
  if (G instanceof PlanarEmbedding) embedding = G;
  else {
    const [planar, emb] = check_planarity(G);
    if (!planar) throw new Error('NetworkXException: G is not planar.');
    embedding = emb!;
  }
  const pos = combinatorial_embedding_to_pos(embedding);
  const nodes = embedding.node_list();
  const arr = rescale_layout(nodes.map((v) => pos.get(v)!.slice()), o.scale);
  return storePos(G, toDict(nodes, arr, center), o.store_pos_as);
}

// ---------------------------------------------------------------- the module seen by transpiled code
const layout = {
  random_layout, circular_layout, shell_layout, bipartite_layout, spring_layout, fruchterman_reingold_layout, kamada_kawai_layout, spectral_layout,
  spiral_layout, multipartite_layout, planar_layout, rescale_layout, rescale_layout_dict,
};
/** `import networkx as nx` for transpiled scenes. */
export const nx: Record<string, any> = {
  Graph: callable(NxGraph), DiGraph: callable(NxDiGraph), PlanarEmbedding: callable(PlanarEmbedding),
  ...layout, layout, drawing: { layout },
  empty_graph, complete_graph, path_graph, cycle_graph, star_graph, wheel_graph, full_rary_tree, balanced_tree, binomial_tree, complete_bipartite_graph,
  complete_multipartite_graph, turan_graph, ladder_graph, circular_ladder_graph, barbell_graph, lollipop_graph, grid_2d_graph, petersen_graph,
  from_dict_of_lists, gnp_random_graph, erdos_renyi_graph, binomial_graph, add_path, add_cycle, add_star, relabel_nodes,
  connected_components, is_connected, is_weakly_connected, number_connected_components, is_tree, shortest_path_length, all_pairs_shortest_path_length,
  to_numpy_array, get_node_attributes, set_node_attributes, check_planarity, is_planar, combinatorial_embedding_to_pos,
};
