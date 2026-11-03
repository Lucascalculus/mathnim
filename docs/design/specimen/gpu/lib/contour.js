// Level sets for the blocks: marching squares with linear interpolation, the pieces joined into polylines, and the one
// landscape the contour map and the plaster terrain share (two hills, a saddle between them, a hollow), so the two
// blocks show the same function from above and in the world.

// the landscape: f(x, y) on x ∈ [−3, 3], y ∈ [−2, 2], and its gradient
const bump = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
export function hills(x, y) {
  return 1.55 * bump(x, y, 1.15, 0.45, 0.9) + 1.05 * bump(x, y, -1.2, -0.35, 1.1) - 0.55 * bump(x, y, 0.1, -1.25, 0.5) + 0.05 * x;
}
export function hills_grad(x, y) {
  const g = (cx, cy, s, a) => { const b = a * bump(x, y, cx, cy, s); return [-2 * (x - cx) / s * b, -2 * (y - cy) / s * b]; };
  const p = g(1.15, 0.45, 0.9, 1.55), q = g(-1.2, -0.35, 1.1, 1.05), r = g(0.1, -1.25, 0.5, -0.55);
  return [p[0] + q[0] + r[0] + 0.05, p[1] + q[1] + r[1]];
}
export const HILLS = { x: [-3, 3], y: [-2, 2] };

// The level set f = c over a box, sampled nx × ny: polylines in data coordinates. Each crossing of a cell edge is
// interpolated linearly; the saddle case is decided by the cell's centre value.
export function contour(f, box, nx, ny, c, grid) {
  const [x0, x1] = box.x, [y0, y1] = box.y, dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  const V = grid || sample_grid(f, box, nx, ny);
  const at = (i, j) => V[j * (nx + 1) + i];
  const segs = [];
  const edge = (i, j, e) => {          // the crossing on edge e of cell (i, j): 0 bottom, 1 right, 2 top, 3 left
    const [a, b, pa, pb] = e === 0 ? [at(i, j), at(i + 1, j), [i, j], [i + 1, j]] : e === 1 ? [at(i + 1, j), at(i + 1, j + 1), [i + 1, j], [i + 1, j + 1]]
      : e === 2 ? [at(i, j + 1), at(i + 1, j + 1), [i, j + 1], [i + 1, j + 1]] : [at(i, j), at(i, j + 1), [i, j], [i, j + 1]];
    const t = (c - a) / (b - a);
    return [x0 + (pa[0] + (pb[0] - pa[0]) * t) * dx, y0 + (pa[1] + (pb[1] - pa[1]) * t) * dy];
  };
  const TABLE = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = (at(i, j) > c ? 1 : 0) | (at(i + 1, j) > c ? 2 : 0) | (at(i + 1, j + 1) > c ? 4 : 0) | (at(i, j + 1) > c ? 8 : 0);
    if (k === 0 || k === 15) continue;
    let pairs = TABLE[k];
    if (k === 5 || k === 10) {
      const mid = f(x0 + (i + 0.5) * dx, y0 + (j + 0.5) * dy) > c;
      pairs = k === 5 ? (mid ? [[3, 2], [0, 1]] : [[3, 0], [1, 2]]) : (mid ? [[0, 3], [2, 1]] : [[0, 1], [2, 3]]);
    }
    for (const [e0, e1] of pairs) segs.push([edge(i, j, e0), edge(i, j, e1)]);
  }
  return join(segs);
}
export function sample_grid(f, box, nx, ny) {
  const [x0, x1] = box.x, [y0, y1] = box.y, V = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = f(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny);
  return V;
}
// join segments that share ends into polylines (closed loops come back to their start)
export function join(segs) {
  const key = (p) => Math.round(p[0] * 1e7) + ',' + Math.round(p[1] * 1e7);
  const ends = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1; const line = [segs[s0][0], segs[s0][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0], next = (ends.get(key(tip)) || []).find((i) => !used[i]);
        if (next === undefined) break;
        used[next] = 1; const s = segs[next], other = key(s[0]) === key(tip) ? s[1] : s[0];
        if (dir) line.push(other); else line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines;
}
