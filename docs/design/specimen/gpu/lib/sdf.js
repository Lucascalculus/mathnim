// Signed distance fields of glyphs, from the browser's own fonts: draw each glyph large, then an exact Euclidean
// distance transform (Felzenszwalb & Huttenlocher) inside and outside. Packed into one float atlas for the GPU.
import { texture } from './gl.js';

const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
function edt(grid, w, h) {
  const f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]); }
  return grid;
}

// glyphs: [{ ch, font }]; returns { tex, cell, cols, index: Map(key → i), metrics: [{ adv }] }
export function glyph_atlas(gl, glyphs, cell = 160, px = 112) {
  const cols = Math.min(glyphs.length, 6), rows = Math.ceil(glyphs.length / cols), W = cols * cell, H = rows * cell;
  const data = new Float32Array(W * H * 4), index = new Map(), metrics = [];
  const cv = document.createElement('canvas'); cv.width = cell; cv.height = cell;
  const g = cv.getContext('2d', { willReadFrequently: true });
  glyphs.forEach((G, i) => {
    g.clearRect(0, 0, cell, cell); g.fillStyle = '#000'; g.font = G.font.replace('{px}', px); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const m = g.measureText(G.ch); metrics.push({ adv: m.width / px });
    // baseline at 0.68 of the cell, so ascenders and descenders both fit
    g.fillText(G.ch, cell / 2, cell * 0.68);
    const img = g.getImageData(0, 0, cell, cell).data, inside = new Float64Array(cell * cell), outside = new Float64Array(cell * cell);
    // seed with the anti-aliased coverage, so edges are sub-pixel (Mapbox's TinySDF does the same)
    for (let k = 0; k < cell * cell; k++) {
      const a = img[k * 4 + 3] / 255;
      if (a >= 1) { inside[k] = 0; outside[k] = INF; } else if (a <= 0) { inside[k] = INF; outside[k] = 0; }
      else { const d = 0.5 - a; inside[k] = d > 0 ? d * d : 0; outside[k] = d < 0 ? d * d : 0; }
    }
    edt(inside, cell, cell); edt(outside, cell, cell);
    const cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const k = y * cell + x, sd = inside[k] - outside[k];   // positive outside, negative inside, in atlas pixels
      // row 0 of the texture is the top row of the image
      const o = ((cy + y) * W + cx + x) * 4; data[o] = sd; data[o + 1] = sd; data[o + 2] = sd; data[o + 3] = 1;
    }
    index.set(G.key || G.ch, i);
  });
  const t = texture(gl, W, H, { type: 'f32', data });
  return { ...t, cell, cols, rows, px, index, metrics };
}
