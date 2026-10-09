import { Scene, Camera, Narrator } from '../engine/scene.js';
import { loadMathJax } from '../engine/tex.js';
import { buildS03, goldenObjects, BG } from './lesson.js';

const FPS = 60;
const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('engine');
const cam = new Camera(canvas, { background: BG });
const stage = $('stage');
let mode = 'side';

// ---------------------------------------------------------------- build
await loadMathJax('../vendor/tex-svg-full.js');
const narration = await fetch('narration.json').then((r) => r.json());
const scene = new Scene({ fps: FPS, background: BG, narration });
let t0 = performance.now();
buildS03(scene);
scene.finalize();
const buildMs = performance.now() - t0;
const narrator = new Narrator(scene.sounds);
narrator.load();

// ---------------------------------------------------------------- rendering
const perf = { n: 0, total: 0, max: 0 };
let lastFrame = -1;
function drawEngine(frame) {
  const s = performance.now();
  cam.render(scene.frameAt(frame / FPS + 1e-4, true));
  const ms = performance.now() - s;
  perf.n++;
  perf.total += ms;
  perf.max = Math.max(perf.max, ms);
  lastFrame = frame;
  $('clock').textContent = `${(frame / FPS).toFixed(3)} s · 帧 ${frame}`;
  $('scrub').value = Math.round((frame / FPS / scene.duration) * 1000);
  if (mode === 'diff') drawDiff();
  if (mode === 'flip') drawFlip();
}
setInterval(() => {
  const avg = perf.n ? perf.total / perf.n : 0;
  $('perf').innerHTML = `录制整段时间轴：${buildMs.toFixed(0)} ms<br>单帧计算+绘制：平均 ${avg.toFixed(2)} ms，最慢 ${perf.max.toFixed(1)} ms<br>`
    + `相当于约 ${avg ? Math.floor(1000 / avg) : '—'} fps 的余量（1080p）`;
}, 500);

// video is the master clock in comparison modes
const frameOfVideo = (t) => Math.floor(t * FPS + 1e-3);
function onVideoFrame(now, meta) {
  if (mode !== 'engine') drawEngine(Math.round(meta.mediaTime * FPS));
  video.requestVideoFrameCallback(onVideoFrame);
}
video.requestVideoFrameCallback(onVideoFrame);
video.addEventListener('seeked', () => mode !== 'engine' && drawEngine(frameOfVideo(video.currentTime)));
video.addEventListener('loadeddata', () => { seekFrame(0); });
video.addEventListener('pause', () => { if (mode !== 'engine') measureDiff(); });

function seekFrame(f) {
  f = Math.max(0, Math.min(f, Math.round(scene.duration * FPS) - 1));
  if (mode === 'engine') {
    engineClock.offset = f / FPS;
    drawEngine(f);
    if (engineClock.playing) startEngine();
  } else {
    video.currentTime = (f + 0.5) / FPS;
  }
}

// ---------------------------------------------------------------- engine-only playback (own clock + audio)
const engineClock = { playing: false, offset: 0, start: 0, raf: 0 };
function startEngine() {
  const base = narrator.start(engineClock.offset);
  engineClock.start = performance.now() - engineClock.offset * 1000;
  engineClock.playing = true;
  cancelAnimationFrame(engineClock.raf);
  const tick = () => {
    const t = (performance.now() - engineClock.start) / 1000;
    if (t >= scene.duration) {
      stopEngine();
      return;
    }
    engineClock.offset = t;
    drawEngine(Math.floor(t * FPS));
    engineClock.raf = requestAnimationFrame(tick);
  };
  tick();
}
function stopEngine() {
  engineClock.playing = false;
  cancelAnimationFrame(engineClock.raf);
  narrator.stop();
}

// ---------------------------------------------------------------- transport
$('play').onclick = () => {
  if (mode === 'engine') {
    engineClock.playing ? stopEngine() : startEngine();
  } else {
    video.paused ? video.play() : video.pause();
  }
  updatePlayLabel();
};
function updatePlayLabel() {
  const playing = mode === 'engine' ? engineClock.playing : !video.paused;
  $('play').textContent = playing ? '❚❚ 暂停' : '▶ 播放';
}
video.addEventListener('play', updatePlayLabel);
video.addEventListener('pause', updatePlayLabel);
$('back').onclick = () => { pauseAll(); seekFrame(lastFrame - 1); };
$('fwd').onclick = () => { pauseAll(); seekFrame(lastFrame + 1); };
$('scrub').oninput = (e) => { pauseAll(); seekFrame(Math.floor((e.target.value / 1000) * scene.duration * FPS)); };
function pauseAll() {
  video.pause();
  stopEngine();
  updatePlayLabel();
}

// ---------------------------------------------------------------- modes
const diffCanvas = document.createElement('canvas');
diffCanvas.width = 1920; diffCanvas.height = 1080;
const flipCanvas = document.createElement('canvas');
flipCanvas.width = 1920; flipCanvas.height = 1080;
const tmp = document.createElement('canvas');
tmp.width = 1920; tmp.height = 1080;

for (const b of $('tabs').querySelectorAll('button')) {
  b.onclick = () => {
    pauseAll();
    mode = b.dataset.mode;
    $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    layout();
    seekFrame(Math.max(lastFrame, 0));
  };
}
function layout() {
  const pv = $('paneVideo'), pe = $('paneEngine');
  stage.className = 'stage' + (mode === 'side' ? ' side' : '');
  pv.style.display = mode === 'side' ? '' : 'none';
  pe.style.display = '';
  pe.querySelector('canvas')?.remove();
  const c = mode === 'diff' ? diffCanvas : mode === 'flip' ? flipCanvas : canvas;
  pe.prepend(c);
  $('engineTag').textContent = { side: '浏览器引擎', diff: '|Manim − 引擎| × 4（黑 = 完全相同）', flip: 'A/B 切换中…', engine: '浏览器引擎 · 自己的时钟与配音' }[mode];
}
function drawDiff() {
  const d = diffCanvas.getContext('2d');
  d.globalCompositeOperation = 'source-over';
  d.drawImage(video, 0, 0, 1920, 1080);
  d.globalCompositeOperation = 'difference';
  d.drawImage(canvas, 0, 0);
  const t = tmp.getContext('2d');
  t.globalCompositeOperation = 'copy';
  t.drawImage(diffCanvas, 0, 0);
  d.globalCompositeOperation = 'lighter';
  d.drawImage(tmp, 0, 0); // x2
  t.drawImage(diffCanvas, 0, 0);
  d.drawImage(tmp, 0, 0); // x4
  d.globalCompositeOperation = 'source-over';
}
let flipShowVideo = true;
setInterval(() => { flipShowVideo = !flipShowVideo; if (mode === 'flip') drawFlip(); }, 450);
function drawFlip() {
  const f = flipCanvas.getContext('2d');
  f.drawImage(flipShowVideo ? video : canvas, 0, 0, 1920, 1080);
  $('engineTag').textContent = flipShowVideo ? 'A：Manim 视频' : 'B：浏览器引擎';
}

// ---------------------------------------------------------------- pixel metrics
function compare(imgA, imgB) {
  const a = imgA.data, b = imgB.data;
  let sum = 0, vis = 0, strong = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    sum += m;
    if (m > 24) vis++;
    if (m > 64) strong++;
  }
  return { mean: sum / n, vis: (vis / n) * 100, strong: (strong / n) * 100 };
}
function measureDiff() {
  const t = tmp.getContext('2d', { willReadFrequently: true });
  t.globalCompositeOperation = 'copy';
  t.drawImage(video, 0, 0, 1920, 1080);
  const A = t.getImageData(0, 0, 1920, 1080);
  const B = canvas.getContext('2d').getImageData(0, 0, 1920, 1080);
  const r = compare(A, B);
  $('diffBig').textContent = `平均 ${r.mean.toFixed(2)} / 255`;
  $('diffSmall').innerHTML = `差异 &gt; 24 的像素：${r.vis.toFixed(3)}%<br>差异 &gt; 64 的像素：${r.strong.toFixed(3)}%<br>（视频是有损压缩，下面“终帧无损对比”更准）`;
}

// ---------------------------------------------------------------- lens
function lens(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  const sx = Math.max(0, Math.min(1920 - 60, u * 1920 - 30)), sy = Math.max(0, Math.min(1080 - 60, v * 1080 - 30));
  for (const [id, src] of [['lensA', video], ['lensB', canvas]]) {
    const c = $(id).getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, sx, sy, 60, 60, 0, 0, 240, 240);
  }
}
$('paneVideo').addEventListener('mousemove', lens);
$('paneEngine').addEventListener('mousemove', lens);

// ---------------------------------------------------------------- golden data + timeline checks
async function checks() {
  const golden = await fetch('golden.json').then((r) => r.json());
  const objs = goldenObjects();
  const rows = [];
  let allOk = true;
  for (const key of ['pitch', 'path', 'graph', 'full', 'cone', 'dot', 'ro', 'alt_curve', 'qmark', 'peak_lines', 'circ', 'labs']) {
    const js = [];
    for (const m of objs[key]) for (const f of m.familyWithPoints()) if (!f.drawText) js.push(f);
    const py = golden[key];
    let maxP = 0, maxS = 0, nPts = 0;
    const same = js.length === py.length;
    for (let i = 0; i < Math.min(js.length, py.length); i++) {
      const a = js[i].points, b = py[i].pts;
      if (a.length !== b.length) { maxP = Infinity; continue; }
      for (let k = 0; k < a.length; k++) maxP = Math.max(maxP, Math.abs(a[k] - b[k]));
      nPts += a.length / 2;
      const st = [...js[i].fill, ...js[i].stroke, js[i].strokeWidth];
      const sp = [...py[i].fill, ...py[i].stroke, py[i].sw];
      st.forEach((v, k) => (maxS = Math.max(maxS, Math.abs(v - sp[k]))));
    }
    const ok = same && maxP < 1e-4 && maxS < 1e-3;
    allOk &&= ok;
    const px = maxP * (1920 / (8 * 16 / 9));
    rows.push(`<tr><td>${key}<br><span class="hint">${py.length} 个图元 · ${nPts} 个控制点</span></td><td class="${ok ? 'ok' : 'bad'}">${same ? '' : `数量 ${js.length}≠${py.length}<br>`}最大偏差 ${maxP === Infinity ? '结构不同' : px < 0.001 ? px.toExponential(1) : px.toFixed(3)} px${maxS > 1e-3 ? `<br>样式差 ${maxS.toFixed(3)}` : ''}</td></tr>`);
  }
  // text boxes (browser text engine vs Pango)
  for (const [key, name] of [['xl', 'x 轴标题文字'], ['yl', 'y 轴标题文字']]) {
    const g = golden.text_boxes[key];
    const m = objs[key];
    const js = [m.getLeft()[0], m.getRight()[0], m.getBottom()[1], m.getTop()[1]];
    const d = Math.max(...js.map((v, i) => Math.abs(v - g[i]))) * (1920 / (8 * 16 / 9));
    rows.push(`<tr><td>${name}<br><span class="hint">浏览器字体排版 vs Pango</span></td><td class="${d < 1.5 ? 'ok' : 'warn'}">包围盒偏差 ${d.toFixed(2)} px</td></tr>`);
  }
  // lossless last frame
  const img = new Image();
  img.src = 'media/S03_last.png';
  await img.decode();
  const c1 = document.createElement('canvas'); c1.width = 1920; c1.height = 1080;
  const x1 = c1.getContext('2d', { willReadFrequently: true });
  x1.drawImage(img, 0, 0);
  const c2 = document.createElement('canvas'); c2.width = 1920; c2.height = 1080;
  new Camera(c2, { background: BG }).render(scene.frameAt(scene.duration + 1, true));
  const r = compare(x1.getImageData(0, 0, 1920, 1080), c2.getContext('2d').getImageData(0, 0, 1920, 1080));
  rows.push(`<tr><td>终帧无损对比<br><span class="hint">Manim PNG vs 引擎，无视频压缩</span></td><td class="${r.strong < 0.5 ? 'ok' : 'warn'}">平均 ${r.mean.toFixed(2)}/255<br>&gt;24：${r.vis.toFixed(3)}% · &gt;64：${r.strong.toFixed(3)}%</td></tr>`);
  $('golden').innerHTML = rows.join('');

  // timeline: engine segments vs manim's logged play() start/end
  const meta = await fetch('media/S03_meta.json').then((x) => x.json());
  const segs = scene.segments.slice(0, -1);
  let match = 0;
  const lines = [];
  meta.timeline.forEach(([s, e], i) => {
    const g = segs[i];
    const es = Math.round(g.t0 * FPS), ee = Math.round((g.t0 + g.nFrames / FPS) * FPS);
    const ms = Math.round(s * FPS), me = Math.round(e * FPS);
    const ok = es === ms && ee === me;
    if (ok) match++;
    lines.push(`<span class="${ok ? 'ok' : 'bad'}">${String(i + 1).padStart(2)}  Manim ${ms}–${me}  引擎 ${es}–${ee}</span>`);
  });
  $('timeline').innerHTML = `<div class="${match === meta.timeline.length ? 'ok' : 'bad'}">${match}/${meta.timeline.length} 段起止帧完全一致 · 总长 ${Math.round(meta.duration * FPS)} vs ${Math.round(scene.duration * FPS)} 帧</div>` + lines.join('<br>');
}
checks().catch((e) => { $('golden').innerHTML = `<tr><td class="bad">${e.message}</td></tr>`; console.error(e); });
layout();
