// manim/utils/polylabel.py
import type { Point3DLike } from './vector';

type P2 = [number, number];

/** A polygon (outer ring plus holes) for polylabel's distance queries. */
export class Polygon {
  declare array: P2[];
  declare start: P2[];
  declare stop: P2[];
  declare diff: P2[];
  declare norm: P2[];
  declare area: number;
  declare centroid: P2;
  constructor(rings: readonly (readonly (readonly number[])[])[]) {
    const np_rings = rings.map((ring) => ring.map((p) => [p[0], p[1]] as P2));
    this.array = np_rings.flat();
    // segments (start[i], stop[i]) join consecutive points of each ring
    this.start = np_rings.flatMap((r) => r.slice(0, -1));
    this.stop = np_rings.flatMap((r) => r.slice(1));
    this.diff = this.start.map((s, i) => [this.stop[i][0] - s[0], this.stop[i][1] - s[1]]);
    this.norm = this.diff.map(([dx, dy]) => {
      const d2 = dx * dx + dy * dy;
      return [dx / d2, dy / d2];
    });
    let xyr = 0, xry = 0;
    this.start.forEach(([x, y], i) => {
      xyr += x * this.stop[i][1];
      xry += this.stop[i][0] * y;
    });
    this.area = 0.5 * (xyr - xry);
    if (this.area) {
      let cx = 0, cy = 0;
      this.start.forEach(([x, y], i) => {
        const [xr, yr] = this.stop[i];
        const factor = x * yr - xr * y;
        cx += (x + xr) * factor;
        cy += (y + yr) * factor;
      });
      this.centroid = [cx / (6.0 * this.area), cy / (6.0 * this.area)];
    }
  }
  /** Signed distance from point to the outline (positive inside). */
  compute_distance(point: readonly number[]): number {
    let d = Infinity;
    this.start.forEach((s, i) => {
      const [nx, ny] = this.norm[i];
      const t = Math.min(1, Math.max(0, nx * (point[0] - s[0]) + ny * (point[1] - s[1])));
      const dx = s[0] + this.diff[i][0] * t - point[0], dy = s[1] + this.diff[i][1] * t - point[1];
      d = Math.min(d, Math.sqrt(dx * dx + dy * dy));
    });
    return this.inside(point) ? d : -d;
  }
  protected _is_point_on_segment(x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
    if (Math.min(x0, x1) <= x && x <= Math.max(x0, x1) && Math.min(y0, y1) <= y && y <= Math.max(y0, y1)) {
      const cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
      return Math.abs(cross) <= 1e-8;
    }
    return false;
  }
  protected _ray_crosses_segment(x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
    if (y0 > y !== y1 > y) {
      const slope = (x1 - x0) / (y1 - y0);
      return x < slope * (y - y0) + x0;
    }
    return false;
  }
  /** Even-odd test (points on the outline count as inside). */
  inside(point: readonly number[]): boolean {
    const [px, py] = point;
    const n = this.start.length;
    for (let i = 0; i < n; i++) if (this._is_point_on_segment(px, py, this.start[i][0], this.start[i][1], this.stop[i][0], this.stop[i][1])) return true;
    let crossings = 0;
    for (let i = 0; i < n; i++) if (this._ray_crosses_segment(px, py, this.start[i][0], this.start[i][1], this.stop[i][0], this.stop[i][1])) crossings++;
    return crossings % 2 === 1;
  }
}

/** A square cell of the search grid: centre c, half-size h, distance d, potential p. */
export class Cell {
  declare c: P2;
  declare h: number;
  declare d: number;
  declare p: number;
  constructor(c: readonly number[], h: number, polygon: Polygon) {
    this.c = [c[0], c[1]];
    this.h = h;
    this.d = polygon.compute_distance(this.c);
    this.p = this.d + this.h * Math.sqrt(2);
  }
}

// Python's heapq (PriorityQueue) ordered by Cell.__lt__ (the distance d)
function siftdown(heap: Cell[], startpos: number, pos: number): void {
  const newitem = heap[pos];
  while (pos > startpos) {
    const parentpos = (pos - 1) >> 1;
    const parent = heap[parentpos];
    if (newitem.d < parent.d) {
      heap[pos] = parent;
      pos = parentpos;
      continue;
    }
    break;
  }
  heap[pos] = newitem;
}
function heappush(heap: Cell[], item: Cell): void {
  heap.push(item);
  siftdown(heap, 0, heap.length - 1);
}
function heappop(heap: Cell[]): Cell {
  const last = heap.pop()!;
  if (!heap.length) return last;
  const ret = heap[0];
  heap[0] = last;
  const endpos = heap.length, startpos = 0;
  let pos = 0;
  const newitem = heap[0];
  let childpos = 1;
  while (childpos < endpos) {
    const rightpos = childpos + 1;
    if (rightpos < endpos && !(heap[childpos].d < heap[rightpos].d)) childpos = rightpos;
    heap[pos] = heap[childpos];
    pos = childpos;
    childpos = 2 * pos + 1;
  }
  heap[pos] = newitem;
  siftdown(heap, startpos, pos);
  return ret;
}

/** The pole of inaccessibility of a polygon with holes (the inside point farthest from the outline). */
export function polylabel(rings: readonly (readonly Point3DLike[])[], precision = 0.01): Cell {
  const polygon = new Polygon(rings as number[][][]);
  const xs = polygon.array.map((p) => p[0]), ys = polygon.array.map((p) => p[1]);
  const mins: P2 = [Math.min(...xs), Math.min(...ys)], maxs: P2 = [Math.max(...xs), Math.max(...ys)];
  const dims: P2 = [maxs[0] - mins[0], maxs[1] - mins[1]];
  const s = Math.min(...dims);
  let h = s / 2.0;
  const queue: Cell[] = [];
  const arange = (a: number, b: number) => Array.from({ length: Math.max(0, Math.ceil((b - a) / s)) }, (_, i) => a + i * s);
  for (const y of arange(mins[1], maxs[1])) for (const x of arange(mins[0], maxs[0])) heappush(queue, new Cell([x + h, y + h], h, polygon));
  let best = new Cell(polygon.centroid, 0, polygon);
  const bbox = new Cell([mins[0] + dims[0] / 2, mins[1] + dims[1] / 2], 0, polygon);
  if (bbox.d > best.d) best = bbox;
  const directions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  while (queue.length) {
    const cell = heappop(queue);
    if (cell.d > best.d) best = cell;
    if (cell.p - best.d > precision) {
      h = cell.h / 2.0;
      for (const [dx, dy] of directions) heappush(queue, new Cell([cell.c[0] + dx * h, cell.c[1] + dy * h], h, polygon));
    }
  }
  return best;
}
