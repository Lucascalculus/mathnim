// Shared harness for the two-engine benchmark: same scene, same camera, same metrics.
import { Camera } from '../engine/scene.js';
import { VMobject } from '../engine/core.js';

export const FRAMES = 120;
export const BG = '#0E1217';
const T0 = performance.now();
export const results = { engine: '', load: {}, frame: {}, memory: {} };
window.bench = results;

export function log(s) {
  document.getElementById('log').textContent += s + '\n';
}
export function lap(key, label) {
  const t = (performance.now() - T0) / 1000;
  results.load[key] = +t.toFixed(2);
  log(`${t.toFixed(2)}s  ${label}`);
}
export function camera() {
  return new Camera(document.getElementById('c'), { background: BG });
}

// packed layout per drawable: [nFloats, fill rgba(4), stroke rgba(4), strokeWidth, ...points]
export function unpack(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const n = arr[i];
    const v = new VMobject();
    v.fill = [arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4]];
    v.stroke = [arr[i + 5], arr[i + 6], arr[i + 7], arr[i + 8]];
    v.strokeWidth = arr[i + 9];
    v.points = Array.from(arr.subarray(i + 10, i + 10 + n));
    out.push(v);
    i += 10 + n;
  }
  return out;
}

export function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / s.length;
  return { avg: +avg.toFixed(2), p50: +s[Math.floor(s.length * 0.5)].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2) };
}

export function memory(extraWasmBytes = 0) {
  const js = performance.memory ? performance.memory.usedJSHeapSize : 0;
  results.memory = { jsHeapMB: +(js / 1048576).toFixed(1), wasmMB: +(extraWasmBytes / 1048576).toFixed(1) };
  log(`内存：JS 堆 ${results.memory.jsHeapMB} MB，WASM 内存 ${results.memory.wasmMB} MB`);
}

export function measureTextBox(text, fontSize, weight = 500, family = 'Avenir Next') {
  // same model as engine/tex.js Text: em = fontSize / 72 manim units
  const c = measureTextBox.ctx || (measureTextBox.ctx = document.createElement('canvas').getContext('2d'));
  c.font = `${weight} 100px '${family}'`;
  const m = c.measureText(text);
  const u = fontSize / 72 / 100;
  return [-m.actualBoundingBoxLeft * u, m.actualBoundingBoxRight * u, -m.actualBoundingBoxDescent * u, m.actualBoundingBoxAscent * u];
}
window.measureTextBox = measureTextBox;
