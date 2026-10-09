// Interaction toolkit demo page (WP1): every primitive in a small scene.
// Served by `npm run -w manim-web dev` at /interact.html.
import * as M from '../src/index';
import { AffordanceLayer } from '../src/ext/affordance';
import { Interaction } from '../src/ext/interact';
import { Juice, set_muted, set_reduced_motion } from '../src/ext/juice';
import { ScenePlayer } from '../src/ext/player';
import { DEMOS, type Demo } from './interact.demos';

const main = document.getElementById('demos')!;
const mute = document.getElementById('mute') as HTMLInputElement;
const reduce = document.getElementById('reduce') as HTMLInputElement;
mute.onchange = () => set_muted(mute.checked);
reduce.onchange = () => set_reduced_motion(reduce.checked ? true : null);

async function mount(demo: Demo): Promise<void> {
  const fig = document.createElement('figure');
  fig.id = demo.id;
  fig.innerHTML = `<h2>${demo.title}</h2><div class="stage"><canvas width="1280" height="720" aria-describedby="${demo.id}-cap"></canvas></div>
    <figcaption id="${demo.id}-cap">${demo.caption}</figcaption><div class="bar"></div><output class="log" aria-live="polite"></output>`;
  main.append(fig);
  const canvas = fig.querySelector('canvas')!;
  const out = fig.querySelector('.log')!;
  const log = (text: string) => (out.textContent = text);
  class DemoScene extends M.Scene {
    override construct() {
      demo.build(this);
      this.wait(0.1);
    }
  }
  const player = new ScenePlayer(new DemoScene(), canvas, { live: true });
  await player.load();
  player.show_end();
  const ui = new Interaction(player);
  const juice = new Juice(ui);
  const controls = demo.setup(player.scene, { ui, juice, log }) || {};
  player.start_live();
  const aff = new AffordanceLayer(ui, { color: '#60A5FA' });
  const bar = fig.querySelector('.bar')!;
  for (const [label, act] of Object.entries(controls.buttons ?? {})) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      act();
      ui.notify();
    };
    bar.append(b);
  }
  // show the gesture once, when the learner first points at the figure
  let coached = false;
  fig.addEventListener('pointerenter', () => {
    if (coached) return;
    coached = true;
    setTimeout(() => aff.coach(), 300);
  });
  (window as any).demos ??= {};
  (window as any).demos[demo.id] = { player, ui, juice, aff };
}

for (const d of DEMOS) await mount(d);
(window as any).ready = true;
