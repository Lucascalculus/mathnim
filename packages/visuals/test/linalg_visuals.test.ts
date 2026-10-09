import { describe, expect, it } from 'vitest';
import { catalog, check_params, get_visual, list_visuals } from '../src';
import { collapse_and_flip, DET_ZERO } from '../src/linalg/determinant_area';
import { max_stretch, misalignment, stretch } from '../src/linalg/eigen_hunt';
import { lambda_range } from '../src/linalg/lambda_sweep';
import { min_det_on_path, orbit_start, start_path } from '../src/linalg/rotation_no_eigen';
import { fan_of, needs_rescale, powers } from '../src/linalg/matrix_power';
import { handle_picks, mahalanobis2, sigma_ellipse } from '../src/linalg/covariance_ellipse';
import { top_direction } from '../src/linalg/pca_projection';
import { view_along } from '../src/linalg/pca_3d';
import { clip_line, clip_polygon, fit_plane, lattice_segments, Plane } from '../src/linalg/kit';
import { char_poly, cloud2, cov2, det2, eig2, sym_eig2, type Mat2 } from '../src/linalg/math';

const NAMES = ['linear_map', 'determinant_area', 'eigen_hunt', 'lambda_sweep', 'rotation_no_eigen', 'matrix_power', 'symmetric_ellipse', 'covariance_ellipse', 'pca_projection', 'pca_3d'];
const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('linear algebra catalog', () => {
  it('registers all ten visuals with docs, examples and ids', () => {
    for (const n of NAMES) {
      const v = get_visual(n)!;
      expect(v, n).toBeTruthy();
      expect(v.summary.length).toBeGreaterThan(60);
      expect(v.topics.length).toBeGreaterThan(1);
      expect(v.examples!.length).toBeGreaterThanOrEqual(2);
      expect(new Set(v.ids).size).toBe(v.ids!.length);
      for (const spec of Object.values(v.params)) expect(spec.doc.length).toBeGreaterThan(10);
      for (const ex of v.examples!) {
        const r = check_params(v, ex as Record<string, unknown>);
        expect(r.errors, `${n} ${JSON.stringify(ex)}`).toEqual([]);
        expect(r.notes, `${n} ${JSON.stringify(ex)}`).toEqual([]);
      }
      expect(typeof v.explore).toBe('function');
    }
    expect(list_visuals(['pca']).map((v) => v.name)).toEqual(expect.arrayContaining(['pca_projection', 'pca_3d', 'covariance_ellipse']));
    const text = catalog(['linear algebra']);
    expect(text).toContain('lambda_sweep - Why det(A − λI) = 0');
    expect(text).toContain('A: 2x2 matrix in [-3, 3]');
  });
  it('keeps the linear algebra part of the catalog compact', () => {
    // the whole catalog goes into a prompt: about 1.5K tokens is the budget (PLAN WP5)
    const words = catalog(['linear algebra', 'pca']).split(/\s+/).length;
    expect(words).toBeLessThan(1500);
  });
  it('clamps a matrix the model got out of range', () => {
    const r = check_params(get_visual('linear_map')!, { A: [[5, 0], [0, 1]] });
    expect(r.ok).toBe(true);
    expect((r.params.A as number[][])[0][0]).toBe(3);
  });
});

describe('determinant_area', () => {
  it('turns ĵ onto î\'s line and past it', () => {
    const A: Mat2 = [[1.5, 1], [0.5, 2]];
    const cf = collapse_and_flip(A)!;
    close(det2(cf.flat), 0, 1e-9);
    expect(det2(cf.flipped)).toBeLessThan(0);
    close(Math.abs(det2(cf.flipped)), Math.hypot(1.5, 0.5) * Math.hypot(1, 2) * Math.abs(Math.sin(Math.atan2(2, 1) - Math.atan2(0.5, 1.5))), 1e-9);
    expect(collapse_and_flip([[1, 2], [0.5, 1]])).toBeNull();
    expect(DET_ZERO).toBeGreaterThan(0);
  });
});

describe('eigen_hunt', () => {
  it('measures alignment and stretch', () => {
    const A: Mat2 = [[3, 1], [0, 2]];
    close(misalignment(A, [1, 0]), 0);
    close(stretch(A, [1, 0]), 3);
    close(stretch([[1, 2], [2, 1]], [1, -1]), -1);
    close(misalignment([[1, 2], [2, 1]], [1, -1]), 0);
    close(misalignment([[0, -1], [1, 0]], [1, 0]), 90);
    expect(max_stretch(A)).toBeGreaterThan(3);
  });
});

describe('lambda_sweep', () => {
  it('shows the roots with room, or the real part when complex', () => {
    const [lo, hi] = lambda_range([[3, 1], [0, 2]]);
    expect(lo).toBeLessThan(2);
    expect(hi).toBeGreaterThan(3);
    const [a, b] = lambda_range([[1, -1], [1, 1]]);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(1);
    close(char_poly([[3, 1], [0, 2]], 2), 0);
  });
});

describe('rotation_no_eigen', () => {
  for (const A of [[[1, -1], [1, 1]], [[0, -1], [1, 0]], [[0.8, -1.2], [0.6, 0.9]], [[2, 1], [1, 2]]] as Mat2[]) {
    it(`starts with two eigenlines and never passes a singular matrix: ${JSON.stringify(A)}`, () => {
      const { S, merge } = start_path(A);
      expect(eig2(S).kind).toBe('distinct');
      expect(min_det_on_path(S, A)).toBeGreaterThan(0.1);
      if (eig2(A).kind === 'complex') {
        expect(merge).not.toBeNull();
        expect(merge!).toBeGreaterThan(0);
        expect(merge!).toBeLessThan(1);
      } else expect(merge).toBeNull();
    });
  }
  it('picks an orbit start that makes about one turn', () => {
    const v = orbit_start([[0, -1], [1, 0]], 3);
    expect(Math.hypot(v[0], v[1])).toBeGreaterThan(1);
  });
});

describe('matrix_power', () => {
  it('rescales only when the powers blow up or vanish', () => {
    const fan = fan_of(5, 1.5, 0);
    expect(needs_rescale([[0.9, 0.3], [0.2, 0.8]], 8, 1.5, fan)).toBe(false);
    expect(needs_rescale([[2, 1], [1, 2]], 5, 1.5, fan)).toBe(true);
    expect(powers([[2, 0], [0, 1]], [1, 1], 3)).toEqual([[1, 1], [2, 1], [4, 1], [8, 1]]);
  });
});

describe('covariance_ellipse and pca_projection', () => {
  const pts = cloud2({ n: 80, correlation: 0.7, spread: 1, aspect: 0.8, seed: 7 });
  const { mean, cov } = cov2(pts);
  it('puts the k-sigma ellipse at Mahalanobis distance k', () => {
    for (const q of sigma_ellipse(mean, cov, 2, 24)) close(mahalanobis2(q, mean, cov), 4, 1e-9);
  });
  it('offers well spread handles', () => {
    const picks = handle_picks(pts, 6);
    expect(new Set(picks).size).toBe(picks.length);
    expect(picks.length).toBeGreaterThanOrEqual(5);
  });
  it('finds the top direction of the cloud', () => {
    const q = sym_eig2(cov).vectors[0];
    const a = top_direction(pts);
    close(Math.abs(Math.cos(a) * q[0] + Math.sin(a) * q[1]), 1, 1e-9);
  });
});

describe('pca_3d', () => {
  it('looks straight along the normal with the given direction horizontal', () => {
    const n = [0.3, -0.5, 0.81], across = [0.9, 0.4, -0.1];
    const len = Math.hypot(...n);
    const nn = n.map((x) => x / len);
    const { phi, theta } = view_along(nn, across);
    close(Math.cos(phi), nn[2], 1e-9);
    close(Math.atan2(nn[1], nn[0]), theta, 1e-9);
  });
});

describe('kit', () => {
  const plane: Plane = fit_plane({ x0: -4, x1: 4, y0: -3, y1: 3 }, [0, 0], 2.5, 1);
  it('fits a plane and maps both ways', () => {
    expect(plane.unit).toBeCloseTo(1, 9);
    const q = plane.to_math(plane.p(1.5, -2));
    close(q[0], 1.5);
    close(q[1], -2);
  });
  it('clips lines and polygons to a box', () => {
    const s = clip_line([0, 0], [1, 1], { x0: -1, x1: 1, y0: -2, y1: 2 })!;
    expect(s[0]).toEqual([-1, -1, 0]);
    expect(s[1]).toEqual([1, 1, 0]);
    expect(clip_line([5, 5], [1, 0], { x0: -1, x1: 1, y0: -1, y1: 1 })).toBeNull();
    const poly = clip_polygon([[-2, -2], [2, -2], [2, 2], [-2, 2]], { x0: -1, x1: 1, y0: -1, y1: 1 });
    expect(poly.length).toBe(4);
  });
  it('draws a squashed grid as a single line', () => {
    const segs = lattice_segments(plane, [[1, 2], [0.5, 1]], 'include');
    // both families collapse onto the line through (1, 0.5): only the k = 0 lines remain
    expect(segs.length).toBe(2);
    expect(lattice_segments(plane, [[1, 0], [0, 1]], 'include').length).toBe(9 + 7);
  });
});
