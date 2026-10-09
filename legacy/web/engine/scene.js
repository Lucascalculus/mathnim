// Scene: runs a manim-style construct() once to *record* a timeline, then
// renders any time t on demand. Timing follows manim's Cairo renderer exactly:
// an animation of run_time r occupies len(arange(0, r, 1/fps)) frames, a
// static wait occupies int(r * fps) frames, and time advances one dt per frame.
//
// Each segment stores a snapshot of every mobject taken right after the
// animations' begin(); frameAt(t) restores that snapshot and interpolates, so
// seeking is O(1) and the result is identical to playing straight through.
import { FRAME_W, FRAME_H, VMobject, removeRedundancies } from './core.js';
import { Wait } from './animation.js';

function familyOf(list, withPoints = false) {
  const all = [];
  for (const m of list) all.push(...(withPoints ? m.familyWithPoints() : m.getFamily()));
  return removeRedundancies(all);
}

export class Scene {
  constructor(o = {}) {
    this.fps = o.fps ?? 60;
    this.background = o.background ?? '#000000';
    this.mobjects = [];
    this.time = 0;
    this.segments = [];
    this.sounds = []; // {src, start, duration}
    this.captions = [];
    this.narration = o.narration ?? {};
  }

  // ---------- scene list (manim Cairo semantics)
  familyMembers() {
    return familyOf(this.mobjects);
  }
  add(...mobs) {
    this.restructure(mobs, true);
    this.mobjects.push(...mobs);
    return this;
  }
  remove(...mobs) {
    this.restructure(mobs, false);
    return this;
  }
  restructure(toRemove, extractFamilies) {
    const rm = extractFamilies ? familyOf(toRemove) : toRemove;
    const out = [];
    const addSafe = (list, set) => {
      for (const m of list) {
        if (set.has(m)) continue;
        const inter = new Set(m.getFamily().filter((x) => set.has(x)));
        if (inter.size) addSafe(m.submobjects, inter);
        else out.push(m);
      }
    };
    addSafe(this.mobjects, new Set(rm));
    this.mobjects = out;
  }

  // ---------- recording
  play(...args) {
    let opts = {};
    const last = args[args.length - 1];
    if (last && !last.__builder && Object.getPrototypeOf(last) === Object.prototype) opts = args.pop();
    const anims = args.map((a) => (a.__builder ? a.build() : a));
    for (const a of anims) {
      if (opts.runTime != null) a.runTime = opts.runTime;
      if (opts.rateFunc) a.rateFunc = opts.rateFunc;
      if (opts.lagRatio != null) a.lagRatio = opts.lagRatio;
    }
    // add_mobjects_from_animations
    let cur = this.familyMembers();
    for (const a of anims) {
      if (a.introducer || !a.mobject) continue;
      if (!cur.includes(a.mobject)) {
        this.add(a.mobject);
        cur = cur.concat(a.mobject.getFamily());
      }
    }
    for (const a of anims) {
      a.setupScene(this);
      a.begin();
    }
    const duration = Math.max(...anims.map((a) => a.runTime));
    const dt = 1 / this.fps;
    const staticWait = anims.length === 1 && anims[0].isWait && !this.hasUpdaters();
    const nFrames = staticWait ? Math.trunc(duration / dt) : Math.ceil(duration / dt);
    this.segments.push({
      t0: this.time, nFrames, anims: staticWait ? [] : anims,
      snapshot: this.snapshot(anims), list: this.mobjects.slice(),
    });
    if (staticWait) this.time += nFrames * dt;
    else for (let i = 0; i < nFrames; i++) this.time += dt;
    for (const a of anims) {
      a.finish();
      a.cleanUpFromScene(this);
    }
    this.updateMobjects();
    return this;
  }
  wait(duration = 1) {
    return this.play(new Wait(duration));
  }
  hasUpdaters() {
    return this.familyMembers().some((m) => m.updaters.length);
  }
  updateMobjects() {
    for (const m of this.mobjects) m.update();
  }
  // narration: fn(t) runs the animations for this sentence; t.duration is the clip length
  say(text, fn, gap = 0.35) {
    const clip = this.narration[text];
    if (!clip) throw new Error('No narration clip for: ' + text);
    const start = this.time;
    this.sounds.push({ src: clip.src, start, duration: clip.duration });
    this.captions.push({ start, end: start + clip.duration, text });
    fn && fn({ duration: clip.duration, start });
    const left = start + clip.duration + gap - this.time;
    if (left > 1e-3) this.wait(left);
  }
  finalize() {
    this.segments.push({ t0: this.time, nFrames: 1, anims: [], snapshot: this.snapshot([]), list: this.mobjects.slice() });
    this.duration = this.time;
    return this;
  }

  // ---------- snapshots
  snapshot(anims) {
    const roots = this.mobjects.slice();
    for (const a of anims) if (a.mobject) roots.push(a.mobject);
    return familyOf(roots).map((m) => ({
      m, points: m.points.slice(), fill: m.fill.slice(), stroke: m.stroke.slice(), sw: m.strokeWidth,
      bg: m.bgStroke.slice(), bgw: m.bgStrokeWidth, subs: m.submobjects.slice(),
    }));
  }
  restore(snap) {
    for (const s of snap) {
      const m = s.m;
      m.points = s.points.slice();
      m.fill = s.fill.slice();
      m.stroke = s.stroke.slice();
      m.strokeWidth = s.sw;
      m.bgStroke = s.bg.slice();
      m.bgStrokeWidth = s.bgw;
      m.submobjects = s.subs.slice();
    }
  }

  // ---------- playback
  segmentAt(t) {
    const segs = this.segments;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].t0 <= t + 1e-9) lo = mid;
      else hi = mid - 1;
    }
    return segs[lo];
  }
  // returns drawables (family members with points) in manim draw order
  frameAt(t, quantize = true) {
    const seg = this.segmentAt(t);
    this.restore(seg.snapshot);
    let tau = Math.max(0, t - seg.t0);
    if (quantize) tau = Math.floor(tau * this.fps + 1e-6) / this.fps;
    tau = Math.min(tau, (seg.nFrames - 1) / this.fps);
    for (const a of seg.anims) a.interpolate(tau / a.runTime);
    for (const m of seg.list) m.update();
    return familyOf(seg.list, true);
  }
}

// ------------------------------------------------------------------ camera
// Draws VMobjects the way manim's Cairo camera does. An optional theme
// (engine/theme.js) adds background, grain, vignette and per-mobject effects:
//   mob.glow = true | px     soft light around strokes
//   mob.shadow = {color, blur, offsetY}   drop shadow under fills
//   mob.capStyle / mob.joinStyle          override theme line caps
export class Camera {
  constructor(canvas, o = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pw = canvas.width;
    this.ph = canvas.height;
    this.theme = o.theme ?? null;
    this.background = o.background ?? this.theme?.background?.color ?? this.theme?.background?.top ?? '#000000';
    this.k = this.pw / 1920; // effect sizes are specified for 1080p
  }
  worldToPixel(x, y) {
    return [(x + FRAME_W / 2) * (this.pw / FRAME_W), (FRAME_H / 2 - y) * (this.ph / FRAME_H)];
  }
  render(drawables) {
    this.drawBackground();
    for (const m of drawables) {
      if (m.drawText) this.drawText(m);
      else this.drawVM(m);
    }
    this.drawOverlays();
  }
  drawBackground() {
    const { ctx, pw, ph } = this;
    const bg = this.theme?.background;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (!bg || bg.kind === 'solid') {
      ctx.fillStyle = bg?.color ?? this.background;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'radial') {
      const g = ctx.createRadialGradient(pw * 0.42, ph * 0.38, 0, pw * 0.5, ph * 0.5, pw * 0.75);
      g.addColorStop(0, bg.inner);
      g.addColorStop(1, bg.outer);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'linear') {
      const g = ctx.createLinearGradient(0, 0, 0, ph);
      g.addColorStop(0, bg.top);
      g.addColorStop(1, bg.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'paper') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, pw, ph);
      const g = ctx.createRadialGradient(pw * 0.5, ph * 0.45, pw * 0.2, pw * 0.5, ph * 0.5, pw * 0.8);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, bg.edge);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    }
    const grid = this.theme?.dotGrid;
    if (grid) {
      ctx.fillStyle = grid.color;
      const step = grid.spacing * (pw / FRAME_W);
      for (let x = (pw / 2) % step; x < pw; x += step)
        for (let y = (ph / 2) % step; y < ph; y += step) ctx.fillRect(x - grid.radius * this.k, y - grid.radius * this.k, 2 * grid.radius * this.k, 2 * grid.radius * this.k);
    }
  }
  noiseTile() {
    if (this._noise) return this._noise;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const img = x.createImageData(256, 256);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rnd() - 0.5) * 180;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    this._noise = this.ctx.createPattern(c, 'repeat');
    return this._noise;
  }
  drawOverlays() {
    const t = this.theme;
    if (!t) return;
    const { ctx, pw, ph } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (t.vignette) {
      const g = ctx.createRadialGradient(pw / 2, ph / 2, ph * 0.45, pw / 2, ph / 2, pw * 0.72);
      const dark = t.background?.kind === 'paper' ? '90,62,25' : '0,0,0';
      g.addColorStop(0, `rgba(${dark},0)`);
      g.addColorStop(1, `rgba(${dark},${t.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    }
    if (t.grain) {
      ctx.globalAlpha = t.grain;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = this.noiseTile();
      ctx.fillRect(0, 0, pw, ph);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  rgba(c) {
    return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${Math.max(0, Math.min(1, c[3]))})`;
  }
  // manim Camera.set_cairo_context_path + apply_stroke/fill
  drawVM(m) {
    const { ctx, pw, ph } = this;
    const p = m.points;
    const n = p.length / 2;
    if (n < 4) return;
    ctx.setTransform(pw / FRAME_W, 0, 0, -(ph / FRAME_H), pw / 2, ph / 2);
    ctx.beginPath();
    for (const [a, b] of m.splitIndices()) {
      if (b - a < 4) continue;
      ctx.moveTo(p[2 * a], p[2 * a + 1]);
      for (let i = a; i <= b - 4; i += 4) {
        const k = 2 * (i + 1);
        ctx.bezierCurveTo(p[k], p[k + 1], p[k + 2], p[k + 3], p[k + 4], p[k + 5]);
      }
      const x0 = p[2 * a], y0 = p[2 * a + 1], x1 = p[2 * (b - 1)], y1 = p[2 * (b - 1) + 1];
      if (Math.abs(x0 - x1) <= 1e-6 + 1e-5 * Math.abs(x1) && Math.abs(y0 - y1) <= 1e-6 + 1e-5 * Math.abs(y1)) ctx.closePath();
    }
    ctx.lineCap = m.capStyle ?? this.theme?.stroke?.cap ?? 'butt';
    ctx.lineJoin = m.joinStyle ?? this.theme?.stroke?.join ?? 'miter';
    if (m.bgStrokeWidth > 0) {
      ctx.lineWidth = m.bgStrokeWidth * 0.01;
      ctx.strokeStyle = this.rgba(m.bgStroke);
      ctx.stroke();
    }
    if (m.fill[3] > 0) {
      ctx.fillStyle = this.rgba(m.fill);
      if (m.shadow) {
        ctx.save();
        ctx.shadowColor = m.shadow.color;
        ctx.shadowBlur = m.shadow.blur * this.k;
        ctx.shadowOffsetY = (m.shadow.offsetY ?? 0) * this.k;
        ctx.fill();
        ctx.restore();
      } else ctx.fill();
    }
    if (m.strokeWidth > 0 && m.stroke[3] > 0) {
      ctx.lineWidth = m.strokeWidth * 0.01;
      ctx.strokeStyle = this.rgba(m.stroke);
      const glow = m.glow === true ? this.theme?.glow : m.glow;
      if (glow) {
        // cheap glow: a few wide, faint strokes under the crisp one (shadowBlur is ~50x slower)
        const px = (this.pw / FRAME_W) / this.k; // world units -> 1080p px
        for (const [mult, a] of [[1.6, 0.045], [0.95, 0.08], [0.5, 0.14]]) {
          ctx.lineWidth = Math.max(m.strokeWidth * 0.01, (glow * mult) / px);
          ctx.strokeStyle = this.rgba([...m.stroke.slice(0, 3), a * m.stroke[3]]);
          ctx.stroke();
        }
        ctx.lineWidth = m.strokeWidth * 0.01;
        ctx.strokeStyle = this.rgba(m.stroke);
      }
      ctx.stroke();
    }
  }
  drawText(m) {
    const { ctx } = this;
    const d = m.drawText;
    const x0 = m.criticalPoint([-1, 0])[0], x1 = m.criticalPoint([1, 0])[0];
    const y0 = m.criticalPoint([0, -1])[1], y1 = m.criticalPoint([0, 1])[1];
    const w = x1 - x0;
    if (w <= 1e-9 || m.fill[3] <= 0) return;
    const sx = w / d.w0;
    const ox = x0 + d.fx * w, oy = y0 + d.fy * (y1 - y0);
    const ppu = this.pw / FRAME_W;
    const [px, py] = this.worldToPixel(ox, oy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fontPx = d.em * sx * ppu;
    ctx.font = `${d.style ?? 'normal'} ${d.weight} ${fontPx}px '${d.family}'`;
    ctx.letterSpacing = `${(d.letterSpacing ?? 0) * fontPx}px`;
    ctx.fillStyle = this.rgba(m.fill);
    ctx.textBaseline = 'alphabetic';
    for (const g of d.glyphs) if (g.ch.trim()) ctx.fillText(g.ch, px + g.x * sx * ppu, py);
    ctx.letterSpacing = '0px';
  }
}

// ------------------------------------------------------------------ audio
export class Narrator {
  constructor(sounds) {
    this.sounds = sounds;
    this.ac = null;
    this.buffers = new Map();
    this.playing = [];
  }
  async load() {
    this.ac = new (window.AudioContext || window.webkitAudioContext)();
    await Promise.all(this.sounds.map(async (s) => {
      if (this.buffers.has(s.src)) return;
      const buf = await fetch(s.src).then((r) => r.arrayBuffer());
      this.buffers.set(s.src, await this.ac.decodeAudioData(buf));
    }));
  }
  // start playback of every clip from scene time t (seconds)
  start(t) {
    this.stop();
    if (this.ac.state === 'suspended') this.ac.resume();
    const now = this.ac.currentTime + 0.03;
    for (const s of this.sounds) {
      if (s.start + s.duration <= t) continue;
      const src = this.ac.createBufferSource();
      src.buffer = this.buffers.get(s.src);
      src.connect(this.ac.destination);
      const offset = Math.max(0, t - s.start);
      src.start(now + Math.max(0, s.start - t), offset);
      this.playing.push(src);
    }
    return now - t; // audio clock time corresponding to scene t = 0
  }
  stop() {
    for (const s of this.playing) {
      try { s.stop(); } catch (e) { /* already stopped */ }
    }
    this.playing = [];
  }
}
