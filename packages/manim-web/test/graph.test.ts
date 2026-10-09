// Graph layouts (mini networkx) and related helpers vs networkx 3.7 / manim 0.21
// (reference values computed with the engine venv).
import { describe, expect, it } from 'vitest';
import * as M from '../src/index';
import * as nx from '../src/ext/py/networkx';
import { np } from '../src/ext/py/index';
import { polylabel } from '../src/utils/polylabel';

const REF = {"nx": {"circular": {"1": [2.0, 3.6757e-08], "2": [1.414213553591, 1.414213537697], "3": [-3.4773e-08, 1.999999984107], "4": [-1.414213448291, 1.414213537697], "5": [-1.9999998947, -1.38089e-07], "6": [-1.4142135675, -1.414213344974], "7": [7.65e-08, -1.999999910593], "8": [1.414213315172, -1.414213702602]}, "shell": {"1": [-4.3711e-08, 1.0], "2": [-0.866025328636, -0.500000178814], "3": [0.866025567055, -0.499999761581], "4": [-2.0, -1.74846e-07], "5": [-0.999999821186, -1.732050895691], "6": [0.999999821186, -1.732050895691], "7": [2.0, 3.49691e-07], "8": [0.99999922514, 1.732051253319], "9": [-1.000000476837, 1.732050538063]}, "spiral": {"1": [-0.456691688677, -1.594634030797], "2": [0.229639479351, -1.344103597576], "3": [0.660937181262, -0.653268219977], "4": [0.633924997775, 0.306654736017], "5": [0.040038719254, 1.285351112332], "6": [-1.107848688966, 2.0]}, "spring": {"1": [1.006753020365, -0.106566331342], "2": [-0.059855671757, 0.057872275314], "3": [-1.758534090403, 0.339386372565], "4": [-1.430738304225, -1.045448310814], "5": [1.003654468742, 2.0], "6": [-0.520701594277, 1.085103073227], "7": [-0.027223017596, -1.40501045354], "8": [1.78664518915, -0.92533662541]}, "random": {"1": [0.550797879696, 0.708147823811], "2": [0.290904730558, 0.510827600956], "3": [0.892946958542, 0.896293103695], "4": [0.125585317612, 0.207242876291], "5": [0.051467202604, 0.440809845924], "6": [0.029876211658, 0.456833213568]}, "kamada_kawai": {"1": [1.690133568665, -0.450872275518], "2": [-0.213705779252, 0.10952751291], "3": [-0.129278325533, 1.702022773465], "4": [-1.224893524868, 0.741993929713], "5": [-2.0, -0.701481383626], "6": [1.194323094902, 1.042196240844], "7": [-0.192644385051, -0.936038167482], "8": [0.876065351136, -1.507348630307]}, "spectral": {"1": [-0.53277942688, 0.744180343869], "2": [0.088149049897, -0.137816655767], "3": [-0.233164384557, -0.938834295829], "4": [-0.233164384557, -0.938834295829], "5": [2.0, 0.229612241051], "6": [-0.331590043938, -0.237515440101], "7": [-0.331590043938, -0.237515440101], "8": [-0.425860766027, 1.516723542707]}, "planar": {"1": [-1.918367346939, -0.775510204082], "2": [-0.285714285714, -0.122448979592], "3": [0.040816326531, 1.183673469388], "4": [0.69387755102, 0.530612244898], "5": [0.69387755102, 0.204081632653], "6": [-0.938775510204, 0.204081632653], "7": [2.0, -0.775510204082], "8": [-0.285714285714, -0.448979591837]}, "planar_grid": {"(0, 0)": [-1.876923076923, -0.615384615385], "(0, 1)": [2.0, -0.615384615385], "(0, 2)": [1.169230769231, 0.215384615385], "(1, 0)": [-1.323076923077, -0.061538461538], "(1, 1)": [0.338461538462, -0.338461538462], "(1, 2)": [0.892307692308, -0.061538461538], "(2, 0)": [-0.769230769231, 0.492307692308], "(2, 1)": [-0.492307692308, 0.215384615385], "(2, 2)": [0.061538461538, 0.769230769231]}}, "er14": [[0, 7], [0, 8], [0, 12], [0, 13], [1, 2], [1, 5], [1, 6], [1, 7], [1, 10], [1, 12], [2, 3], [2, 4], [2, 6], [2, 7], [2, 10], [3, 4], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [4, 5], [4, 7], [4, 9], [4, 10], [4, 12], [4, 13], [5, 6], [5, 8], [5, 10], [5, 13], [6, 8], [6, 10], [6, 11], [6, 12], [7, 8], [7, 12], [7, 13], [8, 11], [9, 11], [9, 13], [10, 11], [11, 12]], "tree7": {"1": [0.0, 1.333333333333, 0.0], "2": [1.333333333333, 0.0, 0.0], "3": [-1.333333333333, 0.0, 0.0], "4": [2.0, -1.333333333333, 0.0], "5": [0.666666666667, -1.333333333333, 0.0], "6": [-0.666666666667, -1.333333333333, 0.0], "7": [-2.0, -1.333333333333, 0.0]}, "linearNN": {"edges": [[1, 3], [2, 3], [1, 4], [2, 4], [1, 5], [2, 5], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [3, 8], [4, 8], [5, 8], [6, 9], [7, 9], [8, 9], [6, 10], [7, 10], [8, 10]], "partitions": [[1, 2], [3, 4, 5], [6, 7, 8], [9, 10]], "pos": {"1": [-3.0, -1.0, 0.0], "2": [-3.0, 1.0, 0.0], "3": [-1.0, -2.0, 0.0], "4": [-1.0, 0.0, 0.0], "5": [-1.0, 2.0, 0.0], "6": [1.0, 0.0, 0.0], "7": [1.0, 2.0, 0.0], "8": [1.0, -2.0, 0.0], "9": [3.0, -1.0, 0.0], "10": [3.0, 1.0, 0.0]}}, "spring_np0": {"1": [0.661994859876, -0.666736740361, 0.0], "2": [-0.550389465079, -1.996217077492, 0.0], "3": [-0.910209719819, -0.238468346948, 0.0], "4": [-1.455107991222, 1.475722296122, 0.0], "5": [0.253712316245, 0.906267748118, 0.0], "6": [2.0, 0.51943212056, 0.0]}, "sets": [[[["a", 6], ["a", 7], ["a", 8]], [[], [8, 6, 7]]], [[["a", 3], ["a", 11], ["a", 19], ["a", 27], ["a", 1], ["a", 9], ["a", 100], ["a", 64], ["a", 5], ["a", 2], ["a", 17], ["p", 0], ["p", 0], ["d", 9], ["a", 40], ["p", 0]], [[64, 1, 2], [3, 100, 5, 40, 11, 17, 19, 27]]], [[["a", 30], ["a", 27], ["a", 24], ["a", 21], ["a", 18], ["a", 15], ["a", 12], ["a", 9], ["a", 6], ["a", 3], ["p", 0], ["p", 0], ["p", 0], ["p", 0], ["a", 1], ["a", 2]], [[3, 6, 9, 12], [1, 2, 15, 18, 21, 24, 27, 30]]], [[["a", [0, 0]], ["a", [0, 1]], ["a", [0, 2]], ["a", [1, 0]], ["a", [1, 1]], ["a", [1, 2]], ["a", [2, 0]], ["a", [2, 1]], ["a", [2, 2]], ["p", 0]], [[[0, 1]], [[1, 2], [2, 1], [0, 0], [1, 1], [2, 0], [0, 2], [2, 2], [1, 0]]]], [[["a", -1], ["a", -2], ["a", 5], ["a", -7]], [[], [-7, 5, -1, -2]]]], "polylabel": {"rings": [[[-3.8, -2.4, 0], [-2.4, -2.5, 0], [-1.3, -1.6, 0], [-0.2, -1.7, 0], [1.7, -2.5, 0], [2.9, -2.6, 0], [3.5, -1.5, 0], [4.9, -1.4, 0], [4.5, 0.2, 0], [4.7, 1.6, 0], [3.5, 2.4, 0], [1.1, 2.5, 0], [-0.1, 0.9, 0], [-1.2, 0.5, 0], [-1.6, 0.7, 0], [-1.4, 1.9, 0], [-2.6, 2.6, 0], [-4.4, 1.2, 0], [-4.9, -0.8, 0], [-3.8, -2.4, 0]], [[0.2, -1.2, 0], [0.9, -1.2, 0], [1.4, -2.0, 0], [2.1, -1.6, 0], [2.2, -0.5, 0], [1.4, 0.0, 0], [0.4, -0.2, 0], [0.2, -1.2, 0]], [[-2.7, 1.4, 0], [-2.3, 1.7, 0], [-2.8, 1.9, 0], [-2.7, 1.4, 0]]], "cell": [-2.883984375, -0.563671875, 1.795168089312348]}, "tex": [[[[1, 2], [3, 4]], "\\left[ \\begin{array}{cc}1 & 2 \\\\ 3 & 4\\end{array} \\right]"], [[[1.5, 0], [2, -1]], "\\left[ \\begin{array}{cc}1.5 & 0.0 \\\\ 2.0 & -1.0\\end{array} \\right]"], [[1, 2, 3], "\\left[ \\begin{array}{c}1 \\\\ 2 \\\\ 3\\end{array} \\right]"]]} as any;

const E6 = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [5, 1], [1, 3], [3, 5]];
const E8 = [[1, 7], [1, 8], [2, 3], [2, 4], [2, 5], [2, 8], [3, 4], [6, 1], [6, 2], [6, 3], [7, 2], [7, 4]];
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
function G(nodes: any[], edges: any[]): nx.NxGraph {
  const g = new nx.NxGraph();
  g.add_nodes_from(nodes);
  g.add_edges_from(edges);
  return g;
}
const key = (k: any) => (Array.isArray(k) ? `(${k.join(', ')})` : String(k));
function expectPos(got: Record<string, number[]>, ref: Record<string, number[]>, tol = 1e-6) {
  expect(Object.keys(got).sort()).toEqual(Object.keys(ref).sort());
  for (const k of Object.keys(ref)) ref[k].forEach((x, i) => expect(Math.abs(got[k][i] - x)).toBeLessThan(tol));
}
const fromDict = (d: nx.HashDict<number[]>) => Object.fromEntries(d.items().map(([k, v]) => [key(k), v]));
const fromGraph = (g: any) => Object.fromEntries(g.vertices.keys().map((v: any) => [key(v), g.get(v).get_center()]));

describe('networkx layouts', () => {
  const g8 = () => G(range(1, 9), E8), g6 = () => G(range(1, 7), E6);
  it('circular, shell (float32 like networkx), spiral', () => {
    expectPos(fromDict(nx.circular_layout(g8(), { scale: 2 })), REF.nx.circular, 1e-12);
    expectPos(fromDict(nx.shell_layout(G(range(1, 10), []), { nlist: [[1, 2, 3], [4, 5, 6, 7, 8, 9]], scale: 2 })), REF.nx.shell, 1e-12);
    expectPos(fromDict(nx.spiral_layout(g6(), { scale: 2 })), REF.nx.spiral, 1e-12);
  });
  it('seeded spring (Fruchterman-Reingold) and random layouts', () => {
    expectPos(fromDict(nx.spring_layout(g8(), { scale: 2, seed: 42 })), REF.nx.spring, 1e-9);
    expectPos(fromDict(nx.random_layout(g6(), { seed: 3 })), REF.nx.random, 1e-9);
  });
  it('kamada_kawai (L-BFGS-B like scipy)', () => {
    expectPos(fromDict(nx.kamada_kawai_layout(g8(), { scale: 2 })), REF.nx.kamada_kawai, 1e-6);
  });
  it('spectral (non-degenerate eigenvalues)', () => {
    expectPos(fromDict(nx.spectral_layout(g8(), { scale: 2 })), REF.nx.spectral, 1e-9);
  });
  it('planar (LR planarity + Chrobak-Payne)', () => {
    expectPos(fromDict(nx.planar_layout(g8(), { scale: 2 })), REF.nx.planar, 1e-12);
    expectPos(fromDict(nx.planar_layout(nx.grid_2d_graph(3, 3), { scale: 2 })), REF.nx.planar_grid, 1e-12);
  });
  it('seeded erdos_renyi_graph uses Python random', () => {
    expect(nx.erdos_renyi_graph(14, 0.5, { seed: 5 }).edge_list()).toEqual(REF.er14);
  });
  it('PySet iterates and pops in CPython order', () => {
    for (const [ops, [pops, rest]] of REF.sets) {
      const s = new nx.PySet();
      const popped: any[] = [];
      for (const [op, x] of ops) {
        if (op === 'a') s.add(x);
        else if (op === 'd') s.discard(x);
        else popped.push(s.pop());
      }
      expect(popped).toEqual(pops);
      expect([...s]).toEqual(rest);
    }
  });
});

describe('Graph', () => {
  it('tree and partite layouts like manim', () => {
    const t = M.Graph([1, 2, 3, 4, 5, 6, 7], [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7]], { layout: 'tree', layout_config: { root_vertex: 1 } });
    expectPos(fromGraph(t), REF.tree7, 1e-9);
    const nn = M.Graph(range(1, 11), REF.linearNN.edges, { layout: 'partite', partitions: REF.linearNN.partitions, layout_scale: 3 });
    expectPos(fromGraph(nn), REF.linearNN.pos, 1e-9);
  });
  it('seed=None layouts draw from np.random (np.random.seed reproduces manim)', () => {
    np.random.seed(0);
    expectPos(fromGraph(M.Graph([1, 2, 3, 4, 5, 6], E6)), REF.spring_np0, 1e-9);
  });
  it('indexes vertices and edges; add/remove vertices and edges', () => {
    const g: any = M.Graph([1, 2, 3], [[1, 2], [2, 3]], { layout: 'circular', edge_config: { '1,2': { stroke_color: M.RED } } });
    expect(g.get(1)).toBe(g.vertices.get(1));
    expect(g.get([1, 2])).toBe(g.edges.get([1, 2]));
    expect(g.get([1, 2]).get_stroke_color().to_hex()).toBe(M.ManimColor.parse(M.RED).to_hex());
    g.add_edges([3, 4], [4, 1]);
    expect(g.vertices.size).toBe(4);
    expect(g.edges.size).toBe(4);
    g.remove_vertices(2);
    expect(g.edges.keys()).toEqual([[3, 4], [4, 1]]);
    expect(String(g)).toBe('Undirected graph on 3 vertices and 2 edges');
  });
  it('DiGraph edges carry tips and follow the vertices', () => {
    const g: any = M.DiGraph([1, 2], [[1, 2]], { layout: { 1: [-1, 0, 0], 2: [1, 0, 0] } });
    const e = g.edges.get([1, 2]);
    expect(e.has_tip()).toBe(true);
    g.get(2).move_to([3, 0, 0]);
    g.update();
    expect(e.tip.tip_point[0]).toBeGreaterThan(2.5);
  });
});

describe('helpers', () => {
  it('polylabel', () => {
    const c = polylabel(REF.polylabel.rings, 0.01);
    expect(c.c[0]).toBeCloseTo(REF.polylabel.cell[0], 12);
    expect(c.c[1]).toBeCloseTo(REF.polylabel.cell[1], 12);
    expect(c.d).toBeCloseTo(REF.polylabel.cell[2], 12);
  });
  it('matrix_to_tex_string', () => {
    for (const [m, s] of REF.tex) expect(M.matrix_to_tex_string(m)).toBe(s);
  });
});
