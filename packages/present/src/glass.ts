// Condensing glass (凝结玻璃; specimen fx 'condense'): a pane that answers a tap does not pop up. A string of glass
// droplets flies from where you touched, gathers and melts into one pane of clear glass, and what it says is written
// on it as it forms (≤ 0.6 s). It is glass because it is held by your hand: tap anywhere else, or Esc, and it is
// gone. Clear, not frosted. Used for a source behind a footnote marker; open to any short answer to a tap.
//
//   condense(html, { x, y }, anchor_rect)   →  { el, close() }
import { define_effect, t } from '@mathnim/engine';

let current: { el: HTMLElement; close: () => void; key?: string } | null = null;

/** Close the pane that is open, if any. */
export function evaporate(): void {
  current?.close();
}

/** A glass pane with `html` on it, condensing from (x, y) (client px) next to `near` (the thing tapped). */
export function condense(html: string, from: { x: number; y: number }, near: DOMRect, o: { key?: string; width?: number } = {}): { el: HTMLElement; close: () => void } {
  // a second tap on the same thing closes it
  if (current && o.key && current.key === o.key) {
    current.close();
    return { el: document.createElement('div'), close: () => {} };
  }
  current?.close();
  const el = document.createElement('div');
  el.className = 'mn-glass';
  el.setAttribute('role', 'note');
  el.innerHTML = html;
  el.style.visibility = 'hidden';
  document.body.append(el);
  // where it forms: under the thing tapped (above it near the bottom of the screen), inside the viewport
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, W = Math.min(o.width ?? 360, vw - 24);
  el.style.width = `${W}px`;
  const H = el.offsetHeight, below = near.bottom + 10 + H < vh - 8;
  const left = Math.max(12, Math.min(vw - W - 12, near.left + near.width / 2 - W / 2)), top = below ? near.bottom + 10 : Math.max(8, near.top - 10 - H);
  el.style.left = `${left + scrollX}px`;
  el.style.top = `${top + scrollY}px`;
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('mn-glass-out');
    setTimeout(() => el.remove(), 180);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', esc);
    if (current?.el === el) current = null;
  };
  const outside = (e: PointerEvent) => { if (!el.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', esc);
  }, 0);
  current = { el, close, key: o.key };
  if (still) { el.style.visibility = ''; return current; }
  drops({ x: from.x, y: from.y }, { x: left, y: top, w: W, h: H }, () => { if (!closed) { el.style.visibility = ''; el.classList.add('mn-glass-in'); } });
  return current;
}

/**
 * The droplets: a field of soft blobs (each drop) and a rounded rectangle that grows (the pane), cut at half
 * strength, drawn as glass (light along the top of each rim, a little shade along the bottom), at half resolution on
 * a canvas over the page; the pane itself takes over when it has formed.
 */
function drops(src: { x: number; y: number }, R: { x: number; y: number; w: number; h: number }, done: () => void): void {
  const pad = 24, x0 = Math.min(src.x, R.x) - pad, y0 = Math.min(src.y, R.y) - pad, x1 = Math.max(src.x, R.x + R.w) + pad, y1 = Math.max(src.y, R.y + R.h) + pad;
  const S = 2, CW = Math.ceil((x1 - x0) / S), CH = Math.ceil((y1 - y0) / S);
  if (CW * CH > 400_000) { done(); return; }
  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  cv.className = 'mn-glass-drops';
  Object.assign(cv.style, { left: `${x0 + scrollX}px`, top: `${y0 + scrollY}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
  document.body.append(cv);
  const g = cv.getContext('2d')!, img = g.createImageData(CW, CH), out = img.data;
  const rr = 16, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  const ds = Array.from({ length: 14 }, () => ({ x: src.x, y: src.y, vx: 0, vy: 0, tx: R.x + 18 + Math.random() * (R.w - 36), ty: R.y + 14 + Math.random() * Math.max(1, R.h - 28), r: 8 + Math.random() * 10, d: Math.random() * 0.16 }));
  const sdf = (px: number, py: number) => { const qx = Math.abs(px - cx) - (R.w / 2 - rr), qy = Math.abs(py - cy) - (R.h / 2 - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
  const t0 = performance.now();
  let last = t0;
  const frame = () => {
    const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const d of ds) {
      if (t < d.d) continue;
      // a stiff spring toward its place in the pane
      d.vx += ((d.tx - d.x) * 90 - d.vx * 15) * dt; d.vy += ((d.ty - d.y) * 90 - d.vy * 15) * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }
    const p = Math.min(1, Math.max(0, (t - 0.2) / 0.32)), pe = p * p * (3 - 2 * p);
    const field = (px: number, py: number) => {
      let f = pe > 0 ? Math.min(1, Math.max(0, 0.5 - sdf(px, py) / (2 + 26 * (1 - pe)))) * (0.4 + 0.6 * pe) * 1.6 : 0;
      for (const d of ds) { const dx = px - d.x, dy = py - d.y, q = 1 - (dx * dx + dy * dy) / (d.r * d.r * 4); if (q > 0) f += q * q * (1 - pe * 0.8); }
      return f;
    };
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const px = x0 + (i + 0.5) * S, py = y0 + (j + 0.5) * S, f = field(px, py), k = (j * CW + i) * 4;
      const a = Math.min(1, Math.max(0, (f - 0.5) / 0.08));
      if (a <= 0) { out[k + 3] = 0; continue; }
      const gy = field(px, py + 1.5) - field(px, py - 1.5), edge = Math.min(1, Math.max(0, 1 - (f - 0.5) / 0.5));
      const lit = Math.min(1, Math.max(0, -gy * 7)) * edge, dark = Math.min(1, Math.max(0, gy * 7)) * edge * 0.3;
      const c = Math.round(Math.min(255, 246 * (0.97 - dark) + 255 * 0.5 * lit));
      out[k] = c; out[k + 1] = c; out[k + 2] = Math.min(255, c + 2); out[k + 3] = Math.round(255 * a * (0.78 + 0.2 * edge));
    }
    g.putImageData(img, 0, 0);
    if (t < 0.56) requestAnimationFrame(frame);
    else { done(); setTimeout(() => cv.remove(), 60); }
  };
  requestAnimationFrame(frame);
}

define_effect({ name: 'condense', says: t('a pane condenses as glass from where the finger is', '面板从手指的地方凝结成玻璃'), zones: ['text'], maturity: 'stable', since: '0.2.1', from: 'motion/condense', syntax: '[^key]', accept: t('formed within 0.6 s; not frosted', '0.6 秒内成形；不磨砂'), source: 'packages/present/src/glass.ts' });
