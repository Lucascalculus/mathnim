// Regression gallery: renders manim's doc examples (transpiled from Python)
// and compares frames with real manim's output (examples/golden).
//   /regress.html            all examples
//   /regress.html?only=A,B   selected examples
//   /regress.html?fail=1     show only failures
import type { Example, Result } from './regress_core';

const params = new URLSearchParams(location.search);
const only = params.get('only')?.split(',');
const failOnly = params.get('fail') === '1';
const PARALLEL = 4;

function runInFrame(name: string): Promise<{ r: Result; images?: string[] }> {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.style.display = 'none';
    const timer = setTimeout(() => done({ r: { name, status: 'fail', error: 'timeout' } }), 60000);
    const onMsg = (e: MessageEvent) => {
      if (e.source === f.contentWindow && e.data?.type === 'result') done(e.data);
    };
    function done(v: any) {
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      f.remove();
      resolve(v);
    }
    window.addEventListener('message', onMsg);
    f.src = `/runner.html?key=${encodeURIComponent(name)}`;
    document.body.appendChild(f);
  });
}

async function main() {
  const examples: Example[] = await fetch('/manim_examples_js.json').then((r) => r.json());
  const todo = examples.filter((e) => !only || only.includes(e.name) || only.includes(e.key)).map((e) => e.key);
  const tbody = document.querySelector('#t tbody')!;
  const results: Result[] = [];
  const counts: Record<string, number> = {};
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const name = todo[next++];
      const { r, images } = await runInFrame(name);
      results.push(r);
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      document.getElementById('summary')!.textContent = `${results.length}/${todo.length}  ` + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  ');
      if (failOnly && (r.status === 'pass' || r.status === 'skip')) continue;
      const tr = document.createElement('tr');
      const cells = [r.key ?? r.name, r.status, r.mean ?? '', r.bad ?? '', `${r.worst_frame ?? ''} ${r.frames !== r.our_frames ? `(${r.our_frames}/${r.frames})` : ''}`];
      for (const c of cells) {
        const td = document.createElement('td');
        td.textContent = String(c);
        if (c === r.status) td.className = r.status;
        tr.appendChild(td);
      }
      for (let i = 0; i < 3; i++) {
        const td = document.createElement('td');
        if (images?.[i]) {
          const img = document.createElement('img');
          img.src = images[i];
          td.appendChild(img);
        }
        tr.appendChild(td);
      }
      const td = document.createElement('td');
      td.textContent = r.error ?? '';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  (window as any).results = results;
  (window as any).done = true;
}
main();
