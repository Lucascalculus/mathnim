// The odometer: a number drawn as digit wheels that roll continuously and carry the way a mechanical counter does.
import { css } from './ui.js';

// A counter value x (continuous, in units of the last shown digit). Wheel k shows floor(x / 10^k) mod 10, and turns
// only while every wheel below it is passing from 9 to 0: the carry of a mechanical counter. So at an integer x every
// wheel rests exactly on a digit, and a wheel is between digits only while it is being carried.
export function wheel(x, k) {
  const p = Math.pow(10, k), q = Math.floor(x / p), below = x - q * p;   // what the lower wheels hold, 0 ≤ below < p
  const carry = k === 0 ? below : Math.max(0, below - (p - 1));         // the last unit of the lower wheels turns this one
  return ((q % 10) + 10) % 10 + carry;                                    // 0 ≤ position < 10 (9.x rolls into 0)
}

css('fx-odo', `
.fx-odo{display:inline-flex;align-items:baseline;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:baseline}
.fx-odo .w{position:relative;display:inline-block;overflow:hidden;height:1.06em;line-height:1.06em;vertical-align:-0.22em;transition:width .28s cubic-bezier(.16,1,.3,1);
  -webkit-mask-image:linear-gradient(transparent 0,#000 14%,#000 86%,transparent 100%);mask-image:linear-gradient(transparent 0,#000 14%,#000 86%,transparent 100%)}
.fx-odo .w .s{position:absolute;left:0;right:0;top:0;will-change:transform}
.fx-odo .w .ph{visibility:hidden}
.fx-odo .w .s i{display:block;height:1.06em;font-style:normal;text-align:center}
.fx-odo .f{display:inline-block}
.fx-odo .w.blur .s{filter:blur(.06em);opacity:.5}
`);

// A DOM odometer. fmt: { places (digits after the point), group (thousands separator), min_int (int digits kept) }.
// set(x) takes the value in real units; each wheel's strip is moved to its exact wheel() position.
export class Odometer {
  constructor(el, o = {}) {
    this.el = el; this.places = o.places || 0; this.group = o.group ?? ','; this.min_int = o.min_int || 1; this.max_int = o.max_int || 6;
    this.suffix = o.suffix || ''; el.classList.add('fx-odo'); el.innerHTML = '';
    this.wheels = []; this.seps = [];
    const n = this.max_int + this.places;
    // wheels from the highest place down; a point before the decimals; separators every three integer places
    for (let i = n - 1; i >= 0; i--) {
      const w = document.createElement('span'); w.className = 'w';
      const s = document.createElement('span'); s.className = 's';
      s.innerHTML = Array.from({ length: 11 }, (_, d) => `<i>${d % 10}</i>`).join('');
      const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = '0';
      w.append(ph, s); el.append(w); this.wheels[i] = { w, s, pos: 0, shown: true };
      const int_place = i - this.places;
      if (this.places && i === this.places) { const f = document.createElement('span'); f.className = 'f'; f.textContent = '.'; el.append(f); }
      if (this.group && int_place > 0 && int_place % 3 === 0) { const f = document.createElement('span'); f.className = 'f sep'; f.textContent = this.group; el.append(f); this.seps.push({ f, place: int_place }); }
    }
    if (this.suffix) { const f = document.createElement('span'); f.className = 'f'; f.textContent = this.suffix; el.append(f); }
    this.x = NaN; this.digit_w = 0;
  }
  measure() { const i = this.wheels[0].s.querySelector('i'); const w = i.getBoundingClientRect().width; if (w) this.digit_w = w; }
  // x in counter units; the integer wheels shown are those of the larger of the two counts x lies between
  int_digits(x) { const hi = Math.ceil(Math.abs(x) - 1e-9), p = Math.pow(10, this.places); return Math.max(this.min_int, String(Math.floor(hi / p)).length); }
  set(value) {
    const x = Math.round(value * Math.pow(10, this.places) * 1e6) / 1e6;   // counter units, rounded off float dust
    if (x === this.x) { if (this.blurred) { this.blurred = false; for (const W of this.wheels) W.w.classList.remove('blur'); } return; }
    const dx = Math.abs(x - (isNaN(this.x) ? x : this.x)); this.x = x;
    if (!this.digit_w) this.measure();
    const show = this.int_digits(x) + this.places;
    for (let k = 0; k < this.wheels.length; k++) {
      const W = this.wheels[k], pos = wheel(Math.max(0, x), k); W.pos = pos;
      // a wheel turning faster than half a digit per frame is a blur, as a real drum is
      const fast = dx / Math.pow(10, k) > 0.5; if (fast !== W.w.classList.contains('blur')) W.w.classList.toggle('blur', fast); if (fast) this.blurred = true;
      W.s.style.transform = `translateY(${(-pos * 1.06).toFixed(5)}em)`;
      const on = k < show; if (on !== W.shown) { W.shown = on; W.w.style.width = on ? '' : '0px'; W.w.style.opacity = on ? '1' : '0'; }
    }
    for (const s of this.seps) s.f.style.display = s.place < show - this.places ? '' : 'none';
  }
  // the digits the wheels rest on (null if any shown wheel is between digits)
  reading() {
    let out = '';
    for (let k = this.wheels.length - 1; k >= 0; k--) {
      const W = this.wheels[k]; if (!W.shown) continue;
      if (Math.abs(W.pos - Math.round(W.pos)) > 1e-6) return null;
      out += String(Math.round(W.pos) % 10);
      if (this.places && k === this.places) out += '.';
    }
    return out;
  }
}
