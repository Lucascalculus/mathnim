// manim/mobject/graph.py
//
// web: manim keeps the structure in a networkx graph and uses networkx's
// layout functions; here they come from src/ext/py/networkx.ts, which
// implements the same algorithms with the same defaults. Python dicts keyed by
// vertices / edge tuples are HashDicts (plain objects and Maps are accepted as
// input: `{ 1: [0, 0, 0] }`, `{ '1,2': {...} }`).
import { AnimationGroup } from '../animation/composition';
import { Create, Uncreate } from '../animation/creation';
import * as nx from '../ext/py/networkx';
import type { HashDict } from '../ext/py/networkx';
import { BLACK } from '../utils/color/manim_colors';
import { isKwargs, KW, pyargs, starArgs, type Kwargs } from '../utils/pyargs';
import { register, registry } from '../utils/registry';
import { to3, type Point3D } from '../utils/vector';
import { Dot, LabeledDot } from './geometry/arc';
import { Line } from './geometry/line';
import { Mobject, override_animate } from './mobject';
import { VMobject } from './types/vectorized_mobject';

type Hashable = any;
type Edge = [Hashable, Hashable];

/** Mark a plain object as Python keyword arguments (for transpiled callees). */
const kw = (o: Kwargs): Kwargs => (Object.defineProperty(o, KW, { value: true, enumerable: false }), o);
const isClass = (f: unknown): boolean => typeof f === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(f));
/** Python `f(*args, **kwargs)` for a class or a function. */
const pycall = (f: any, ...args: unknown[]): any => (isClass(f) ? new f(...args) : f(...args));
/** `cls is Dot` that also sees through callable() wrappers. */
const sameClass = (a: any, b: any): boolean => a === b || (!!a && !!b && a.prototype === b.prototype);
/** Python str() of a vertex name. */
const pystr = (x: unknown): string => (Array.isArray(x) ? `(${x.map(pystr).join(', ')})` : String(x));
const hk = nx.hkey;
const edgeOf = (e: unknown): Edge => {
  const a = Array.from(e as Iterable<Hashable>);
  return [a[0], a[1]];
};
/** Python-style trailing `anim_args` passed by `.animate` overrides. */
function splitAnimArgs(rest: unknown[]): [unknown[], Kwargs, Kwargs] {
  const a = rest.slice();
  let anim_args: Kwargs = {};
  const last = a[a.length - 1] as any;
  if (isKwargs(last) && (last as any)[KW] && 'anim_args' in last && Object.keys(last).length === 1) {
    anim_args = { ...(last.anim_args ?? {}) };
    a.pop();
  }
  const [pos, kwargs] = starArgs(a);
  return [pos, kwargs, anim_args];
}

// ---------------------------------------------------------------- layouts
/** Signature of a layout function: `(nx_graph, { scale, ...layout_config }) => {vertex: point}`. */
export type LayoutFunction = (graph: any, kwargs: Kwargs) => any;

function _partite_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['nx_graph', 'scale', 'partitions'], { scale: 2, partitions: null });
  const { nx_graph, scale, partitions, ...kwargs } = o;
  const parts: Hashable[][] | null = partitions === null ? null : Array.from(partitions as Iterable<Iterable<Hashable>>, (p) => Array.from(p));
  if (parts === null || parts.length === 0) throw new Error('ValueError: The partite layout requires partitions parameter to contain the partition of the vertices');
  const partition_count = parts.length;
  parts.forEach((part, i) => {
    for (const v of part) {
      if (!nx_graph.has_node(v)) throw new Error('ValueError: The partition must contain arrays of vertices in the graph');
      nx_graph.node_attr(v).subset = i;
    }
  });
  for (const v of nx_graph.node_list()) if (!('subset' in nx_graph.node_attr(v))) nx_graph.node_attr(v).subset = partition_count;
  return nx.multipartite_layout(nx_graph, { ...kwargs, scale });
}

function _random_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['nx_graph', 'scale'], { scale: 2 });
  const { nx_graph, scale, ...kwargs } = o;
  const auto_layout = nx.random_layout(nx_graph, kwargs);
  for (const [k, v] of auto_layout.items()) auto_layout.set(k, [...v.map((x: number) => 2 * scale * (x - 0.5)), 0]);
  return auto_layout;
}

/** manim's tree layout (Reingold-Tilford style, children below their parent). */
function _tree_layout(...args: unknown[]): HashDict<number[]> {
  const o = pyargs(args, ['T', 'root_vertex', 'scale', 'vertex_spacing', 'orientation'], { root_vertex: null, scale: 2, vertex_spacing: null, orientation: 'down' });
  const { T, root_vertex, scale, vertex_spacing, orientation } = o;
  if (root_vertex === null) throw new Error('ValueError: The tree layout requires the root_vertex parameter');
  if (!nx.is_tree(T)) throw new Error('ValueError: The tree layout must be used with trees');
  const children = new nx.HashDict<Hashable[]>([[root_vertex, T.neighbors(root_vertex)]]);
  const stack: Hashable[][] = [children.get(root_vertex)!.slice()];
  const stick: Hashable[] = [root_vertex];
  const parent = new nx.HashDict<Hashable>(children.get(root_vertex)!.map((c: Hashable) => [c, root_vertex]));
  const pos = new nx.HashDict<[number, number]>();
  const n = T.__len__();
  const obstruction: number[] = new Array(n).fill(0.0);
  // Python list indexing (y is negative when growing down)
  const oi = (y: number) => (y < 0 ? y + n : y);
  const or_ = orientation === 'down' ? -1 : 1;
  const slide = (v: Hashable, dx: number) => {
    let level = [v];
    while (level.length) {
      const nextlevel: Hashable[] = [];
      for (const u of level) {
        let [x, y] = pos.get(u)!;
        x += dx;
        obstruction[oi(y)] = Math.max(x + 1, obstruction[oi(y)]);
        pos.set(u, [x, y]);
        nextlevel.push(...children.get(u)!);
      }
      level = nextlevel;
    }
  };
  while (stack.length) {
    const C = stack[stack.length - 1];
    if (!C.length) {
      const p = stick.pop();
      stack.pop();
      const cp = children.get(p)!;
      const y = or_ * stack.length;
      let x: number;
      if (!cp.length) {
        x = obstruction[oi(y)];
        pos.set(p, [x, y]);
      } else {
        x = cp.reduce((s: number, c: Hashable) => s + pos.get(c)![0], 0) / cp.length;
        pos.set(p, [x, y]);
        const ox = obstruction[oi(y)];
        if (x < ox) {
          slide(p, ox - x);
          x = ox;
        }
      }
      obstruction[oi(y)] = x + 1;
      continue;
    }
    const t = C.pop();
    const pt = parent.get(t);
    const ct = T.neighbors(t).filter((u: Hashable) => hk(u) !== hk(pt));
    for (const c of ct) parent.set(c, t);
    children.set(t, ct.slice());
    stack.push(ct);
    stick.push(t);
  }
  const vals = pos.values();
  const x_min = Math.min(...vals.map((p) => p[0])), x_max = Math.max(...vals.map((p) => p[0]));
  const y_min = Math.min(...vals.map((p) => p[1])), y_max = Math.max(...vals.map((p) => p[1]));
  const center = [(x_min + x_max) / 2, (y_min + y_max) / 2, 0];
  const height = y_max - y_min, width = x_max - x_min;
  let sf: number[];
  if (vertex_spacing === null) {
    if (typeof scale === 'number' && (width > 0 || height > 0)) sf = new Array(3).fill((2 * scale) / Math.max(width, height));
    else if (Array.isArray(scale)) {
      const sw = scale[0] !== null && width > 0 ? (2 * scale[0]) / width : 1;
      const sh = scale[1] !== null && height > 0 ? (2 * scale[1]) / height : 1;
      sf = [sw, sh, 0];
    } else sf = [1, 1, 1];
  } else sf = [vertex_spacing[0], vertex_spacing[1], 0];
  return new nx.HashDict(pos.items().map(([v, [x, y]]) => [v, [(x - center[0]) * sf[0], (y - center[1]) * sf[1], (0 - center[2]) * sf[2]]]));
}

/** The automatic layouts, by name (manim's `_layouts`). */
export const _layouts: Record<string, (...args: any[]) => HashDict<number[]>> = {
  circular: nx.circular_layout,
  kamada_kawai: nx.kamada_kawai_layout,
  partite: _partite_layout,
  planar: nx.planar_layout,
  random: _random_layout,
  shell: nx.shell_layout,
  spectral: nx.spectral_layout,
  spiral: nx.spiral_layout,
  spring: nx.spring_layout,
  tree: _tree_layout,
};

/** Vertex positions for a layout name, a {vertex: position} dict, or a layout function. */
function _determine_graph_layout(nx_graph: any, layout: any = 'spring', layout_scale: number | number[] = 2, layout_config: Kwargs | null = null): any {
  const config: Kwargs = layout_config === null ? {} : isKwargs(layout_config) ? layout_config : Object.fromEntries(nx.dict_items(layout_config).map(([k, v]) => [String(k), v]));
  if (nx.is_dict(layout)) return layout;
  if (typeof layout === 'string' && layout in _layouts) {
    const auto_layout = _layouts[layout](nx_graph, { ...config, scale: layout_scale });
    const first = auto_layout.values()[0];
    if (config.dim === 3 || (first && first.length === 3)) return auto_layout;
    return new nx.HashDict(auto_layout.items().map(([k, v]) => [k, [...v, 0]]));
  }
  if (typeof layout !== 'function') throw new Error(`ValueError: The layout '${String(layout)}' is neither a recognized layout, a layout function,nor a vertex placement dictionary.`);
  return layout(nx_graph, kw({ ...config, scale: layout_scale }));
}

// ---------------------------------------------------------------- graphs
/** Abstract base of Graph and DiGraph: vertices and edges as mobjects, kept in a networkx-style graph. */
export class GenericGraph extends VMobject {
  declare _graph: any;
  declare _labels: HashDict<Mobject>;
  declare _vertex_config: HashDict<Kwargs>;
  declare default_vertex_config: Kwargs;
  declare vertices: HashDict<Mobject>;
  declare edges: HashDict<Mobject>;
  declare _layout: HashDict<Point3D>;
  declare _edge_config: HashDict<Kwargs>;
  declare _tip_config: HashDict<Kwargs>;
  declare default_edge_config: Kwargs;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['vertices', 'edges', 'labels', 'label_fill_color', 'layout', 'layout_scale', 'layout_config', 'vertex_type', 'vertex_config', 'vertex_mobjects', 'edge_type', 'partitions', 'root_vertex', 'edge_config'], {
      labels: false, label_fill_color: BLACK, layout: 'spring', layout_scale: 2, layout_config: null, vertex_type: Dot, vertex_config: null,
      vertex_mobjects: null, edge_type: Line, partitions: null, root_vertex: null, edge_config: null,
    });
    super();
    const vertices: Hashable[] = Array.from(o.vertices as Iterable<Hashable>);
    const edges: Edge[] = Array.from(o.edges as Iterable<unknown>, edgeOf);
    const { labels, label_fill_color } = o;
    let vertex_type = o.vertex_type;
    const nx_graph = (this.constructor as typeof GenericGraph)._empty_networkx_graph();
    nx_graph.add_nodes_from(vertices);
    nx_graph.add_edges_from(edges);
    this._graph = nx_graph;
    if (nx.is_dict(labels)) this._labels = new nx.HashDict(labels);
    else if (labels) this._labels = new nx.HashDict(vertices.map((v) => [v, new registry.MathTex(pystr(v), { color: label_fill_color })]));
    else this._labels = new nx.HashDict();
    if (this._labels.size && sameClass(vertex_type, Dot)) vertex_type = LabeledDot;
    const vertex_mobjects = o.vertex_mobjects ?? {};
    const vertex_config = o.vertex_config ?? {};
    const vkeys = new Set(vertices.map(hk));
    let default_vertex_config: Kwargs = {};
    if (nx.dict_items(vertex_config).length) default_vertex_config = Object.fromEntries(nx.dict_items(vertex_config).filter(([k]) => !vkeys.has(hk(k))));
    this._vertex_config = new nx.HashDict(vertices.map((v) => [v, nx.dict_has(vertex_config, v) ? nx.dict_get(vertex_config, v) : { ...default_vertex_config }]));
    this.default_vertex_config = default_vertex_config;
    for (const [v, label] of this._labels.items()) this._vertex_config.get(v)!.label = label;
    this.vertices = new nx.HashDict(vertices.map((v) => [v, pycall(vertex_type, kw({ ...this._vertex_config.get(v) }))]));
    this.vertices.update(vertex_mobjects);
    this.change_layout({ layout: o.layout, layout_scale: o.layout_scale, layout_config: o.layout_config, partitions: o.partitions, root_vertex: o.root_vertex });
    const edge_config = o.edge_config ?? {};
    let default_tip_config: Kwargs = {};
    let default_edge_config: Kwargs = {};
    if (nx.dict_items(edge_config).length) {
      if (nx.dict_has(edge_config, 'tip_config')) {
        default_tip_config = nx.dict_get(edge_config, 'tip_config');
        delete edge_config.tip_config;
        if (edge_config instanceof nx.HashDict) edge_config.delete('tip_config');
      }
      default_edge_config = Object.fromEntries(nx.dict_items(edge_config).filter(([k]) => !(Array.isArray(k) || (typeof k === 'string' && k.includes(',')))));
    }
    this._edge_config = new nx.HashDict();
    this._tip_config = new nx.HashDict();
    for (const e of edges) {
      if (nx.dict_has(edge_config, e)) {
        const cfg = nx.dict_get(edge_config, e);
        this._tip_config.set(e, 'tip_config' in cfg ? cfg.tip_config : { ...default_tip_config });
        delete cfg.tip_config;
        this._edge_config.set(e, cfg);
      } else {
        this._tip_config.set(e, { ...default_tip_config });
        this._edge_config.set(e, { ...default_edge_config });
      }
    }
    this.default_edge_config = default_edge_config;
    this._populate_edge_dict(edges, o.edge_type);
    this.add(...this.vertices.values());
    this.add(...this.edges.values());
    this.add_updater(this.update_edges.bind(this));
  }

  /** The empty networkx graph of the concrete class. */
  static _empty_networkx_graph(): any {
    throw new Error('NotImplementedError: To be implemented in concrete subclasses');
  }
  protected _populate_edge_dict(_edges: Edge[], _edge_type: any): void {
    throw new Error('NotImplementedError: To be implemented in concrete subclasses');
  }
  /** Keeps the edges attached to the vertices (an updater). */
  update_edges(_graph: GenericGraph): this {
    return this;
  }

  /** `graph[v]` is a vertex mobject, `graph[(u, v)]` an edge mobject. */
  __getitem__(k: Hashable): Mobject {
    if (this.vertices.has(k)) return this.vertices.get(k)!;
    if (this.edges.has(k)) return this.edges.get(k)!;
    throw new RangeError(`ValueError: Could not find ${pystr(k)} in vertices or edges`);
  }
  /** Python `graph[k]`: a vertex (by name) or an edge (by (u, v) tuple). */
  override get(k: Hashable): any {
    return this.__getitem__(k);
  }

  protected _create_vertex(...args: unknown[]): [Hashable, Point3D, Kwargs, Mobject] {
    const o = pyargs(args, ['vertex', 'position', 'label', 'label_fill_color', 'vertex_type', 'vertex_config', 'vertex_mobject'], {
      position: null, label: false, label_fill_color: BLACK, vertex_type: Dot, vertex_config: null, vertex_mobject: null,
    });
    const { vertex } = o;
    let { label, vertex_type, vertex_mobject } = o;
    const np_position: Point3D = o.position === null ? this.get_center() : to3(o.position);
    let vertex_config: Kwargs = o.vertex_config ?? {};
    if (this.vertices.has(vertex)) throw new Error(`ValueError: Vertex identifier '${pystr(vertex)}' is already used for a vertex in this graph.`);
    if (label === true) label = new registry.MathTex(pystr(vertex), { color: o.label_fill_color });
    else if (this._labels.has(vertex)) label = this._labels.get(vertex);
    else if (!(label instanceof Mobject)) label = null;
    vertex_config = { ...this.default_vertex_config, ...vertex_config };
    if (label !== null) {
      vertex_config.label = label;
      if (sameClass(vertex_type, Dot)) vertex_type = LabeledDot;
    }
    if (vertex_mobject === null || vertex_mobject === undefined) vertex_mobject = pycall(vertex_type, kw({ ...vertex_config }));
    vertex_mobject.move_to(np_position);
    return [vertex, np_position, vertex_config, vertex_mobject];
  }
  protected _add_created_vertex(vertex: Hashable, position: Point3D, vertex_config: Kwargs, vertex_mobject: Mobject): Mobject {
    if (this.vertices.has(vertex)) throw new Error(`ValueError: Vertex identifier '${pystr(vertex)}' is already used for a vertex in this graph.`);
    this._graph.add_node(vertex);
    this._layout.set(vertex, position);
    if ('label' in vertex_config) this._labels.set(vertex, vertex_config.label);
    this._vertex_config.set(vertex, vertex_config);
    this.vertices.set(vertex, vertex_mobject);
    vertex_mobject.move_to(position);
    this.add(vertex_mobject);
    return vertex_mobject;
  }
  protected _add_vertex(...args: unknown[]): Mobject {
    const [v, pos, cfg, mob] = this._create_vertex(...args);
    return this._add_created_vertex(v, pos, cfg, mob);
  }
  protected _create_vertices(...args: unknown[]): [Hashable, Point3D, Kwargs, Mobject][] {
    const [vertices, o] = starArgs<Hashable>(args);
    const positions = o.positions ?? {};
    const vertex_mobjects = o.vertex_mobjects ?? {};
    const graph_center = this.get_center();
    const pos = new nx.HashDict<Point3D>(vertices.map((v) => [v, graph_center]));
    pos.update(positions);
    let labels: HashDict<any>;
    if (o.labels === undefined || typeof o.labels === 'boolean') labels = new nx.HashDict(vertices.map((v) => [v, o.labels ?? false]));
    else {
      labels = new nx.HashDict(vertices.map((v) => [v, false]));
      labels.update(o.labels);
    }
    const vertex_config = o.vertex_config ?? { ...this.default_vertex_config };
    const vkeys = new Set(vertices.map(hk));
    const base_vertex_config = { ...this.default_vertex_config, ...Object.fromEntries(nx.dict_items(vertex_config).filter(([k]) => !vkeys.has(hk(k)))) };
    return vertices.map((v) =>
      this._create_vertex(v, {
        position: pos.get(v), label: labels.get(v), label_fill_color: o.label_fill_color ?? BLACK, vertex_type: o.vertex_type ?? Dot,
        vertex_config: nx.dict_has(vertex_config, v) ? nx.dict_get(vertex_config, v) : { ...base_vertex_config }, vertex_mobject: nx.dict_get(vertex_mobjects, v, null),
      }),
    );
  }
  /**
   * Adds vertices (keyword options: positions, labels, label_fill_color,
   * vertex_type, vertex_config, vertex_mobjects); returns the new mobjects.
   */
  add_vertices(...args: unknown[]): Mobject[] {
    return this._create_vertices(...args).map((v) => this._add_created_vertex(...v));
  }
  _add_vertices_animation(...rest: unknown[]): AnimationGroup {
    const [pos, kwargs, anim_args] = splitAnimArgs(rest);
    const animation = anim_args.animation ?? Create;
    delete anim_args.animation;
    const vertex_mobjects = this._create_vertices(...pos, kwargs);
    const on_finish = (scene: any) => {
      for (const v of vertex_mobjects) {
        scene.remove(v[3]);
        this._add_created_vertex(...v);
      }
    };
    return new AnimationGroup(...vertex_mobjects.map((v) => pycall(animation, v[3], kw({ ...anim_args }))), { group: this, _on_finish: on_finish });
  }

  protected _remove_vertex(vertex: Hashable): VMobject {
    if (!this.vertices.has(vertex)) throw new Error(`ValueError: The graph does not contain a vertex with identifier '${pystr(vertex)}'`);
    this._graph.remove_node(vertex);
    this._layout.pop(vertex);
    if (this._labels.has(vertex)) this._labels.pop(vertex);
    this._vertex_config.pop(vertex);
    const edge_tuples = this.edges.keys().filter((e: Edge) => e.some((x) => hk(x) === hk(vertex)));
    for (const e of edge_tuples) this._edge_config.pop(e);
    const to_remove = edge_tuples.map((e: Edge) => this.edges.pop(e));
    to_remove.push(this.vertices.pop(vertex));
    this.remove(...to_remove);
    return new (this.get_group_class())(...to_remove);
  }
  /** Removes vertices and their edges; returns a group of the removed mobjects. */
  remove_vertices(...vertices: Hashable[]): VMobject {
    const mobjects: Mobject[] = [];
    for (const v of vertices) mobjects.push(...this._remove_vertex(v).submobjects);
    return new (this.get_group_class())(...mobjects);
  }
  _remove_vertices_animation(...rest: unknown[]): AnimationGroup {
    const [vertices, , anim_args] = splitAnimArgs(rest);
    const animation = anim_args.animation ?? Uncreate;
    delete anim_args.animation;
    const mobjects = this.remove_vertices(...vertices);
    return new AnimationGroup(...[...mobjects].map((m) => pycall(animation, m, kw({ ...anim_args }))), { group: this });
  }

  protected _add_edge(...args: unknown[]): VMobject {
    const o = pyargs(args, ['edge', 'edge_type', 'edge_config'], { edge_type: Line, edge_config: null });
    const edge = edgeOf(o.edge);
    const edge_config: Kwargs = o.edge_config ?? { ...this.default_edge_config };
    const added_mobjects: Mobject[] = edge.filter((v) => !this.vertices.has(v)).map((v) => this._add_vertex(v));
    const [u, v] = edge;
    this._graph.add_edge(u, v);
    const cfg = { ...this.default_edge_config, ...edge_config };
    this._edge_config.set(edge, cfg);
    const edge_mobject = pycall(o.edge_type, kw({ ...cfg, start: this.__getitem__(u).get_center(), end: this.__getitem__(v).get_center(), z_index: -1 }));
    this.edges.set(edge, edge_mobject);
    this.add(edge_mobject);
    added_mobjects.push(edge_mobject);
    return new (this.get_group_class())(...added_mobjects);
  }
  /**
   * Adds edges (keyword options: edge_type, edge_config, plus add_vertices'
   * options for new vertices); returns a group of the new mobjects.
   */
  add_edges(...args: unknown[]): VMobject {
    const [edgesArg, o] = starArgs(args);
    const { edge_type = Line, edge_config: ec = null, ...kwargs } = o;
    const edges = edgesArg.map(edgeOf);
    const edge_config = ec ?? {};
    const ekeys = new Set(edges.map(hk));
    const non_edge_settings = Object.fromEntries(nx.dict_items(edge_config).filter(([k]) => !ekeys.has(hk(k))));
    const base = { ...this.default_edge_config, ...non_edge_settings };
    const per_edge = new nx.HashDict<Kwargs>(edges.map((e) => [e, { ...base, ...nx.dict_get(edge_config, e, {}) }]));
    const edge_vertices = new nx.PySet<Hashable>(edges.flat());
    const new_vertices = [...edge_vertices].filter((v) => !this.vertices.has(v));
    const added_vertices = this.add_vertices(...new_vertices, kwargs);
    const added_mobjects = edges.reduce((acc: Mobject[], e) => acc.concat(this._add_edge(e, { edge_type, edge_config: per_edge.get(e) }).submobjects), added_vertices);
    return new (this.get_group_class())(...added_mobjects);
  }
  _add_edges_animation(...rest: unknown[]): AnimationGroup {
    const [pos, kwargs, anim_args] = splitAnimArgs(rest);
    const animation = anim_args.animation ?? Create;
    delete anim_args.animation;
    const mobjects = this.add_edges(...pos, kwargs);
    return new AnimationGroup(...[...mobjects].map((m) => pycall(animation, m, kw({ ...anim_args }))), { group: this });
  }

  protected _remove_edge(edge: Edge): Mobject {
    if (!this.edges.has(edge)) throw new Error(`ValueError: The graph does not contain a edge '${pystr(edge)}'`);
    const edge_mobject = this.edges.pop(edge);
    this._graph.remove_edge(edge[0], edge[1]);
    this._edge_config.pop(edge, undefined as any);
    this.remove(edge_mobject);
    return edge_mobject;
  }
  /** Removes edges; returns a group of the removed edge mobjects. */
  remove_edges(...edges: Edge[]): VMobject {
    const edge_mobjects = edges.map((e) => this._remove_edge(edgeOf(e)));
    return new (this.get_group_class())(...edge_mobjects);
  }
  _remove_edges_animation(...rest: unknown[]): AnimationGroup {
    const [edges, , anim_args] = splitAnimArgs(rest);
    const animation = anim_args.animation ?? Uncreate;
    delete anim_args.animation;
    const mobjects = this.remove_edges(...(edges as Edge[]));
    return new AnimationGroup(...[...mobjects].map((m) => pycall(animation, m, kw({ ...anim_args }))));
  }

  /** Builds a graph from a networkx graph (`nx.Graph()` of the Python shim, or anything with `nodes`/`edges`). */
  static from_networkx(nxgraph: any, kwargs: Kwargs = {}): any {
    return new (this as any)(Array.from(nxgraph.nodes), Array.from(nxgraph.edges), kwargs);
  }

  /** Re-positions the vertices with another layout (name, {vertex: position} dict, or function). */
  change_layout(...args: unknown[]): this {
    const o = pyargs(args, ['layout', 'layout_scale', 'layout_config', 'partitions', 'root_vertex'], { layout: 'spring', layout_scale: 2, layout_config: null, partitions: null, root_vertex: null });
    const layout_config: Kwargs = o.layout_config ?? {};
    if (o.partitions !== null && !nx.dict_has(layout_config, 'partitions')) layout_config.partitions = o.partitions;
    if (o.root_vertex !== null && !nx.dict_has(layout_config, 'root_vertex')) layout_config.root_vertex = o.root_vertex;
    this._layout = new nx.HashDict(_determine_graph_layout(this._graph, o.layout, o.layout_scale, layout_config));
    for (const v of this.vertices.keys()) {
      if (!this._layout.has(v)) throw new RangeError(`KeyError: ${pystr(v)}`);
      this.__getitem__(v).move_to(to3(Array.from(this._layout.get(v) as Iterable<number>)));
    }
    return this;
  }
}

/** An undirected graph: vertices are Dots (LabeledDots with labels), edges Lines. */
export class Graph extends GenericGraph {
  static override _empty_networkx_graph(): any {
    return new nx.NxGraph();
  }
  protected override _populate_edge_dict(edges: Edge[], edge_type: any): void {
    this.edges = new nx.HashDict(
      edges.map(([u, v]) => [[u, v], pycall(edge_type, kw({ ...this._edge_config.get([u, v]), start: this.__getitem__(u).get_center(), end: this.__getitem__(v).get_center(), z_index: -1 }))]),
    );
  }
  override update_edges(graph: GenericGraph): this {
    for (const [[u, v], edge] of graph.edges.items()) {
      edge.set_points_by_ends(graph.__getitem__(u).get_center(), graph.__getitem__(v).get_center(), (this._edge_config as HashDict<any>).get('buff', 0), (this._edge_config as HashDict<any>).get('path_arc', 0));
    }
    return this;
  }
  override toString(): string {
    return `Undirected graph on ${this.vertices.size} vertices and ${this.edges.size} edges`;
  }
}

/** A directed graph: edges get arrow tips (`edge_config: { tip_config: {...} }`). */
export class DiGraph extends GenericGraph {
  static override _empty_networkx_graph(): any {
    return new nx.NxDiGraph();
  }
  protected override _populate_edge_dict(edges: Edge[], edge_type: any): void {
    this.edges = new nx.HashDict(
      edges.map(([u, v]) => [[u, v], pycall(edge_type, kw({ ...this._edge_config.get([u, v]), start: this.__getitem__(u), end: this.__getitem__(v), z_index: -1 }))]),
    );
    for (const [e, edge] of this.edges.items()) edge.add_tip(kw({ ...this._tip_config.get(e) }));
  }
  override update_edges(graph: GenericGraph): this {
    for (const [[u, v], edge] of graph.edges.items()) {
      const tip = edge.pop_tips().get(0);
      edge.set_points_by_ends(graph.__getitem__(u), graph.__getitem__(v), (this._edge_config as HashDict<any>).get('buff', 0), (this._edge_config as HashDict<any>).get('path_arc', 0));
      edge.add_tip(tip);
    }
    return this;
  }
  override toString(): string {
    return `Directed graph on ${this.vertices.size} vertices and ${this.edges.size} edges`;
  }
}

override_animate(GenericGraph.prototype.add_vertices, (mob: GenericGraph, ...args: unknown[]) => mob._add_vertices_animation(...args));
override_animate(GenericGraph.prototype.remove_vertices, (mob: GenericGraph, ...args: unknown[]) => mob._remove_vertices_animation(...args));
override_animate(GenericGraph.prototype.add_edges, (mob: GenericGraph, ...args: unknown[]) => mob._add_edges_animation(...args));
override_animate(GenericGraph.prototype.remove_edges, (mob: GenericGraph, ...args: unknown[]) => mob._remove_edges_animation(...args));

register({ GenericGraph, Graph, DiGraph });
