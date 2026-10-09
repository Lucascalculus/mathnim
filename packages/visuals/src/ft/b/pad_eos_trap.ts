// "Why won't it stop?": a padded batch of two answers (Llama 3.1 special
// tokens), its labels as the collator builds them, and the consequence.
// Three real settings: the pad token (the end-of-turn token <|eot_id|> itself,
// or a dedicated pad token), how labels are masked (where input_id == pad_id,
// as DataCollatorForLanguageModeling does, or where attention_mask == 0), and
// the token generation stops at. With pad = EOS and masking by id, the real
// <|eot_id|> gets label -100 too: the model is never asked to produce it.
// The label construction and the count are exact; the generation strip is an
// illustration of the typical outcome (labelled as such). After the
// explanation the strip follows the settings live.
import { Create, FadeIn, Indicate, LaggedStart, Scene, Text, VGroup, VMobject, ValueTracker, linear } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, label } from '../f/kit';
import { LANG_SPEC, choice, idx, pick, resolve_lang, type Lang } from './kit';

export interface PadEosTrapParams extends Record<string, unknown> {
  pad_is_eos: boolean;
  mask_rule: string;
  stop_token: string;
  lang: string;
}

/** Llama 3.1 token ids (tokenizer.json). */
export const EOT = { text: '<|eot_id|>', id: 128009 };
export const END_OF_TEXT = { text: '<|end_of_text|>', id: 128001 };
export const PAD = { text: '<|finetune_right_pad_id|>', short: '<pad>', id: 128004 };

/** The two answers of the batch (word tokens), each followed by <|eot_id|>; the batch is padded to 6. */
export const BATCH = [['Paris', '.'], ['It', "'s", 'in', 'France', '.']];
const LEN = 6;

export interface Cell { text: string; id: number | null; kind: 'word' | 'eos' | 'pad'; attn: 0 | 1; label: number | null /* null = -100 */ }
/** input_ids and labels of the batch for a configuration (exact collator rules). */
export function collate(pad_is_eos: boolean, mask_by_id: boolean): Cell[][] {
  const pad_id = pad_is_eos ? EOT.id : PAD.id;
  return BATCH.map((words) => {
    const row: Cell[] = words.map((w) => ({ text: w, id: null, kind: 'word', attn: 1, label: 1 }));
    row.push({ text: EOT.text, id: EOT.id, kind: 'eos', attn: 1, label: EOT.id });
    while (row.length < LEN) row.push({ text: pad_is_eos ? EOT.text : PAD.short, id: pad_id, kind: 'pad', attn: 0, label: pad_id });
    for (const cell of row) {
      const masked = mask_by_id ? cell.id !== null && cell.id === pad_id : cell.attn === 0;
      if (masked) cell.label = null;
    }
    return row;
  });
}
/** How many times <|eot_id|> is a training target in the batch. */
export const eos_targets = (b: Cell[][]) => b.flat().filter((x) => x.label === EOT.id).length;
/** 0 = stops at the end of the answer, 1 = never learned to stop, 2 = emits <|eot_id|> but the generator waits for another token. */
export function outcome(pad_is_eos: boolean, mask_by_id: boolean, stop_is_eot: boolean): 0 | 1 | 2 {
  if (eos_targets(collate(pad_is_eos, mask_by_id)) === 0) return 1;
  return stop_is_eot ? 0 : 2;
}
/** The illustrated generations for each outcome (prompt: "Where is the Eiffel Tower?"). */
export const GENERATIONS: string[][] = [
  ['Paris', ',', 'France', '.', EOT.text],
  ['Paris', ',', 'France', '.', 'It', 'was', 'built', 'in', '...'],
  ['Paris', ',', 'France', '.', EOT.text, '<|start_header_id|>', 'user', '...'],
];

const mono = (s: string, size: number, color: string): VMobject => Text(s, { font_size: size, color, font: 'monospace' }) as unknown as VMobject;

export const pad_eos_trap = define_visual<PadEosTrapParams>({
  name: 'pad_eos_trap',
  summary: "Why a fine-tuned model doesn't stop: a padded batch (Llama 3.1 tokens) with its labels as the collator builds them. Switches: pad token (= <|eot_id|> or a dedicated pad), label masking (input_id == pad_id, or attention_mask == 0), stop token. With pad = EOS and masking by id the real <|eot_id|> is labelled -100, so it is never a training target; a strip illustrates the generation.",
  topics: ['fine-tuning', 'sft', 'eos', 'padding', 'loss mask', 'chat template', 'data collator'],
  params: {
    pad_is_eos: { type: 'boolean', default: true, doc: 'true: tokenizer.pad_token = eos_token (<|eot_id|>), a common shortcut; false: a dedicated pad token (<|finetune_right_pad_id|>)' },
    mask_rule: { type: 'enum', values: ['by_id', 'by_attention'], default: 'by_id', doc: "'by_id': labels[input_ids == pad_id] = -100 (DataCollatorForLanguageModeling); 'by_attention': mask where attention_mask == 0" },
    stop_token: { type: 'enum', values: ['eot', 'end_of_text'], default: 'eot', doc: "the token generation stops at: 'eot' (<|eot_id|>, the end of turn the model was trained on) or 'end_of_text' (<|end_of_text|>, a mismatch)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { pad_is_eos: false, lang: 'zh' }, { mask_rule: 'by_attention' }, { pad_is_eos: false, stop_token: 'end_of_text', lang: 'zh' }, { lang: 'zh' }],
  ids: ['switches', 'batch', 'eos_count', 'generation', 'verdict', 'illustration_note'],
  scene: (p) => new PadEosTrapScene(p, resolve_lang(p.lang)),
  explore: (scene: any, ui) => {
    scene.attach(ui);
  },
});

export class PadEosTrapScene extends Scene {
  p: PadEosTrapParams;
  lang: Lang;
  /** 0 = pad is <|eot_id|>, 1 = dedicated pad token. */
  pad = ValueTracker(0);
  /** 0 = mask where input_id == pad_id, 1 = mask where attention_mask == 0. */
  rule = ValueTracker(0);
  /** 0 = stop at <|eot_id|>, 1 = stop at <|end_of_text|>. */
  stop = ValueTracker(0);
  /** Generated tokens shown (0 .. 9) and which outcome is shown (set by generate()). */
  gen = ValueTracker(0);
  gen_case = ValueTracker(0);
  switches: any[] = [];
  constructor(p: PadEosTrapParams, lang: Lang) {
    super();
    this.p = p;
    this.lang = lang;
  }
  config() {
    return { pad_is_eos: idx(this.pad, 2) === 0, mask_by_id: idx(this.rule, 2) === 0, stop_is_eot: idx(this.stop, 2) === 0 };
  }
  batch(): Cell[][] {
    const k = this.config();
    return collate(k.pad_is_eos, k.mask_by_id);
  }
  eos_count(): number {
    return eos_targets(this.batch());
  }
  outcome(): 0 | 1 | 2 {
    const k = this.config();
    return outcome(k.pad_is_eos, k.mask_by_id, k.stop_is_eot);
  }
  /** 1 once the explanation has played: the generation strip then follows the settings live. */
  live = ValueTracker(0);
  attach(ui: any): void {
    for (const s of this.switches) s.attach(ui);
  }

  override construct() {
    const c = palette();
    const lang = this.lang;
    this.track(this.pad, this.rule, this.stop, this.gen, this.gen_case, this.live);
    this.pad.name = 'pad_token';
    this.rule.name = 'mask_rule';
    this.stop.name = 'stop_token';

    // ---- the three settings
    const sw = (t: ValueTracker, x: number, title: string, opts: string[]) => {
      const ch = choice(t, opts, { x, y: 3.22, width: 4.3, size: 22, title, gap: 0.46 });
      this.switches.push(ch);
      return ch.group;
    };
    const s1 = sw(this.pad, -6.6, pick(lang, 'pad token', 'pad token 设为'), [pick(lang, '= EOS  <|eot_id|>', '= EOS  <|eot_id|>'), pick(lang, 'a dedicated <pad>', '专用的 <pad>')]);
    const s2 = sw(this.rule, -2.0, pick(lang, 'labels set to −100 where', 'label 设为 −100 的位置'), ['input_id == pad_id', 'attention_mask == 0']);
    const s3 = sw(this.stop, 2.6, pick(lang, 'generation stops at', '生成时的停止符'), ['<|eot_id|>', '<|end_of_text|>']);
    const switches = VGroup(s1, s2, s3);
    switches.name = 'switches';

    // ---- the batch: input_ids and labels, live
    const X0 = -4.35, CW = 1.84, ROWS = [{ y: 1.72 }, { y: 0.3 }];
    const heads = VGroup(...ROWS.flatMap((r) => [
      fit(label('input_ids', 20, c.muted), 1.3, 0.3).move_to([-6.2, r.y, 0]),
      fit(label('labels', 20, c.muted), 1.3, 0.3).move_to([-6.2, r.y - 0.6, 0]),
    ]));
    const chip = (text: string, x: number, y: number, kind: 'word' | 'eos' | 'pad' | 'masked', w = CW - 0.12) => {
      const col = kind === 'eos' ? c.gold : kind === 'pad' ? c.muted : kind === 'masked' ? c.muted : c.accent;
      const b = box(x, y, w, 0.46, { stroke: col, width: kind === 'eos' ? 3 : 2, fill: col, fill_opacity: kind === 'masked' ? 0.04 : 0.1, radius: 0.08 });
      const t = fit(mono(text, 18, kind === 'masked' ? c.muted : c.ink), w - 0.12, 0.34).move_to([x, y, 0]);
      return VGroup(b, t);
    };
    /** Punctuation tokens are shown in quotes so they stay visible. */
    const shown = (t: string) => (/^[.,!?]+$/.test(t) ? `"${t}"` : t);
    const batch = VGroup();
    const draw_batch = () => {
      const b = this.batch();
      const k = this.config();
      const key = `${k.pad_is_eos}${k.mask_by_id}`;
      if ((batch as any)._key === key) return;
      (batch as any)._key = key;
      const ms: VMobject[] = [];
      b.forEach((row, r) => row.forEach((cell, j) => {
        const x = X0 + j * CW, y = ROWS[r].y;
        ms.push(chip(shown(cell.kind === 'pad' && !k.pad_is_eos ? PAD.short : cell.text), x, y, cell.kind) as any);
        const id = cell.id !== null ? String(cell.id) : cell.text;
        ms.push(chip(cell.label === null ? '−100' : shown(id), x, y - 0.6, cell.label === null ? 'masked' : cell.kind) as any);
      }));
      batch.submobjects = ms;
    };
    draw_batch();
    batch.add_updater(draw_batch);
    batch.name = 'batch';

    // ---- the count of <|eot_id|> training targets
    const count_lab = fit(label(pick(lang, '<|eot_id|> (id 128009) as a training target in this batch:', '本 batch 里 <|eot_id|>（id 128009）作为训练目标的次数：'), 22, c.ink), 10.4, 0.4);
    count_lab.move_to([-6.85 + count_lab.width / 2, -0.95, 0]);
    const nums = [0, 1, 2].map((v) => (Text(`${v}`, { font_size: 34, color: v === 0 ? c.coral : c.good, font: 'sans' }) as unknown as VMobject));
    const cx = -6.85 + count_lab.width + 0.35;
    nums.forEach((m) => m.move_to([cx + m.width / 2, -0.95, 0]));
    const count_g = VGroup(...nums);
    const upd_count = () => {
      const k = this.eos_count();
      if ((count_g as any)._k === k) return;
      (count_g as any)._k = k;
      nums.forEach((m, i) => m.set_opacity(i === k ? 1 : 0));
    };
    upd_count();
    count_g.add_updater(upd_count);
    const eos_count = VGroup(count_lab, count_g);
    eos_count.name = 'eos_count';

    // ---- the generation (illustration)
    const gtitle = fit(label(pick(lang, 'generation for "Where is the Eiffel Tower?" (illustration)', '生成"埃菲尔铁塔在哪？"的回答（示意）'), 22, c.muted), 9.5, 0.4);
    gtitle.move_to([-6.85 + gtitle.width / 2, -1.68, 0]);
    gtitle.name = 'illustration_note';
    const GX0 = -6.85, GY = -2.35;
    const strips = GENERATIONS.map((toks, kase) => {
      let x = GX0;
      return toks.map((s) => {
        const special = s.startsWith('<|');
        const t = mono(/^[.,]$/.test(s) ? `"${s}"` : s, 18, c.ink);
        const w = Math.max(0.55, t.width + 0.22);
        const kind = s === EOT.text ? 'eos' : special ? 'pad' : 'word';
        const col = kind === 'eos' ? c.gold : kind === 'pad' ? c.coral : c.teal;
        const b = box(x + w / 2, GY, w, 0.46, { stroke: col, width: 2, fill: col, fill_opacity: 0.1, radius: 0.08 });
        t.move_to([x + w / 2, GY, 0]);
        x += w + 0.1;
        const g = VGroup(b, t);
        (g as any)._case = kase;
        return g;
      });
    });
    const generation = VGroup(...strips.flat());
    const upd_gen = () => {
      if (this.live.get_value() > 0.5) {
        const k = this.outcome(), full = GENERATIONS[k].length + 0.999;
        if (Math.round(this.gen_case.get_value()) !== k) this.gen_case.set_value(k);
        if (this.gen.get_value() < full) this.gen.set_value(full);
      }
      const kase = Math.round(this.gen_case.get_value()), n = this.gen.get_value();
      const key = `${kase}:${Math.floor(n)}`;
      if ((generation as any)._key === key) return;
      (generation as any)._key = key;
      strips.forEach((row, k) => row.forEach((m, i) => m.set_opacity(k === kase && i < Math.floor(n) ? 1 : 0)));
    };
    upd_gen();
    generation.add_updater(upd_gen);
    generation.name = 'generation';
    const verdicts = [
      pick(lang, 'stops: it learned to end the turn with <|eot_id|>, and the generator stops there', '停下了：模型学会了用 <|eot_id|> 结束，生成器也在这里停'),
      pick(lang, "never stops: <|eot_id|> was never a training target, so the model rarely emits it", '停不下来：<|eot_id|> 从没当过训练目标，模型几乎不会输出它'),
      pick(lang, 'emits <|eot_id|>, but the generator waits for <|end_of_text|> and keeps going', '模型输出了 <|eot_id|>，但生成器在等 <|end_of_text|>，于是继续写'),
    ].map((s, k) => fit(label(s, 22, k === 0 ? c.good : c.coral), 13.7, 0.42).move_to([0, -3.15, 0]));
    const verdict = VGroup(...verdicts);
    const upd_verdict = () => {
      const kase = Math.round(this.gen_case.get_value()), done = this.gen.get_value() >= GENERATIONS[kase].length;
      const key = done ? kase : -1;
      if ((verdict as any)._key === key) return;
      (verdict as any)._key = key;
      verdicts.forEach((m, k) => m.set_opacity(k === key ? 1 : 0));
    };
    upd_verdict();
    verdict.add_updater(upd_verdict);
    verdict.name = 'verdict';
    const note = fit(label(pick(lang, 'labels and the count are exact (the collator rules); the generation is an illustration', 'labels 和计数是精确的（collator 的规则）；生成结果是示意'), 18, c.muted), 13.7, 0.32);
    note.move_to([0, -3.7, 0]);

    // ---- story
    this.pad.set_value(0);
    this.rule.set_value(0);
    this.stop.set_value(0);
    this.play(FadeIn(switches), { run_time: 1 });
    this.add(heads);
    this.play(FadeIn(heads), FadeIn(batch), { run_time: 1.2 });
    this.play(FadeIn(eos_count), { run_time: 0.8 });
    this.play(Indicate(count_g, { color: c.coral, scale_factor: 1.4 }), { run_time: 0.8 });
    this.play(FadeIn(gtitle), FadeIn(note), { run_time: 0.6 });
    this.add(generation, verdict);
    this.gen_case.set_value(1);
    this.play(this.gen.animate.set_value(GENERATIONS[1].length + 0.999), { run_time: 2.6, rate_func: linear });
    this.wait(1);
    // a dedicated pad token: the real <|eot_id|> keeps its label
    this.play(this.pad.animate.set_value(1), { run_time: 1 });
    this.play(Indicate(count_g, { color: c.good, scale_factor: 1.4 }), { run_time: 0.8 });
    this.gen.set_value(0);
    this.gen_case.set_value(0);
    this.play(this.gen.animate.set_value(GENERATIONS[0].length + 0.999), { run_time: 1.6, rate_func: linear });
    this.wait(1);
    // end in the requested settings, generation cleared
    this.play(
      this.pad.animate.set_value(this.p.pad_is_eos ? 0 : 1),
      this.rule.animate.set_value(this.p.mask_rule === 'by_attention' ? 1 : 0),
      this.stop.animate.set_value(this.p.stop_token === 'end_of_text' ? 1 : 0),
      { run_time: 1 },
    );
    this.gen_case.set_value(this.outcome());
    this.gen.set_value(GENERATIONS[this.outcome()].length + 0.999);
    this.live.set_value(1);
    this.add(switches, heads, batch, eos_count, gtitle, note, generation, verdict);
    this.wait(0.8);
    void LaggedStart;
    void Create;
  }
}
