// Grade a hand-drawn prediction of a graph against the true function.
//
// The score rewards the *shape* a learner is asked to predict - where it
// rises and falls, where the peak is, the value level - rather than pixel
// accuracy, and produces feedback a learner can act on.

export type XY = [number, number];

export interface SketchTarget {
  f: (x: number) => number;
  x_range: [number, number];
  /** Visible y-range of the axes (sets the error scale). */
  y_range: [number, number];
}
export interface SketchResult {
  score: number; // 0..1
  correct: boolean;
  coverage: number; // fraction of the x-range the sketch covers
  trend_agreement: number; // fraction of samples whose slope sign agrees
  peak_error: number | null; // |x_peak(sketch) - x_peak(f)| / width, when f has an interior extremum
  rms: number; // RMS error / y-range
  feedback: string[];
}

/** Resample a polyline (sorted by x, x-monotone parts only) at xs. */
function sampleAt(points: XY[], xs: number[]): (number | null)[] {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  return xs.map((x) => {
    if (!pts.length || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let i = 1;
    while (i < pts.length && pts[i][0] < x) i++;
    const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(pts.length - 1, i)];
    return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  });
}
function extremum(ys: number[], xs: number[]): { kind: 'max' | 'min'; x: number } | null {
  let iMax = 0, iMin = 0;
  ys.forEach((y, i) => {
    if (y > ys[iMax]) iMax = i;
    if (y < ys[iMin]) iMin = i;
  });
  const interior = (i: number) => i > ys.length * 0.05 && i < ys.length * 0.95;
  if (interior(iMax)) return { kind: 'max', x: xs[iMax] };
  if (interior(iMin)) return { kind: 'min', x: xs[iMin] };
  return null;
}

export function grade_sketch(points: XY[], t: SketchTarget, o: { pass?: number; samples?: number } = {}): SketchResult {
  const n = o.samples ?? 96;
  const [x0, x1] = t.x_range;
  const width = x1 - x0, height = t.y_range[1] - t.y_range[0];
  const xs = Array.from({ length: n }, (_, i) => x0 + (width * i) / (n - 1));
  const truth = xs.map(t.f);
  const user = sampleAt(points, xs);
  const idx = user.map((u, i) => (u === null || !Number.isFinite(truth[i]) ? -1 : i)).filter((i) => i >= 0);
  const feedback: string[] = [];
  const coverage = idx.length / n;
  if (coverage < 0.5) {
    return { score: 0, correct: false, coverage, trend_agreement: 0, peak_error: null, rms: 1, feedback: ['Draw across the whole range of x.'] };
  }
  const rms = Math.sqrt(idx.reduce((s, i) => s + (((user[i] as number) - truth[i]) / height) ** 2, 0) / idx.length);
  // slope-sign agreement over a coarse step (ignores hand jitter)
  const step = Math.max(1, Math.round(n / 24));
  let agree = 0, total = 0;
  for (let k = 0; k + step < idx.length; k += step) {
    const i = idx[k], j = idx[k + step];
    const dt = truth[j] - truth[i], du = (user[j] as number) - (user[i] as number);
    if (Math.abs(dt) < height * 0.004) continue;
    total++;
    if (Math.sign(dt) === Math.sign(du)) agree++;
  }
  const trend = total ? agree / total : 1;
  const tx = idx.map((i) => xs[i]);
  const tExt = extremum(idx.map((i) => truth[i]), tx);
  const uExt = extremum(idx.map((i) => user[i] as number), tx);
  let peak_error: number | null = null;
  if (tExt) {
    if (!uExt || uExt.kind !== tExt.kind) {
      peak_error = 1;
      feedback.push(tExt.kind === 'max' ? 'The true graph has a highest point inside the range - yours does not.' : 'The true graph has a lowest point inside the range - yours does not.');
    } else {
      peak_error = Math.abs(uExt.x - tExt.x) / width;
      if (peak_error > 0.08) feedback.push(`Your ${tExt.kind === 'max' ? 'peak' : 'dip'} is too far ${uExt.x < tExt.x ? 'left' : 'right'}.`);
    }
  } else if (uExt && trend < 0.8) feedback.push('The true graph keeps going the same way - it has no turning point here.');
  if (trend < 0.75) feedback.push('Check where the graph rises and where it falls.');
  const bias = idx.reduce((s, i) => s + ((user[i] as number) - truth[i]), 0) / idx.length / height;
  if (Math.abs(bias) > 0.12) feedback.push(bias > 0 ? 'Your curve is generally too high.' : 'Your curve is generally too low.');
  const score = Math.max(0, Math.min(1, 0.45 * trend + 0.3 * (1 - Math.min(1, (peak_error ?? 0) * 4)) + 0.25 * (1 - Math.min(1, rms * 3))));
  const pass = o.pass ?? 0.7;
  if (score >= pass && !feedback.length) feedback.push('Good shape.');
  return { score, correct: score >= pass, coverage, trend_agreement: trend, peak_error, rms, feedback };
}
