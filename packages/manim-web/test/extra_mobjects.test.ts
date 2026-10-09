// Numbers checked against manim v0.21 (reference values computed with the manim venv).
import { describe, expect, it } from 'vitest';
import * as M from '../src/index';
import { config } from '../src/_config';
import { pil_perspective_transform } from '../src/mobject/types/image_mobject';
import { default_rng } from '../src/utils/pcg64';

const { ChangeSpeed, Wait, Square, Circle, Union, Intersection, Difference, Exclusion, PointCloudDot, ArrowVectorField, MovingCamera, Scene, Dot, RIGHT, UP, UR, LEFT } = M;
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('speedmodifier', () => {
  it('ChangeSpeed run time and remapped rate function match manim', () => {
    const cs: any = ChangeSpeed(Wait(1), { speedinfo: { 0.3: 1, 0.4: 0.1, 0.6: 0.1, 1: 1 }, affects_speed_updaters: false });
    close(cs.run_time, 3.209090909090909);
    const ts = [0, 0.1, 0.25, 0.4, 0.5, 0.7, 0.9, 1];
    const ref = [0.0, 0.3198270454545455, 0.43204545454545457, 0.4801818181818182, 0.5122727272727273, 0.5764545454545454, 0.7428114204545456, 1.0];
    ts.forEach((t, i) => close(cs.anim.rate_func(t), ref[i], 1e-12));
  });
  it('ChangeSpeed.add_updater uses the modified dt while a speed change plays', async () => {
    class S extends Scene {
      override construct() {
        const a: any = Dot().shift([-4, 0, 0]);
        this.add(a);
        (this as any).a = a;
        ChangeSpeed.add_updater(a, (x: any, dt: number) => x.shift([4 * dt, 0, 0]));
        this.play(ChangeSpeed(Wait(2), { speedinfo: { 0.4: 1, 0.5: 0.2, 0.8: 0.2, 1: 1 }, affects_speed_updaters: true }));
      }
    }
    const s: any = await new S().render();
    // the dot moves 4 units per second of the (unscaled) Wait: 2 s -> 8 units
    close(s.a.get_center()[0], 4, 1e-9);
    expect((ChangeSpeed as any).is_changing_dt).toBe(false);
  });
});

describe('boolean_ops', () => {
  const cases: [string, any][] = [['union', Union], ['intersection', Intersection], ['difference', Difference], ['exclusion', Exclusion]];
  const ref: any = {"union": {"bbox": [-3.0, -0.30000001192092896, -1.0, 1.7000000476837158], "length": 9.594020839011883, "n": 44}, "intersection": {"bbox": [-2.299999952316284, -1.0, -0.30000001192092896, 1.0], "length": 4.687539487876842, "n": 24}, "difference": {"bbox": [-3.0, -1.0, -1.0, 1.0], "length": 7.6717771587752805, "n": 36}, "exclusion": {"bbox": [-3.0, -0.30000001192092896, -1.0, 1.7000000476837158], "length": 14.281560326888727, "n": 68}};
  for (const [name, cls] of cases) {
    it(`${name} of a square and a circle has manim's outline`, () => {
      const sq = Square().move_to([-2, 0, 0]);
      const cr = Circle().move_to([-1.3, 0.7, 0]);
      const m: any = cls(sq, cr);
      const bbox = [m.get_left()[0], m.get_right()[0], m.get_bottom()[1], m.get_top()[1]];
      // skia works in float32
      ref[name].bbox.forEach((v: number, i: number) => close(bbox[i], v, 1e-6));
      close(m.get_arc_length(), ref[name].length, 2e-3);
    });
  }
});

describe('point_cloud_mobject', () => {
  it('PointCloudDot generates manim\'s points', () => {
    const p: any = PointCloudDot({ radius: 1, density: 20 });
    expect(p.points.length / 3).toBe(1303);
    const first = [[0.05, 0.0, 0.0], [0.04206267664155906, 0.02703204087277988, 0.0], [0.020770750650094323, 0.04548159976772592, 0.0]];
    first.forEach((q: number[], i: number) => q.forEach((v, k) => close(p.points[3 * i + k], v, 1e-12)));
    expect(PointCloudDot({ radius: 1, density: 20 }).thin_out(3).points.length / 3).toBe(435);
  });
});

describe('vector_field', () => {
  it('ArrowVectorField places and colours arrows like manim', () => {
    config.pixel_width = 480;
    config.pixel_height = 270;
    const vf: any = ArrowVectorField((pos: number[]) => [(pos[0] * UR[0] + pos[1] * LEFT[0] - pos[0]) / 3, (pos[0] * UR[1] + pos[1] * LEFT[1] - pos[1]) / 3, 0]);
    expect(vf.submobjects.length).toBe(561);
    const ref = [[-7.0, -2.5, 0.0], [-6.953691248893558, -2.5833557519915953, 0.0], [-6.9073824977871165, -2.6667115039831906, 0.0], [-6.861073746680674, -2.7500672559747863, 0.0]];
    ref.forEach((q: number[], i: number) => q.forEach((v, k) => close(vf.submobjects[37].points[3 * i + k], v, 1e-9)));
    expect(vf.submobjects[37].get_color().to_hex()).toBe('#F99460');
  });
  it('default_rng(0) reproduces numpy PCG64', () => {
    expect(default_rng(0).random(5)).toEqual([0.6369616873214543, 0.2697867137638703, 0.04097352393619469, 0.016527635528529094, 0.8132702392002724]);
  });
});

describe('image_mobject', () => {
  it('resamples like PIL Image.transform(PERSPECTIVE)', () => {
    const src = { width: 3, height: 2, data: new Uint8ClampedArray([10, 200, 30, 255, 250, 0, 5, 128, 0, 0, 255, 255, 60, 60, 60, 255, 0, 255, 0, 0, 255, 255, 255, 255]) };
    const coef = [3 / 7, 0.05, 0.1, -0.02, 2 / 5, 0.2, 1e-4, -2e-4];
    const ref: Record<string, number[]> = {"0": [10, 200, 30, 255, 10, 200, 30, 255, 250, 0, 5, 128, 250, 0, 5, 128, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 10, 200, 30, 255, 10, 200, 30, 255, 250, 0, 5, 128, 250, 0, 5, 128, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 60, 60, 60, 255, 60, 60, 60, 255, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 60, 60, 60, 255, 60, 60, 60, 255, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 60, 60, 60, 255, 60, 60, 60, 255, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0], "2": [10, 200, 30, 255, 46, 169, 25, 220, 138, 92, 16, 166, 194, 0, 60, 143, 70, 0, 182, 198, 2, 0, 252, 252, 0, 0, 255, 255, 24, 159, 38, 255, 56, 138, 32, 203, 140, 76, 20, 136, 181, 20, 93, 125, 93, 42, 203, 193, 48, 48, 255, 255, 43, 43, 255, 255, 44, 103, 50, 255, 60, 97, 46, 176, 126, 64, 29, 87, 195, 97, 157, 94, 164, 140, 232, 183, 150, 150, 255, 255, 0, 0, 0, 0, 60, 60, 60, 255, 58, 58, 58, 148, 58, 58, 58, 39, 255, 255, 255, 70, 255, 255, 255, 179, 252, 252, 255, 255, 0, 0, 0, 0, 59, 59, 59, 244, 58, 58, 58, 135, 58, 58, 58, 26, 255, 255, 255, 83, 255, 255, 255, 192, 255, 255, 255, 255, 0, 0, 0, 0], "3": [0, 236, 30, 255, 57, 183, 8, 218, 195, 110, 0, 159, 228, 0, 55, 146, 79, 0, 183, 193, 0, 0, 252, 252, 0, 0, 255, 255, 18, 173, 41, 255, 61, 139, 11, 192, 178, 72, 0, 113, 233, 0, 100, 107, 111, 22, 215, 179, 46, 49, 255, 255, 35, 49, 255, 255, 44, 108, 53, 255, 50, 83, 16, 158, 114, 0, 0, 60, 255, 81, 197, 66, 181, 140, 248, 167, 157, 160, 255, 255, 0, 0, 0, 0, 64, 49, 62, 255, 10, 4, 19, 118, 0, 0, 0, 5, 255, 255, 255, 30, 255, 255, 255, 163, 255, 255, 255, 255, 0, 0, 0, 0, 65, 41, 62, 243, 0, 0, 8, 95, 0, 0, 0, 0, 255, 255, 255, 30, 255, 255, 255, 175, 255, 255, 255, 255, 0, 0, 0, 0]};
    for (const mode of [0, 2, 3]) {
      const out = new Uint8ClampedArray(7 * 5 * 4);
      pil_perspective_transform(src, coef, mode, 0, 0, 0, 0, 7, 5, out);
      expect(Array.from(out)).toEqual(ref[mode]);
    }
  });
});

describe('moving_camera', () => {
  it('frame-backed properties and auto_zoom', () => {
    const cam: any = new (MovingCamera as any)();
    close(cam.frame_height, config.frame_height);
    cam.frame_width = 7;
    close(cam.frame.width, 7);
    cam.frame_center = [1, 2, 0];
    expect(cam.frame.get_center()).toEqual([1, 2, 0]);
    const sq = Square().move_to([3, 0, 0]);
    cam.auto_zoom([sq], 0, false, false);
    close(cam.frame_center[0], 3);
    close(cam.frame_width, 2); // 2/7 > 2/8: fits the width
    close(cam.frame_height, 16 / 7);
  });
});

describe('smoke', () => {
  it('records scenes using the other ported classes', async () => {
    const { ZoomedScene, LinearTransformationScene, ShowPassingFlashWithThinningStrokeWidth, FocusOn, Circumscribe, ApplyWave, Wiggle, Blink, Mobject1D, FullScreenRectangle, ImageMobject } = M as any;
    class Z extends ZoomedScene {
      override construct() {
        const d = Dot();
        this.add(d, FullScreenRectangle());
        (this as any).activate_zooming(true);
        this.play(ShowPassingFlashWithThinningStrokeWidth(Circle()), FocusOn([1, 1, 0]), Circumscribe(d, { shape: Circle, fade_in: true }));
        this.play(ApplyWave(Square()), Wiggle(d), Blink(Square(), { blinks: 2 }));
        const line = Mobject1D();
        line.add_line([0, 0, 0], [1, 0, 0]);
        this.add(line, ImageMobject([[0, 255], [255, 0]]).set_opacity(0.5));
        this.wait();
      }
    }
    const z: any = await new Z().render();
    expect(z.segments.length).toBeGreaterThan(3);
    expect(z.camera.image_mobjects_from_cameras.length).toBe(1);
    class L extends LinearTransformationScene {
      override construct() {
        (this as any).add_vector([1, 2]);
        (this as any).add_unit_square();
        (this as any).apply_matrix([[1, 1], [0, 1]]);
      }
    }
    const l: any = await new L({ leave_ghost_vectors: true }).render();
    const v = l.moving_vectors[2];
    close(v.get_end()[0], 3, 1e-9);
    close(v.get_end()[1], 2, 1e-9);
    close(l.square.get_corner([1, 1, 0])[0], 2, 1e-9);
  });
});
