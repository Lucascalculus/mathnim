import * as M from '../src/index';
import { ScenePlayer } from '../src/ext/player';

const { Scene, Circle, Square, Create, Transform, FadeIn, FadeOut, Dot, Arrow, DoubleArrow, Line, DashedLine, VGroup, Star, RegularPolygon,
  RoundedRectangle, SurroundingRectangle, Angle, RightAngle, Annulus, Sector, Ellipse, ArcBetweenPoints, CurvedArrow, Rotate, LaggedStart,
  BLUE, TEAL, YELLOW, RED, GREEN, ORANGE, PURPLE, RIGHT, LEFT, UP, DOWN, PI, DEGREES } = M as any;

class Demo extends Scene {
  override construct() {
    const c = Circle({ color: BLUE, fill_opacity: 0.3 });
    this.play(Create(c));
    this.play(Transform(c, Square({ color: TEAL, fill_opacity: 0.5 })));
    const shapes = VGroup(
      Star({ color: YELLOW, fill_opacity: 0.6 }), RegularPolygon(6, { color: RED }), RoundedRectangle({ width: 2, height: 1.2, color: GREEN }),
      Annulus({ inner_radius: 0.4, outer_radius: 0.8, color: ORANGE }), Sector({ radius: 0.9, angle: 100 * DEGREES, color: PURPLE }),
      Ellipse({ width: 2, height: 1, color: BLUE }),
    ).arrange_in_grid(2, 3, { buff: 0.6 }).to_edge(UP);
    this.play(FadeOut(c), LaggedStart(...shapes.submobjects.map((s: any) => FadeIn(s, { shift: UP })), { lag_ratio: 0.15 }));
    const l1 = Line(LEFT.map((x: number) => x * 3), RIGHT.map((x: number) => x * 0), { color: YELLOW }).shift([0, -2, 0]);
    const l2 = l1.copy().rotate(50 * DEGREES, { about_point: l1.get_end() });
    const ang = Angle(l1, l2, { radius: 0.6, other_angle: true, color: RED });
    const arr = Arrow([1, -2.5, 0], [4, -1.5, 0], { color: GREEN });
    const darr = DoubleArrow([1, -3.2, 0], [4, -3.2, 0], { color: ORANGE });
    const carr = CurvedArrow([-6, -3, 0], [-4, -1, 0], { color: BLUE });
    const dl = DashedLine([-6.5, 0.2, 0], [6.5, 0.2, 0], { color: '#888888' });
    this.play(Create(l1), Create(l2), Create(ang), Create(arr), Create(darr), Create(carr), Create(dl), { run_time: 1.5 });
    this.play(Create(SurroundingRectangle(shapes, { buff: 0.2 })));
    this.play(Rotate(shapes.submobjects[0], PI), shapes.submobjects[1].animate.scale(0.5).set_color(TEAL));
    this.wait(0.5);
  }
}

const canvas = document.getElementById('c') as HTMLCanvasElement;
const player = new ScenePlayer(new Demo(), canvas);
const seek = document.getElementById('seek') as HTMLInputElement;
const t = document.getElementById('t')!;
(window as any).player = player;
(window as any).M = M;
player.opts.on_frame = (time) => {
  seek.value = String(Math.round((time / player.duration) * 1000));
  t.textContent = `${time.toFixed(2)} / ${player.duration.toFixed(2)}s`;
};
await player.load();
(window as any).ready = true;
document.getElementById('play')!.onclick = () => player.toggle();
seek.oninput = () => player.seek_time((+seek.value / 1000) * player.duration);
