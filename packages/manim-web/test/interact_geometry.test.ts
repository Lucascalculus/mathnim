// Pure logic of the interaction toolkit (WP1): polygon geometry and cutting,
// regions and zone choice, snapping, stamps, scrubbing, token sequences,
// tweens. No DOM.
import { describe, expect, it } from 'vitest';
import * as M from '../src/index';
import { point_in_polygon, polygon_area, polygon_centroid, segment_crossings, vmobject_to_polygon, mobject_contains } from '../src/ext/geom';
import {
  add_cut_angles, disc_cut_angles, sector_polygon, sectors_from_angles, snap_line_through, split_polygon, split_vmobject, stroke_crosses,
} from '../src/ext/cut';
import { choose_zone, region_area, region_center, region_contains, region_distance, snap_to_grid, snap_to_points, zone_target, type DropZone } from '../src/ext/dragdrop';
import { can_stamp, stamp_position } from '../src/ext/stamp';
import { scrub_value, step_value } from '../src/ext/scrub';
import { build_expression, join_latex, join_plain, token_plain } from '../src/ext/tokens';
import { SOUNDS, ease, tween_value } from '../src/ext/juice';

const { Circle, Square, Sector, VGroup } = M as any;
const P = (x: number, y: number): [number, number, number] => [x, y, 0];
const area = (poly: number[][]) => Math.abs(polygon_area(poly as any));
const square = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];

describe('polygons', () => {
  it('point in polygon, area, centroid', () => {
    expect(point_in_polygon(P(0, 0), square)).toBe(true);
    expect(point_in_polygon(P(1.5, 0), square)).toBe(false);
    expect(polygon_area(square)).toBeCloseTo(4);
    expect(polygon_area([...square].reverse())).toBeCloseTo(-4);
    const tri = [P(0, 0), P(3, 0), P(0, 3)];
    expect(polygon_centroid(tri)[0]).toBeCloseTo(1);
    expect(polygon_centroid(tri)[1]).toBeCloseTo(1);
    expect(segment_crossings(square, P(-2, 0), P(2, 0))).toBe(2);
  });
  it('splits a convex polygon into two pieces, left of the line first', () => {
    const parts = split_polygon(square, P(0, -5), P(0, 5))!;
    expect(parts).toHaveLength(2);
    expect(area(parts[0])).toBeCloseTo(2);
    expect(area(parts[1])).toBeCloseTo(2);
    // left of an upward line is x < 0
    expect(polygon_centroid(parts[0])[0]).toBeCloseTo(-0.5);
    expect(polygon_centroid(parts[1])[0]).toBeCloseTo(0.5);
    // a diagonal through two vertices
    const diag = split_polygon(square, P(-1, -1), P(1, 1))!;
    expect(diag).toHaveLength(2);
    expect(diag.map(area)).toEqual([expect.closeTo(2), expect.closeTo(2)]);
    // an off-centre cut keeps the total area
    const off = split_polygon(square, P(-3, 0.5), P(3, -0.2))!;
    expect(area(off[0]) + area(off[1])).toBeCloseTo(4);
  });
  it('returns null when the line misses or only touches', () => {
    expect(split_polygon(square, P(2, -5), P(2, 5))).toBeNull();
    expect(split_polygon(square, P(1, -5), P(1, 5))).toBeNull(); // along an edge
    expect(split_polygon(square, P(0, 2), P(2, 0))).toBeNull(); // through a corner only
  });
  it('splits a concave polygon into several pieces', () => {
    // a U: two arms joined at the bottom; a horizontal cut through both arms makes 3 pieces
    const U = [P(0, 0), P(3, 0), P(3, 3), P(2, 3), P(2, 1), P(1, 1), P(1, 3), P(0, 3)];
    const parts = split_polygon(U, P(-1, 2), P(4, 2))!;
    expect(parts).toHaveLength(3);
    expect(parts.map(area).reduce((a, b) => a + b, 0)).toBeCloseTo(area(U));
    // above the line (left of a rightward line): the two arm tips, 1 each
    expect(area(parts[0])).toBeCloseTo(1);
    expect(area(parts[1])).toBeCloseTo(1);
    expect(area(parts[2])).toBeCloseTo(5);
  });
  it('checks that a stroke goes all the way across', () => {
    expect(stroke_crosses(square, P(-2, 0), P(2, 0))).toBe(true);
    expect(stroke_crosses(square, P(0, 0), P(2, 0))).toBe(false); // starts inside
    expect(stroke_crosses(square, P(-0.95, 0), P(2, 0), 0.1)).toBe(true); // reach forgives a short start
  });
  it('approximates closed VMobjects as polygons and splits them', () => {
    const c = Circle({ radius: 1 });
    const poly = vmobject_to_polygon(c);
    expect(area(poly)).toBeCloseTo(Math.PI, 2);
    const parts = split_vmobject(c, P(0, -2), P(0, 2))!;
    expect(parts).toHaveLength(2);
    const a = parts.map((m: any) => area(vmobject_to_polygon(m)));
    expect(a[0]).toBeCloseTo(Math.PI / 2, 2);
    expect(a[1]).toBeCloseTo(Math.PI / 2, 2);
    // straight edges keep only their corners
    expect(vmobject_to_polygon(Square({ side_length: 2 }))).toHaveLength(4);
    const sq = split_vmobject(Square({ side_length: 2, fill_opacity: 0.5, color: '#FF0000' }), P(-2, 0.5), P(2, 0.5))!;
    expect(sq.map((m: any) => area(vmobject_to_polygon(m))).sort()).toEqual([expect.closeTo(1), expect.closeTo(3)]);
    expect(sq[0].get_fill_opacity()).toBeCloseTo(0.5);
    expect(split_vmobject(Square(), P(5, 0), P(5, 1))).toBeNull();
  });
  it('hit-tests filled shapes and groups', () => {
    const g = VGroup(Circle({ radius: 1, fill_opacity: 1 }), Square({ side_length: 0.5 }).shift([3, 0, 0]));
    expect(mobject_contains(g, P(0.2, 0.2))).toBe(true);
    expect(mobject_contains(g, P(1.5, 0))).toBe(false);
    expect(mobject_contains(g, P(1.05, 0), 0.1)).toBe(true);
    expect(mobject_contains(g, P(3.25, 0), 0.01)).toBe(true); // stroke of the unfilled square
    expect(mobject_contains(g, P(3, 0))).toBe(false); // inside an unfilled square
  });
});

describe('pizza cuts (discs and sectors)', () => {
  const C = P(0, 0), R = 2;
  it('a stroke across the centre makes a diameter, snapped through the centre', () => {
    const a = disc_cut_angles(C, R, P(-3, 0.2), P(3, 0.2));
    expect(a).toHaveLength(2);
    expect(Math.abs(a[1] - a[0])).toBeCloseTo(Math.PI);
    expect(a[0]).toBeCloseTo(Math.atan2(0, 6));
  });
  it('a stroke from the crust to the centre makes one radius; far strokes none', () => {
    const a = disc_cut_angles(C, R, P(0, 3), P(0, 0.1));
    expect(a).toHaveLength(1);
    expect(a[0]).toBeCloseTo(Math.PI / 2);
    expect(disc_cut_angles(C, R, P(-3, 1.5), P(3, 1.5))).toEqual([]);
    expect(disc_cut_angles(C, R, P(-0.2, 0), P(0.2, 0))).toEqual([]); // too short to reach the crust
  });
  it('merges cut angles and lists sectors', () => {
    let cuts: number[] = [];
    cuts = add_cut_angles(cuts, disc_cut_angles(C, R, P(-3, 0), P(3, 0)));
    cuts = add_cut_angles(cuts, disc_cut_angles(C, R, P(0, -3), P(0, 3)));
    cuts = add_cut_angles(cuts, [0.001]); // duplicate of 0
    expect(cuts).toHaveLength(4);
    const sec = sectors_from_angles(cuts);
    expect(sec).toHaveLength(4);
    for (const [a0, a1] of sec) expect(a1 - a0).toBeCloseTo(Math.PI / 2);
    expect(sectors_from_angles([])).toEqual([[0, Math.PI * 2]]);
    expect(sectors_from_angles([1])).toEqual([[1, 1 + Math.PI * 2]]);
  });
  it('sector polygons have the right area, and can be cut further', () => {
    const poly = sector_polygon(C, R, 0, Math.PI / 2, 64);
    expect(area(poly)).toBeCloseTo((Math.PI * R * R) / 4, 2);
    const parts = split_polygon(poly, P(0, 0), P(1, 1))!;
    expect(parts).toHaveLength(2);
    expect(area(parts[0])).toBeCloseTo(area(parts[1]), 2);
    const s = Sector({ radius: 2, angle: Math.PI / 2 });
    expect(area(vmobject_to_polygon(s))).toBeCloseTo(Math.PI, 2);
  });
  it('snaps a stroke through a centre when close enough', () => {
    const [a, b] = snap_line_through(P(-3, 0.2), P(3, 0.2), C, 0.3);
    expect(a[1]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(0);
    expect(snap_line_through(P(-3, 1), P(3, 1), C, 0.3)[0][1]).toBeCloseTo(1);
  });
});

describe('regions, zones and snapping', () => {
  const zones: DropZone[] = [
    { id: 'tray', region: { box: [-4, 4, -3, 3] } },
    { id: 'a', region: { box: [-2, 0, -1, 1] } },
    { id: 'b', region: { center: [2, 0, 0], radius: 1 } },
    { id: 'poly', region: { polygon: [P(-4, 2), P(-3, 2), P(-3, 3)] } },
    { id: 'pred', region: (p) => p[1] < -2.5 },
  ];
  it('region helpers', () => {
    expect(region_contains({ box: [0, 1, 0, 1] }, P(0.5, 0.5))).toBe(true);
    expect(region_distance({ box: [0, 1, 0, 1] }, P(2, 0.5))).toBeCloseTo(1);
    expect(region_distance({ center: [0, 0, 0], radius: 1 }, P(3, 0))).toBeCloseTo(2);
    expect(region_contains(Square({ side_length: 2 }).shift([5, 0, 0]), P(5.9, 0.9))).toBe(true); // mobject: its box
    expect(region_contains({ shape: Circle({ radius: 1 }) }, P(0.9, 0.9))).toBe(false); // shape: its outline
    expect(region_center({ box: [0, 2, 0, 4] })).toEqual([1, 2, 0]);
    expect(region_area({ center: [0, 0, 0], radius: 1 })).toBeCloseTo(Math.PI);
    expect(region_distance((p) => p[0] > 0, P(-1, 0))).toBe(Infinity);
  });
  it('prefers the smallest containing zone, then near misses, then (keyboard) the nearest', () => {
    expect(choose_zone(zones, P(-1, 0))!.id).toBe('a'); // inside a and tray
    expect(choose_zone(zones, P(2.2, 0.1))!.id).toBe('b');
    expect(choose_zone(zones.slice(1), P(3.2, 0), { radius: 0.3 })!.id).toBe('b');
    expect(choose_zone(zones.slice(1), P(3.5, 0), { radius: 0.3 })).toBeNull();
    expect(choose_zone(zones.slice(1, 3), P(0, 5), { nearest: true })!.id).toBe('a');
    expect(choose_zone(zones, P(-1, 0), { allowed: (z) => z.id !== 'a' })!.id).toBe('tray');
    expect(choose_zone(zones.slice(4), P(0, -2.8))!.id).toBe('pred');
    expect(choose_zone(zones.slice(3, 4), P(-3.2, 2.6))!.id).toBe('poly');
  });
  it('zone targets', () => {
    expect(zone_target(zones[1], null, P(-1.5, 0.5))).toEqual([-1, 0, 0]);
    expect(zone_target({ ...zones[1], snap_to: 'none' }, null, P(-1.5, 0.5))).toEqual([-1.5, 0.5, 0]);
    expect(zone_target({ ...zones[1], snap_to: [9, 9, 0] }, null, P(0, 0))).toEqual([9, 9, 0]);
    expect(zone_target({ ...zones[1], snap_to: (_d, _p, n) => [n, 0, 0] }, null, P(0, 0), 3)).toEqual([3, 0, 0]);
  });
  it('grid and magnet snapping', () => {
    expect(snap_to_grid(P(0.26, 0.74), 0.5)).toEqual([0.5, 0.5, 0]);
    expect(snap_to_grid(P(0.26, 0.74), [1, 0.25], P(0.5, 0))).toEqual([0.5, 0.75, 0]);
    expect(snap_to_grid(P(0.3, -0.3), 0.1)).toEqual([0.3, -0.3, 0]);
    expect(snap_to_points(P(1.1, 0), [P(0, 0), P(1, 0)], 0.3)).toEqual([1, 0, 0]);
    expect(snap_to_points(P(1.5, 0), [P(0, 0), P(1, 0)], 0.3)).toBeNull();
  });
});

describe('stamps', () => {
  it('positions and placement rules', () => {
    expect(stamp_position(P(0.4, 0.6), { grid: 1, origin: P(0.5, 0.5) })).toEqual([0.5, 0.5, 0]);
    expect(stamp_position(P(0.4, 0.6))).toEqual([0.4, 0.6, 0]);
    const placed = [P(0.5, 0.5), P(1.5, 0.5)];
    expect(can_stamp(placed, P(0.5, 0.5), { unique: true })).toBe('taken');
    expect(can_stamp(placed, P(0.5, 0.5))).toBe('ok');
    expect(can_stamp(placed, P(2.5, 0.5), { max: 2 })).toBe('full');
    expect(can_stamp(placed, P(2.5, 0.5), { max: 3, unique: true })).toBe('ok');
  });
});

describe('scrubbing', () => {
  it('turns horizontal drags into steps', () => {
    const o = { step: 0.5, min: 0, max: 5, px_per_step: 10 };
    expect(scrub_value(2, 0, o)).toBe(2);
    expect(scrub_value(2, 9, o)).toBe(2); // not a full step yet
    expect(scrub_value(2, 10, o)).toBe(2.5);
    expect(scrub_value(2, -25, o)).toBe(1);
    expect(scrub_value(2, 1000, o)).toBe(5);
    expect(scrub_value(2, -1000, o)).toBe(0);
    expect(scrub_value(2.37, 10, o)).toBe(3); // back onto the step grid
    expect(scrub_value(1, 16)).toBe(3); // defaults: step 1, 8 px per step
  });
  it('steps without floating-point noise', () => {
    expect(step_value(0.1, 2, { step: 0.1 })).toBe(0.3);
    expect(step_value(0.7, 1, { step: 0.1, min: 0, max: 0.75 })).toBe(0.75);
    expect(step_value(3, 0, { max: 2 })).toBe(2);
  });
});

describe('token sequences', () => {
  it('plain spellings of LaTeX tokens', () => {
    expect(token_plain('\\pi')).toBe('pi');
    expect(token_plain('\\times')).toBe('*');
    expect(token_plain('^2')).toBe('^2');
    expect(token_plain('^{2}')).toBe('^2');
    expect(token_plain('²')).toBe('^2');
    expect(token_plain('\\frac{1}{2}')).toBe('(1/2)');
    expect(token_plain('r')).toBe('r');
  });
  it('joins tokens into LaTeX and calculator expressions', () => {
    expect(join_latex(['\\pi', 'r', '^2'])).toBe('\\pi r^2');
    expect(join_latex(['2', '\\pi', 'r'])).toBe('2 \\pi r');
    expect(join_latex(['1', '2'])).toBe('12');
    expect(join_plain(['pi', 'r', '^2'])).toBe('pi*r^2');
    expect(join_plain(['r', '*', 'r'])).toBe('r*r');
    expect(join_plain(['2', 'pi', 'r'])).toBe('2*pi*r');
    expect(join_plain(['1', '2', 'r'])).toBe('12*r');
    expect(join_plain(['(', 'r', '+', '1', ')', '^2'])).toBe('(r+1)^2');
    expect(join_plain(['pi', '(', 'r', ')'])).toBe('pi*(r)');
  });
  it('builds the expression of a slot sequence', () => {
    const seq = ['\\pi', null, { tex: '^2', display: '\\square^2' }, 'r'];
    expect(build_expression(['\\pi', 'r', '^2'])).toBe('\\pi r^2');
    expect(build_expression(['\\pi', 'r', '^2'], 'plain')).toBe('pi*r^2');
    expect(build_expression(['\\pi', '\\times', 'r', '^2'], 'plain')).toBe('pi*r^2');
    expect(build_expression(seq)).toBe('\\pi^2 r');
    expect(build_expression(seq, 'latex', { blank: '\\square' })).toBe('\\pi \\square^2 r');
    expect(build_expression([{ tex: '\\pi', plain: 'PI' }, 'r'], 'plain')).toBe('PI*r');
  });
});

describe('juice (pure parts)', () => {
  it('tweens and easing', () => {
    expect(tween_value(0, 10, 0)).toBe(0);
    expect(tween_value(0, 10, 1)).toBe(10);
    expect(tween_value(0, 10, 2)).toBe(10);
    expect(tween_value(0, 10, 0.5, ease.linear)).toBe(5);
    expect(tween_value(0, 10, 0.5)).toBeGreaterThan(5); // ease-out: fast start
    expect(ease.out_back(0.7)).toBeGreaterThan(1); // overshoot
    expect(ease.out_back(1)).toBeCloseTo(1);
  });
  it('every sound is a short blip', () => {
    for (const [name, blips] of Object.entries(SOUNDS)) {
      expect(blips.length, name).toBeGreaterThan(0);
      const end = Math.max(...blips.map((b) => b.at + b.dur));
      expect(end, name).toBeLessThan(0.5);
      for (const b of blips) expect(b.gain).toBeLessThanOrEqual(0.25);
    }
  });
});
