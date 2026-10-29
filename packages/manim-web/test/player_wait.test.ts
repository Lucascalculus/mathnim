// ScenePlayer.wait_for: the picture holds where its sections begin until a voice gets there, and at its end until the
// voice is done; the timeline then runs on the voice's clock.
import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { FadeIn, Scene, Square } from '../src';
import { ScenePlayer, voice_waits } from '../src/ext/player';

class ThreeParts extends Scene {
  construct() {
    const s = Square();
    this.play(FadeIn(s), { run_time: 1 }); // section 0: 0-1 s
    this.next_section();
    this.play(s.animate.shift([1, 0, 0]), { run_time: 1 }); // section 1: 1-2 s
    this.next_section();
    this.wait(1); // section 2: 2-3 s
  }
}
const load = async () => new ScenePlayer(new ThreeParts(), createCanvas(160, 90) as any, { audio: false, tex: false }).load();

describe('ScenePlayer.wait_for', () => {
  it('holds each section until its beat, then the end until the voice ends', async () => {
    const p = await load();
    expect(p.duration).toBeCloseTo(3, 1);
    p.wait_for([2.5, 4], 6); // section 1 at 2.5 s (1.5 s of waiting), section 2 at 4 s (0.5 s more), voice ends at 6 s
    expect(p.duration).toBeCloseTo(6, 1);
    const start = (k: number) => p.seg_starts[p.scene.segments.findIndex((s) => s.t0 >= p.scene.sections[k].time - 1e-6)] * p.dt;
    expect(start(1)).toBeCloseTo(2.5, 1);
    expect(start(2)).toBeCloseTo(4, 1);
  });
  it('never makes the picture wait when it is already late, and can be dropped', async () => {
    const p = await load();
    p.wait_for([0.5, 1.5], 2); // the voice is quicker than the picture: nothing to wait for
    expect(p.duration).toBeCloseTo(3, 1);
    p.wait_for([2.5, 4], 6);
    p.wait_for();
    expect(p.duration).toBeCloseTo(3, 1);
  });
  it('keeps the picture where it is when the waits change', async () => {
    const p = await load();
    p.seek_time(1.5); // halfway through section 1
    const seg = p.scene.segments.findIndex((s) => s.t0 >= p.scene.sections[1].time - 1e-6);
    const into = p.frame - p.seg_starts[seg];
    p.wait_for([2.5, 4], 6);
    expect(p.frame - p.seg_starts[seg]).toBe(into);
    expect(p.time).toBeCloseTo(3, 1); // the same picture, now 3 s into the voice's timeline
  });
});

describe('voice_waits', () => {
  it('waits for early beats, reports late ones, and the tail past the voice', () => {
    // sections at 1 s and 2 s of a 3 s scene; beats at 2.5 s and 2.8 s; the voice stops at 3.5 s
    const w = voice_waits([1, 2], 3, [2.5, 2.8], 3.5);
    expect(w.waits).toEqual([1.5, 0]);
    expect(w.late[1]).toBeCloseTo(0.7); // section 2 arrives at 2 + 1.5 = 3.5 s, its beat was at 2.8 s
    expect(w.end_wait).toBe(0);
    expect(w.tail).toBeCloseTo(1); // the picture ends at 4.5 s, a second after the voice
  });
});
