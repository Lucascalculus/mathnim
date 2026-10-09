// "Ask" panel: type a question (or pick a suggestion) and get an explanation
// with an animated scene that becomes explorable when it ends.
//
// With a model that streams (docs/PLAN.md WP6):
//   text     the personal answer streams in (diagnosis first, then 2-4 sentences)
//   picture  in parallel, a fast "picture plan" picks a ready-made visual from
//            @mathnim/visuals and its parameters (visual_plan.ts); it is built
//            here, played, and then its handles are attached
//   fallback no visual fits / the plan failed: the free-form scene pipeline runs
//            in the background and its picture is swapped in (a minute or two)
// Offline (recorded answers, no streaming) the free-form path runs as before.
import { AffordanceLayer } from 'manim-web/ext/affordance';
import { Interaction } from 'manim-web/ext/interact';
import type { ScenePlayer } from 'manim-web/ext/player';
import type { Scene } from 'manim-web';
import { type EventLog } from '@mathnim/core';
import { Narrator, inject_styles, math_html } from '@mathnim/present';
import type { Params } from '@mathnim/visuals';
import { ask, type AskResult, type AskStatus } from '../pipeline';
import { explain, type Explanation } from '../tutor';
import type { AskContext } from '../prompt';
import type { Provider, Reasoning } from '../provider';
import { compile_answer, load_answer } from '../run';
import type { Validator } from '../sandbox';
import { apply_white } from '../theme';
import { decide, load_visual, plan_visual, visual_accent, type PictureRoute, type PlanResult } from '../visual_plan';

const CSS = `
.mn-ask{display:flex;flex-direction:column;gap:12px}
.mn-ask form{display:flex;gap:8px}
.mn-ask .mn-chips{display:flex;flex-wrap:wrap;gap:6px}
.mn-chip{font:inherit;font-size:13px;padding:6px 10px;border-radius:999px;border:1px solid var(--mn-border);background:transparent;color:inherit;cursor:pointer;text-align:left}
.mn-chip:hover{border-color:var(--mn-accent);color:var(--mn-accent)}
.mn-card{border:1px solid var(--mn-border);border-radius:var(--mn-radius);background:var(--mn-panel);overflow:hidden;box-shadow:var(--mn-shadow)}
.mn-card .mn-q{padding:10px 14px;font-size:13px;color:var(--mn-muted);border-bottom:1px solid var(--mn-border)}
.mn-card .mn-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.mn-card h3{margin:0;font-size:16px}
.mn-card canvas.mn-answer{width:100%;aspect-ratio:16/9;display:block;border-radius:10px;background:#fff;border:1px solid var(--mn-border)}
.mn-status{font-size:13px;color:var(--mn-muted)}
.mn-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-muted);margin-left:6px;vertical-align:middle}
.mn-badge.ok{background:color-mix(in srgb,var(--mn-good) 12%,transparent);color:var(--mn-good)}
.mn-badge.warn{background:color-mix(in srgb,var(--mn-warn) 14%,transparent);color:var(--mn-warn)}
.mn-card details{font-size:12px;color:var(--mn-muted)}
.mn-answer-text{font-size:15px;line-height:1.55}
.mn-answer-text:empty{display:none}
.mn-say-row{display:flex;gap:8px;align-items:center}
.mn-say-row:empty{display:none}
.mn-btn.mn-read{padding:4px 10px;font-size:12px;border-radius:999px}
.mn-btn.mn-read[aria-pressed=true]{border-color:var(--mn-accent);color:var(--mn-accent)}
.mn-picture{display:flex;flex-direction:column;gap:8px}
.mn-picture:empty{display:none}
.mn-caption-text{font-size:13px;color:var(--mn-muted)}
.mn-caption-text:empty{display:none}
.mn-quick-check{font-size:13px}
.mn-quick-check details{display:inline;margin-left:6px}
.mn-wait{position:relative;aspect-ratio:16/9;border-radius:10px;border:1px dashed var(--mn-border);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;font-size:13px;color:var(--mn-muted);
 background:linear-gradient(100deg,transparent 30%,color-mix(in srgb,var(--mn-accent) 7%,transparent) 50%,transparent 70%) 0 0/300% 100%;animation:mn-shimmer 1.6s linear infinite}
.mn-wait::after{content:attr(data-phase);font-size:12px;opacity:.8}
@keyframes mn-shimmer{from{background-position:100% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.mn-wait{animation:none}}
`;
let injected = false;

/** math_html for text that is still streaming in: an unfinished $...$ stays hidden until it closes. */
function partial_math_html(s: string): string {
  const n = (s.match(/\$/g) ?? []).length;
  return math_html(n % 2 ? s.slice(0, s.lastIndexOf('$')) : s);
}
const secs = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const FREEFORM_PHASE = 'no ready-made picture fits: drawing one for you (about a minute)';

export interface AskPanelOptions {
  provider: () => Provider;
  validate: Validator;
  context?: () => AskContext;
  suggestions?: string[];
  log?: EventLog;
  lesson?: string;
  /** Answer with a ready-made visual when one fits (default true; needs a streaming provider). */
  visuals?: boolean;
  /** Start the picture plan together with the text ('parallel', default) or once the diagnosis is known (it is then sent along). */
  plan_start?: 'parallel' | 'after_diagnosis';
  /**
   * Thinking for the text answer (default 'low'). Measured with deepseek-flash on three lesson questions:
   * first word after 2.2-4.8 s with the model's default (high), 1.5-1.8 s with 'low', 0.8-1.3 s with 'off'.
   */
  text_reasoning?: Reasoning;
  /** Thinking for the picture plan (default 'off': 1.1-1.7 s; 'high' took 2.8-3.6 s and chose the same visuals). */
  plan_reasoning?: Reasoning;
  /** A "Read aloud" button on answers (default true). */
  read_aloud?: boolean;
}

/** An answer whose picture is a ready-made visual. */
export interface VisualAnswer {
  visual: string;
  params: Params;
  plan: PlanResult;
}

/** One question's card and what is known while it is being answered. */
interface Card {
  question: string;
  t0: number;
  body: HTMLElement;
  status: HTMLElement;
  text: HTMLElement;
  say_row: HTMLElement;
  picture: HTMLElement;
  provider: Provider;
  context: AskContext;
  timing: { text_first?: number; text_done?: number; plan?: number; build?: number; picture?: number };
  /** The streamed text answer (null: offline, the scene's explanation is the answer). */
  fast: Promise<Explanation | null> | null;
  diagnosis?: string;
  got_diagnosis: Promise<void>;
  /** What "Read aloud" reads: the answer, then the picture's caption. */
  spoken: { text: string; caption: string };
}

export class AskPanel {
  root: HTMLElement;
  private list: HTMLElement;
  private input: HTMLInputElement;
  private players: ScenePlayer[] = [];
  /** This session's questions with the start of each answer (sent as context with the next question). */
  private history: { q: string; a: string }[] = [];
  private narrator: Narrator | null = null;
  private narrator_caption: HTMLElement;
  private reading: HTMLButtonElement | null = null;
  constructor(root: HTMLElement, private o: AskPanelOptions) {
    inject_styles();
    if (!injected) {
      injected = true;
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.root = root;
    const wrap = document.createElement('div');
    wrap.className = 'mn-ask';
    const form = document.createElement('form');
    this.input = document.createElement('input');
    this.input.className = 'mn-input';
    this.input.placeholder = 'Ask about this…';
    this.input.setAttribute('aria-label', 'Your question');
    const go = document.createElement('button');
    go.className = 'mn-btn primary';
    go.textContent = 'Ask';
    form.append(this.input, go);
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = this.input.value.trim();
      if (q) void this.ask(q);
      this.input.value = '';
    };
    const chips = document.createElement('div');
    chips.className = 'mn-chips';
    for (const s of o.suggestions ?? []) chips.append(this.chip(s));
    this.list = document.createElement('div');
    this.list.style.display = 'flex';
    this.list.style.flexDirection = 'column';
    this.list.style.gap = '12px';
    // the narrator's caption line stays hidden: the answer is on screen already
    this.narrator_caption = document.createElement('div');
    this.narrator_caption.hidden = true;
    wrap.append(form, chips, this.list, this.narrator_caption);
    root.append(wrap);
  }
  private chip(text: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-chip';
    b.textContent = text;
    b.onclick = () => void this.ask(text);
    return b;
  }

  // ---------------------------------------------------------------- read aloud
  private read_button(c: Card): void {
    if (this.o.read_aloud === false || c.say_row.childElementCount) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-btn mn-read';
    b.textContent = 'Read aloud';
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      if (this.reading === b) return this.stop_reading();
      this.stop_reading();
      const n = (this.narrator ??= new Narrator(this.narrator_caption));
      n.enabled = true; // the learner asked to hear this answer, whatever the lesson narration setting
      this.reading = b;
      b.textContent = 'Stop';
      b.setAttribute('aria-pressed', 'true');
      void n.say([c.spoken.text, c.spoken.caption].filter(Boolean).join('\n\n')).finally(() => {
        if (this.reading === b) this.stop_reading(false);
      });
    };
    c.say_row.append(b);
  }
  private stop_reading(stop_audio = true): void {
    if (stop_audio) this.narrator?.stop();
    const b = this.reading;
    this.reading = null;
    if (b) {
      b.textContent = 'Read aloud';
      b.setAttribute('aria-pressed', 'false');
    }
  }

  // ---------------------------------------------------------------- asking
  async ask(question: string): Promise<AskResult | VisualAnswer | null> {
    for (const p of this.players) p.pause();
    this.stop_reading();
    const card = document.createElement('div');
    card.className = 'mn-card';
    card.innerHTML = `<div class="mn-q">${math_html(question)}</div>`;
    const body = document.createElement('div');
    body.className = 'mn-body';
    const status = document.createElement('div');
    status.className = 'mn-status';
    status.setAttribute('aria-live', 'polite');
    const text = document.createElement('div');
    text.className = 'mn-answer-text';
    const say_row = document.createElement('div');
    say_row.className = 'mn-say-row';
    const picture = document.createElement('div');
    picture.className = 'mn-picture';
    body.append(status, text, say_row, picture);
    card.append(body);
    this.list.prepend(card);
    this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'ask', data: { question } });
    const provider = this.o.provider();
    let diagnosed: () => void = () => {};
    const c: Card = {
      question, t0: performance.now(), body, status, text, say_row, picture, provider,
      context: { ...this.o.context?.(), recent: this.history.slice(-3) },
      timing: {}, fast: null, got_diagnosis: new Promise<void>((res) => (diagnosed = res)), spoken: { text: '', caption: '' },
    };

    // 1. the personal text answer, streamed (only for models that can stream; offline answers come whole)
    status.textContent = 'Thinking…';
    c.fast = provider.stream
      ? explain(question, {
          provider, context: c.context, reasoning: this.o.text_reasoning ?? 'low',
          on_diagnosis: (d) => {
            c.diagnosis = d;
            diagnosed();
          },
          on_text: (a) => {
            status.textContent = '';
            text.innerHTML = partial_math_html(a);
          },
        }).then(
          (x) => {
            c.timing.text_first = x.ms_first;
            c.timing.text_done = x.ms_done;
            text.innerHTML = math_html(x.text);
            c.spoken.text = x.text;
            this.read_button(c);
            this.history.push({ q: question, a: x.text.slice(0, 240) });
            return x;
          },
          (e) => {
            text.innerHTML = '';
            status.textContent = '';
            console.warn('text answer failed', e);
            return null;
          },
        ).finally(() => diagnosed())
      : null;

    // 2. the picture
    if (!c.fast || this.o.visuals === false) return this.freeform(c, null);
    return this.visual_first(c);
  }

  /** A placeholder that counts the seconds until the picture is there. */
  private placeholder(c: Card): HTMLElement {
    const wait = document.createElement('div');
    wait.className = 'mn-wait';
    const tick = () => (wait.textContent = `Drawing a picture for you… ${Math.round((performance.now() - c.t0) / 1000)} s`);
    tick();
    const timer = setInterval(() => (wait.isConnected ? tick() : clearInterval(timer)), 500);
    c.picture.append(wait);
    return wait;
  }

  /** The fast path: a ready-made visual chosen by the picture plan; the free-form scene when none fits. */
  private async visual_first(c: Card): Promise<AskResult | VisualAnswer | null> {
    const wait = this.placeholder(c);
    wait.dataset.phase = 'choosing a ready-made picture';
    if (this.o.plan_start === 'after_diagnosis') await Promise.race([c.got_diagnosis, new Promise((r) => setTimeout(r, 4000))]);
    let plan: PlanResult | null = null;
    let route: PictureRoute;
    try {
      plan = await plan_visual(c.question, { provider: c.provider, context: c.context, diagnosis: c.diagnosis, reasoning: this.o.plan_reasoning });
      route = decide(plan);
    } catch (e) {
      console.warn('picture plan failed', e);
      route = decide(null, e);
    }
    c.timing.plan = performance.now() - c.t0;
    if (route.kind === 'visual') {
      wait.dataset.phase = 'building it';
      if (await this.show_visual(c, route, plan!, wait)) return { visual: route.visual.name, params: route.params, plan: plan! };
      route = { kind: 'freeform', reason: 'invalid', detail: `${route.visual.name} could not be built` };
    }
    wait.remove();
    return this.freeform(c, { route, plan });
  }

  private async show_visual(c: Card, route: Extract<PictureRoute, { kind: 'visual' }>, plan: PlanResult, wait: HTMLElement): Promise<boolean> {
    const canvas = document.createElement('canvas');
    canvas.className = 'mn-answer';
    canvas.width = 1280;
    canvas.height = 720;
    const tb = performance.now();
    let player: ScenePlayer;
    try {
      player = await load_visual(route.visual, route.params, canvas);
    } catch (e) {
      console.warn(`visual ${route.visual.name} could not be built`, e);
      return false;
    }
    c.timing.build = performance.now() - tb;
    const p = plan.plan!;
    wait.remove();
    c.status.remove();
    const stage = document.createElement('div');
    stage.style.position = 'relative';
    stage.append(canvas);
    const caption = document.createElement('div');
    caption.className = 'mn-caption-text';
    const caption_md = p.caption || 'Watch it play, then drag the glowing handles to explore.';
    caption.innerHTML = math_html(caption_md);
    c.spoken.caption = p.caption;
    const controls = document.createElement('div');
    controls.className = 'mn-actions';
    c.picture.append(stage, caption);
    if (p.check) {
      const q = document.createElement('div');
      q.className = 'mn-quick-check';
      q.innerHTML = `<b>Quick check:</b> ${math_html(p.check.question)}` + (p.check.answer ? `<details><summary>answer</summary>${math_html(p.check.answer)}</details>` : '');
      c.picture.append(q);
    }
    c.picture.append(controls);
    const v = route.visual;
    this.attach_controls(player, controls, v.explore ? (scene, ui) => {
      player.show_end();
      v.explore!(scene, ui, route.params);
    } : null, visual_accent());
    this.players.push(player);
    player.play();
    c.timing.picture = performance.now() - c.t0;

    const params = Object.entries(route.params).map(([k, x]) => `${k} = ${esc(JSON.stringify(x))}`).join(', ');
    const d = this.details(c, [
      `${c.provider.name}: ${this.text_timing(c)}picture in ${secs(c.timing.picture)}`,
      `Ready-made visual <b>${esc(v.name)}</b>: chosen in ${plan.calls.map((x) => secs(x.ms)).join(' + ')}${plan.repaired ? ' (one repair)' : ''}, built in ${secs(c.timing.build)}`,
      params ? `Parameters: ${params}` : '',
      plan.notes.length ? `Adjusted: ${esc(plan.notes.join('; '))}` : '',
      plan.errors.length ? `Not used: ${esc(plan.errors.join('; '))}` : '',
    ]);
    this.followups(c, p.followups);
    void c.fast!.then((x) => {
      if (x) {
        // the text finished after the picture: complete the timings
        d.querySelector('div')!.innerHTML = `${c.provider.name}: ${this.text_timing(c)}picture in ${secs(c.timing.picture)}`;
        if (c.diagnosis) d.insertAdjacentHTML('beforeend', `<div>Read as: ${math_html(c.diagnosis)}</div>`);
      } else {
        // no text answer: the caption has to do
        c.text.innerHTML = math_html(caption_md);
        caption.innerHTML = '';
        c.spoken = { text: caption_md, caption: '' };
        this.read_button(c);
        this.history.push({ q: c.question, a: caption_md.slice(0, 240) });
      }
      this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: c.provider.name, picture: 'visual', visual: v.name, repaired: plan.repaired, ...c.timing, diagnosis: c.diagnosis } });
    });
    return true;
  }

  private text_timing(c: Card): string {
    return c.timing.text_done !== undefined ? `text in ${secs(c.timing.text_first)} (done ${secs(c.timing.text_done)}), ` : '';
  }
  private details(c: Card, lines: string[]): HTMLDetailsElement {
    const d = document.createElement('details');
    d.innerHTML = `<summary>How this answer was made</summary>${lines.filter(Boolean).map((l) => `<div>${l}</div>`).join('')}`;
    c.body.append(d);
    return d;
  }
  private followups(c: Card, qs: string[] = []): void {
    const chips = document.createElement('div');
    chips.className = 'mn-chips';
    for (const f of qs) chips.append(this.chip(f));
    c.body.append(chips);
  }
  /** Replay, and the scene's handles once it has played. */
  private attach_controls(player: ScenePlayer, controls: HTMLElement, setup: ((scene: Scene, ui: Interaction) => void) | null, color: string): void {
    let ui: Interaction | null = null;
    let aff: AffordanceLayer | null = null;
    const hint = document.createElement('span');
    hint.className = 'mn-help';
    const explorable = () => {
      if (!setup || ui) return;
      ui = new Interaction(player);
      setup(player.scene, ui);
      player.start_live();
      aff = new AffordanceLayer(ui, { color });
      setTimeout(() => aff?.coach(), 400);
      hint.innerHTML = '<b style="color:var(--mn-accent)">Your turn:</b> drag the glowing handle to explore.';
    };
    player.opts.on_end = explorable;
    const replay = document.createElement('button');
    replay.className = 'mn-btn';
    replay.textContent = 'Replay';
    replay.onclick = () => {
      ui?.dispose();
      ui = null;
      aff?.dispose();
      aff = null;
      player.stop_live();
      player.seek_frame(0);
      player.play();
    };
    controls.append(replay, hint);
  }

  /**
   * The free-form scene (generated code, sandboxed and checked): the only
   * picture offline, and the background fallback when no ready-made visual fits.
   */
  private async freeform(c: Card, after: { route: PictureRoute; plan: PlanResult | null } | null): Promise<AskResult | null> {
    const { status, text, picture, fast } = c;
    // the scene starts once the diagnosis is known (a second or two), so it shows the same idea
    if (fast) await Promise.race([c.got_diagnosis, new Promise((r) => setTimeout(r, 4000))]);
    let wait: HTMLElement | null = null;
    if (fast) {
      wait = this.placeholder(c);
      if (after) wait.dataset.phase = FREEFORM_PHASE;
    }
    const say = (st: AskStatus) => {
      if (wait) wait.dataset.phase = { thinking: after ? FREEFORM_PHASE : '', validating: `checking it (attempt ${st.attempt})`, repairing: `fixing a problem (attempt ${st.attempt})`, done: '' }[st.phase];
      else status.textContent = { thinking: 'Thinking…', validating: `Checking the scene (attempt ${st.attempt})…`, repairing: `Fixing a problem (attempt ${st.attempt})…`, done: '' }[st.phase];
    };
    let r: AskResult;
    try {
      r = await ask(c.question, { provider: c.provider, validate: this.o.validate, context: c.context, extra: fast ? { diagnosis: c.diagnosis, text_shown: true } : {}, on_status: say });
    } catch (e) {
      wait?.remove();
      const msg = (e as Error).message;
      if (fast && (await fast)) picture.innerHTML = `<div class="mn-status">No picture this time (${esc(msg.slice(0, 120))}).</div>`;
      else status.textContent = msg;
      return null;
    }
    c.timing.picture = performance.now() - c.t0;
    const spoken = fast ? await fast : null;
    wait?.remove();
    status.remove();
    if (!spoken) {
      // no fast answer (offline, or it failed): the scene's explanation is the answer
      text.innerHTML = math_html(r.explanation);
      c.spoken.text = r.explanation;
      this.read_button(c);
      this.history.push({ q: c.question, a: r.explanation.slice(0, 240) });
    }
    const h = document.createElement('h3');
    const badge = r.verified ? '<span class="mn-badge ok">checked</span>' : '<span class="mn-badge warn">unverified</span>';
    h.innerHTML = `${math_html(r.title)} ${badge}`;
    const canvas = document.createElement('canvas');
    canvas.className = 'mn-answer';
    canvas.width = 1280;
    canvas.height = 720;
    const controls = document.createElement('div');
    controls.className = 'mn-actions';
    const stage = document.createElement('div');
    stage.style.position = 'relative';
    stage.append(canvas);
    const caption = document.createElement('div');
    caption.className = 'mn-caption-text';
    if (spoken) {
      caption.innerHTML = math_html(r.explanation);
      c.spoken.caption = r.explanation;
    }
    picture.append(h, stage, caption, controls);
    const fallback = after?.route.kind === 'freeform' ? after.route : null;
    const why = fallback && { no_visual: 'no ready-made visual fits this question', invalid: 'the picture plan could not be used', failed: 'the picture plan failed' }[fallback.reason];
    this.details(c, [
      `${r.provider}: ${spoken ? this.text_timing(c) : ''}picture in ${secs(c.timing.picture)}, ${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`,
      why ? `Drawn from scratch: ${why}${fallback?.detail ? ` (${esc(fallback.detail.slice(0, 160))})` : ''}${after?.plan ? `; plan in ${after.plan.calls.map((x) => secs(x.ms)).join(' + ')}` : ''}` : '',
      c.diagnosis ? `Read as: ${math_html(c.diagnosis)}` : '',
      ...(r.check_results.length ? [`${r.check_results.filter((x) => x.ok).length}/${r.check_results.length} numbers re-computed`, ...r.check_results.map((x) => `${x.ok ? '✓' : '✗'} ${x.label}: ${x.value}${x.ok ? '' : ` (computed ${x.got})`}`)] : []),
    ]);
    this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: r.provider, verified: r.verified, attempts: r.attempts, ...c.timing, diagnosis: c.diagnosis, ...(after ? { picture: 'freeform', fallback: fallback?.reason } : {}) } });
    this.followups(c, r.followups);
    try {
      const mod = compile_answer(r.code);
      const player = await load_answer(mod, canvas, apply_white);
      this.players.push(player);
      this.attach_controls(player, controls, mod.setup, '#2563EB');
      player.play();
    } catch (e) {
      caption.insertAdjacentHTML('afterend', `<div class="mn-feedback bad" style="display:block">The scene could not be shown: ${esc((e as Error).message)}</div>`);
    }
    return r;
  }
}
