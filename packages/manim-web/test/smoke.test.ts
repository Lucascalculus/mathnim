import { describe, expect, it } from 'vitest';
import * as M from '../src/index';

const { Scene, Circle, Square, Create, Transform, FadeOut, Dot, Arrow, Line, VGroup, BLUE, RIGHT, LEFT, UP } = M;

describe('pipeline', () => {
  it('records a scene with manim frame counts', async () => {
    class S extends Scene {
      override construct() {
        const c = Circle({ color: BLUE });
        this.play(Create(c));
        this.play(Transform(c, Square()));
        this.wait();
        this.play(FadeOut(c), { run_time: 0.5 });
      }
    }
    const s = await new S().render();
    const segs = s.segments.map((g) => [g.kind, g.n_frames, g.is_static]);
    expect(segs).toEqual([
      ['play', 60, false],
      ['play', 60, false],
      ['wait', 60, true],
      ['play', 30, false],
      ['wait', 0, true],
    ]);
    // like manim, Wait's empty Mobject stays in the scene
    expect(s.mobjects.map((m: any) => m.constructor.name)).toEqual(['Mobject']);
  });

  it('seeks by restoring snapshots', async () => {
    let circle: any;
    class S extends Scene {
      override construct() {
        circle = Circle();
        this.play(Create(circle));
        this.play(circle.animate.shift(RIGHT));
      }
    }
    const s = await new S().render();
    const endCenter = circle.get_center();
    expect(endCenter[0]).toBeCloseTo(1, 6);
    s.restore(s.segments[1].snapshot);
    expect(circle.get_center()[0]).toBeCloseTo(0, 6);
    s.restore(s.segments[2].snapshot);
    expect(circle.get_center()[0]).toBeCloseTo(1, 6);
  });

  it('callable classes and geometry', () => {
    const d = Dot(UP);
    expect(d.get_center()[1]).toBeCloseTo(1);
    const a = Arrow(LEFT, RIGHT);
    expect(a.submobjects.length).toBe(1);
    expect(a.get_end()[0]).toBeCloseTo(1 - 0.25, 6);
    const l = Line(LEFT, RIGHT, { buff: 0.5 });
    expect(l.get_start()[0]).toBeCloseTo(-0.5);
    expect(new Circle() instanceof Circle).toBe(true);
    expect(VGroup(Dot(), Dot()).submobjects.length).toBe(2);
  });
});
