// Runs one example in a fresh module realm (iframe) so config / class defaults
// changed by an example cannot leak into the next one. Posts the result to the parent.
import { runExample } from './regress_core';

const name = new URLSearchParams(location.search).get('key')!;
const [examples, golden] = await Promise.all([
  fetch('/manim_examples_js.json').then((r) => r.json()),
  fetch('/golden/index.json').then((r) => r.json()),
]);
const ex = examples.find((e: any) => e.key === name);
const canvas = document.createElement('canvas');
let msg: any;
try {
  const { r, show } = await runExample(ex, golden[name], canvas);
  msg = { r, images: show?.map((c) => (c as HTMLCanvasElement).toDataURL('image/png')) };
} catch (e: any) {
  msg = { r: { name, status: 'fail', error: `harness: ${e?.message ?? e}` } };
}
parent.postMessage({ type: 'result', name, ...msg }, '*');
