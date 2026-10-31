# Capabilities

What the Mathnim libraries offer a lesson author. **Generated from the code** by `apps/mathnim/tools/catalog.ts`:
run `npm run catalog` after adding a step field, a visual or a module (and `npm run catalog -- --check` to see whether it is current).
Read it to know what exists; read the source (paths given) for details, and `docs/COURSE-PLAYBOOK.md` / `docs/TASTE.md` for when to use what.

## Step kinds

A lesson (`Lesson` in `packages/core/src/schema.ts`) is a list of steps. Fields every step has (`StepBase`):

| field | type | what it is |
|---|---|---|
| `id` | `string` |  |
| `chapter?` | `L10n` | Chapter title shown in the timeline; steps inherit the previous chapter. |
| `title?` | `L10n` |  |
| `narration?` | `L10n` | Spoken/caption text for the step (templated with {vars}). Each language is recorded separately. Only scenes ("videos") and worlds are voiced; text pages and questions are read, never spoken. |
| `next?` | `string` | Step to go to afterwards (default: the next one in the list). |
| `branch_only?` | `boolean` | Only reached by branching (remediation, reveal); skipped when advancing in order. |

### `read` (ReadStep)

A text page: prose, formulas, figures, small embedded visuals, callouts, tables, sources. Read silently (no narration).

| field | type | what it is |
|---|---|---|
| `blocks` | `Block[]` |  |

### `derive` (DeriveStep)

A derivation revealed line by line, each line with an optional "why"; may hold one blank the learner fills in.

| field | type | what it is |
|---|---|---|
| `skill?` | `string` | Skill credited (first attempt) by the fill-in line. |
| `intro?` | `L10n` |  |
| `lines` | `{ tex: string; why?: L10n }[]` |  |
| `blank?` | `{ line: number; answer: string; variables?: string[]; prompt?: L10n; /** Sampling ranges f` | Hide line `line` (0-based index into `lines`) and ask for it (graded with the expression grader). |
| `outro?` | `L10n` |  |

### `code` (CodeStep)

A code walkthrough: the code with notes on line ranges (and shapes); copy button.

| field | type | what it is |
|---|---|---|
| `lang` | `string` |  |
| `code` | `string` |  |
| `intro?` | `L10n` |  |
| `notes` | `{ lines: [number, number]; text: L10n; /** tensor shapes, e.g. "logits: [B, T, V]" */ shap` | `lines` are 1-based and inclusive. |

### `scene` (SceneStep)

A "video": an animated scene with narration (the only steps that are narrated).

| field | type | what it is |
|---|---|---|
| `scene` | `SceneSpec` |  |

### `explore` (ExploreStep)

A world: the learner moves handles/sliders/scrubs to reach goals; detectors give specific lines. Use only when the action is the concept (INTERACTION-BAR).

| field | type | what it is |
|---|---|---|
| `scene` | `SceneSpec` |  |
| `prompt` | `L10n` |  |
| `setup?` | `(scene: Scene, ui: Interaction, ctx: LessonContext, world: WorldApi) => void` | Add drag handles / sliders to the scene; report events through `world`. |
| `goal?` | `{ check: (scene: Scene, ctx: LessonContext, world: WorldApi) => boolean; message?: L10n }` | A single goal (shorthand for `goals: [{ id: 'goal', ... }]`). |
| `goals?` | `Goal[]` | All must be reached; each is announced when reached. |
| `detectors?` | `Detector[]` |  |
| `lines?` | `Line[]` | Narration triggered on enter, idle, goal, an event or a finding. |
| `stars?` | `StarRule` |  |
| `skill?` | `string` | Skill credited when the world is finished (and debited by misconception findings). |
| `required?` | `boolean` | In the game flow the learner cannot move on before the goals are reached (default true when there are goals). |
| `idle_s?` | `number` | Seconds without interaction before 'idle' lines (default 15). |
| `hints?` | `L10n[]` |  |
| `scrub?` | `Record<string, ScrubSpec>` | Numbers in the prompt the learner can drag: write `{scrub:lambda}` in the prompt and give the tracker here. The number and the scene stay in sync. |
| `solve?` | `(scene: Scene, ctx: LessonContext, world: WorldApi) => void` | A scripted player that wins the world by acting on the scene (trackers, world.emit). The lesson doctor runs it headlessly to prove the goals can be reached - and that they are not reached before anyone acts. |
| `cue?` | `L10n[]` | The controls to point at, in order (handle or item labels, as given to add_handle / items): only the first unused one pulses and gets the coach demonstration; when it has been used the cue moves on. Default: every control in creation order (handles, then items). world.cue() changes it later. |
| `actions?` | `{ id: string; label: L10n; run: (scene: Scene, ctx: LessonContext, world: WorldApi) => voi` | Buttons next to Continue (e.g. "Serve", "Pour"): they act on the world. |

### `checkpoint` (CheckpointStep)

A question (choice, number, expression, text, sketch, point...). Choices answer on one click. Can belong to a case (group) and auto-advance.

| field | type | what it is |
|---|---|---|
| `skill` | `string` |  |
| `prompt` | `L10n` | Question text, templated with {vars}; `$...$` is inline TeX. |
| `scene?` | `SceneSpec` | Figure shown while asking (paused on its last frame). |
| `question` | `Question` |  |
| `hints?` | `L10n[]` | Hint ladder: nudge -> strategy -> worked step (each costs mastery credit). |
| `explain?` | `L10n` | Shown after the attempt(s), whatever the outcome. |
| `reveal?` | `string` | Scene step played after answering - the "observe" in predict-observe-explain. |
| `attempts?` | `number` | Attempts before the answer is shown (default 2; predictions 1). |
| `confidence?` | `boolean` | Ask how sure the learner is before checking. |
| `purpose?` | `'predict' \| 'practice' \| 'check'` | Predictions are not graded for mastery (the reveal teaches). |
| `params?` | `(rng: () => number) => Vars` | Variant values for this question. |
| `on_correct?` | `string` |  |
| `on_wrong?` | `string` |  |
| `group?` | `CaseGroup` | Part of a case: consecutive checkpoints with the same group id share its title and brief and are numbered. |
| `auto_advance?` | `boolean` | Go on by itself once answered: the options give way to the feedback, then the next step fades in. For an opening question that should cost the learner nothing (choice questions). |

### Questions (checkpoint `question`)

```ts
export type Question =
  | { type: 'choice'; options: ChoiceOption[]; shuffle?: boolean }
  | { type: 'number'; answer: number | ((v: Vars) => number); tolerance?: number; rtol?: number; unit?: L10n; wrong?: WrongAnswer<number>[] }
  | {
      type: 'expression';
      answer: string | ((v: Vars) => string);
      variables?: string[];
      ranges?: Record<string, [number, number]>;
      form?: 'factored' | 'expanded' | 'exact';
      wrong?: WrongAnswer<string>[];
    }
  | { type: 'sketch'; f: (x: number, v: Vars) => number; x_range: [number, number]; y_range: [number, number]; pass?: number; axes?: (scene: Scene) => AxesLike }
  | { type: 'point'; answer: [number, number] | ((v: Vars) => [number, number]); tolerance: number; axes?: (scene: Scene) => AxesLike }
  | { type: 'text'; rubric: TextRubric; placeholder?: L10n };
```

#### ChoiceOption

| field | type | what it is |
|---|---|---|
| `id` | `string` |  |
| `label` | `L10n` | Text; `$...$` is inline TeX. |
| `correct?` | `boolean` |  |
| `misconception?` | `string` | Misconception this option reveals. |
| `feedback?` | `L10n` |  |

#### TextRubric

What a good free-text answer must say.

| field | type | what it is |
|---|---|---|
| `key_points` | `L10n[]` | The ideas a good answer makes, one per point (the grader marks each as made or not). |
| `model_answer` | `L10n` | A model answer, shown after the attempt(s). |
| `min_points?` | `number` | Key points needed to count as correct (default: all of them). |

#### Misconception

| field | type | what it is |
|---|---|---|
| `id` | `string` |  |
| `description` | `L10n` | What the learner believes, in plain words. |
| `remediation?` | `string` | Step to play when this misconception shows up. |

#### CaseGroup

A case several consecutive questions are about (see CheckpointStep.group).

| field | type | what it is |
|---|---|---|
| `id` | `string` |  |
| `title` | `L10n` |  |
| `brief?` | `Block[]` | The case itself, as on a read page (shown with every question of the case; expanded on the first). |

#### ScrubSpec

A draggable number in a prompt, bound to a ValueTracker of the scene.

| field | type | what it is |
|---|---|---|
| `tracker` | `(scene: Scene) => { get_value(): number; set_value(v: number): unknown }` |  |
| `min` | `number` |  |
| `max` | `number` |  |
| `step?` | `number` |  |
| `decimals?` | `number` |  |
| `label?` | `L10n` | Accessible name, e.g. 'lambda'. |

### The lesson

| field | type | what it is |
|---|---|---|
| `id` | `string` |  |
| `title` | `L10n` |  |
| `description?` | `L10n` |  |
| `mode?` | `'essay' \| 'game'` | How it is presented by default: chaptered scenes ('essay') or levels with stars ('game'). |
| `character?` | `{ name: L10n; avatar?: string }` | Who speaks the narration in the game view (e.g. the pizzeria owner). |
| `theme?` | `'light' \| 'dark'` | Colours of its scenes (visuals' named palette); the learner's own choice may override it. |
| `skills` | `Skill[]` |  |
| `misconceptions?` | `Misconception[]` |  |
| `steps` | `Step[]` |  |
| `params?` | `(rng: () => number) => Vars` | Lesson-wide variant values (merged under each checkpoint's own params). |

## Text-page blocks

The `blocks` of a `read` step (`Block` in `packages/core/src/content.ts`):

```ts
export type Block =
  | { type: 'h'; text: L10n; level?: 2 | 3 }
  | { type: 'p'; text: L10n }
  | { type: 'list'; items: L10n[]; ordered?: boolean }
  /** A displayed formula (TeX, shared by both languages). */
  | { type: 'math'; tex: string; label?: string }
  /** Code with a copy button; `tabs` offers alternative spellings (e.g. PyTorch / TRL); `label` names this block's own tab. */
  | { type: 'code'; lang: string; code: string; caption?: L10n; label?: string; tabs?: { label: string; lang: string; code: string }[] }
  /** A static image from the app's public folder (SVG preferred), redrawn rather than copied; `credit` names the source. */
  | { type: 'figure'; src: L10n; alt: L10n; caption?: L10n; credit?: L10n }
  /** A drawing given as SVG markup (generated courses draw their own diagrams; one per language when it has words); shown as an image, so it runs no code. */
  | { type: 'svg'; svg: L10n; alt: L10n; caption?: L10n }
  /** A visual from @mathnim/visuals embedded in the page (plays; explorable when `explore`). */
  | { type: 'visual'; name: string; params?: Record<string, unknown>; caption?: L10n; explore?: boolean }
  | { type: 'callout'; kind: 'note' | 'warning' | 'misconception' | 'open'; title?: L10n; body: L10n }
  /** Collapsed "details on demand". */
  | { type: 'details'; summary: L10n; blocks: Block[] }
  | { type: 'table'; head: L10n[]; rows: L10n[][] }
  /** A small question inside the page (one right option): a wrong pick says why and can be tried again; the right one shows `explain`. */
  | { type: 'quiz'; prompt: L10n; options: { label: L10n; correct?: boolean; feedback?: L10n }[]; explain?: L10n }
  /** A source reference shown as a footnote. */
  | { type: 'cite'; key: string; text: L10n; url: string };
```

## Visuals

62 parametric visuals (`packages/visuals`): each is a scene with checked parameters, used by lessons (scene steps, worlds, `visual` blocks, course covers) and chosen by the AI tutor for its answers. Packs load on demand (`import('@mathnim/visuals/mpc')`, `.../ft/<part>`, `.../econ` for a demo course through its entry's `packs`); the core pack (geometry, linear algebra) loads with the app. New visuals: `packages/visuals/README.md`; check them with `npm run check -w @mathnim/visuals -- --only <names>` and look at the contact sheets.

### econ

- **`econ_cournot`**: Cournot duopoly as best replies (ECON90015 Q4: R1: q1 = 120 − 0.25q2, R2: q2 = 192 − 0.4q1): drag the starting outputs and watch the firms reply in turn, horizontal moves to R1 and vertical moves to R2, closing in on the crossing (80, 160), the Nash equilibrium, with each reply listed.
  - params: `q1: number in [0, 300] =230 - firm 1's starting output`; `q2: number in [0, 450] =400 - firm 2's starting output`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: economics, oligopoly, cournot, nash equilibrium, best response, reaction function, game theory
  - used in: _(not yet used by a lesson)_
- **`econ_malthus`**: The Malthusian trap (ECON90015 Q6: Y = A·3√N, subsistence y* = 1.5): income per person is the slope of the ray from the origin; drag the population along the production curve to see whether births or deaths win and where it returns, and raise the technology A to see more people at the same living standard.
  - params: `story: one of both|immigration|technology ="both" - what the scene plays: a wave of immigrants returning to N*, better technology (more people, same income per person), or both`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: economics, malthus, growth, population, diminishing returns, subsistence, macroeconomics
  - used in: _(not yet used by a lesson)_
- **`econ_monopoly_tax`**: A tax on a monopolist (ECON90015 Q2: demand p = 600 − 2Q, MC = 60 + Q): drag the tax and switch percentage (the demand the seller sees rotates) or per unit (it shifts); the monopolist re-solves MR = MC, and a bar splits the tax per unit between buyers and the monopolist, with output, revenue and the deadweight loss.
  - params: `kind: one of percent|unit ="percent" - 'percent': buyers pay (1 + τ) times what the seller keeps; 'unit': buyers pay t more`; `size: number in [0, 0.6] =0.25 - the tax the scene ends on: τ = size (0.25 = 25%), or t = 320 × size per unit (0.25 → 80)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: economics, monopoly, tax incidence, ad valorem tax, per-unit tax, marginal revenue, deadweight loss
  - used in: _(not yet used by a lesson)_
- **`econ_quota`**: Import quota welfare (ECON90015 Q1: demand p = 60 − Q/2, import supply p = Q/10, external benefit per unit): drag the quota and see the price off demand, the extra paid on units still bought (A), the value and cleaner air lost on units no longer bought (B), and USF social benefit against the quota, with or without selling the import licences.
  - params: `quota: number in [10, 120] =60 - the quota the scene ends on (units); 100 or more does not bind`; `ext: number in [0, 20] =10 - external benefit to USF per turbine (10 in the exam)`; `licences: boolean =false - start with the import licences sold, so the quota rent stays in USF`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: economics, welfare, quota, trade policy, consumer surplus, externality, quota rent
  - used in: _(not yet used by a lesson)_
- **`econ_screening`**: Two packages for two kinds of buyers (ECON90015 Q3b: demands 24 − q and 16 − q, MC = 6): drag the size of the small package and see what the low type pays (area under its demand), the rent the high type must be left (the strip between the demands), and the profit, highest where one more unit earns as much as it costs in rent (q2 = 2).
  - params: `q2: number in [0, 10] =2 - the size of the small package the scene ends on (2 is best; 10 is where its demand meets MC)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: economics, price discrimination, second degree, screening, information rent, packages, menu pricing
  - used in: _(not yet used by a lesson)_

### ft/a

- **`chunk_size_recall`**: RAG chunk size under a fixed context budget, on real retrieval runs (multilingual-e5-small, 16 Wikipedia articles, 12 questions): k = budget / chunk size chunks fit; small chunks cut answer sentences apart, large ones rank worse and leave room for few; overlap re-joins cut sentences. Strip = one article with its chunks and the answer sentence; cells = every question. Student moves chunk size, budget, overlap and the inspected question.
  - params: `size: one of 64|128|256|512|1024 ="512" - chunk size in tokens at the start`; `budget: one of 512|1024|2048|4096 ="512" - context budget for retrieved chunks, in tokens`; `overlap: one of 0|10|20 ="0" - overlap between neighbouring chunks, percent`; `question: integer in [0, 11] =2 - question to inspect (0-11)`; `show_budget: boolean =true - show the budget slider (off: the budget is fixed)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: rag, chunking, retrieval, embeddings, context budget, fine-tuning
  - used in: `ft/a/a2.ts`
- **`contrastive_infonce`**: InfoNCE / in-batch-negatives loss on 2D unit vectors: query, positive, negatives; bars are softmax weights softmax(q·d/τ), arrows at the tips are one exact gradient step. Low temperature sends nearly all push to the most similar negative - a false negative gets pushed hardest. Student moves τ and the query; train / reveal / filter actions in the lesson.
  - params: `tau: number in [0.03, 1] =0.5 - temperature τ (sentence-transformers MNRL uses scale = 1/τ = 20, i.e. τ = 0.05)`; `n_neg: integer in [1, 5] =5 - number of in-batch negatives (batch size - 1)`; `false_negative: boolean =true - n₁, the negative most similar to q, is really relevant (revealed by the lesson)`; `lr: number in [0.001, 0.05] =0.008 - learning rate of one training step (on the angles)`; `drag_query: boolean =false - also let the student turn the query vector (changes every similarity at once)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: contrastive learning, infonce, embeddings, rag, hard negatives, temperature, fine-tuning
  - used in: `ft/a/a2b.ts`
- **`cost_crossover`**: Does fine-tuning save money? Daily cost of a large model with a long prompt (A) vs a fine-tuned small model with a short prompt plus a fixed daily cost (B), log-log; the lines cross at the break-even volume N* = F/(c_A - c_B). Student drags requests per day, prompt-cache hit share and fixed cost; a lesson action pins a guessed break-even. Exact; prices are examples.
  - params: `requests_per_day: number in [10, 1000000] =2000 - requests per day at the start`; `tokens_in_a: number in [100, 20000] =3000 - input tokens per request with the long prompt (A)`; `tokens_in_b: number in [0, 20000] =300 - input tokens per request with the fine-tuned short prompt (B)`; `tokens_out: number in [10, 4000] =300 - output tokens per request (both)`; `price_in_a: number in [0, 100] =3 - A input price, USD per million tokens (example)`; `price_out_a: number in [0, 200] =15 - A output price, USD per million tokens (example)`; `price_in_b: number in [0, 100] =0.2 - B input price, USD per million tokens (0 when self-hosted: then all of B is the fixed cost)`; `price_out_b: number in [0, 200] =0.8 - B output price, USD per million tokens`; `cache_hit: number in [0, 1] =0 - share of A's input tokens served from the prompt cache`; `cache_price_ratio: number in [0, 1] =0.1 - cached input price / normal input price`; `fixed_per_day: number in [0, 5000] =20 - B's fixed cost per day in USD (hosting plus amortised training); 0 = per-token LoRA hosting`; `hide_nstar: boolean =false - hide the break-even point and value until the learner locks a guess (scene.lock()); they hide again when the cache share or F changes`; `controls: one of all|volume ="all" - 'volume': explore() attaches only the N slider (the others wait for scene.attach_controls)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, llm, cost, latency, prompt caching, distillation, how to choose
  - used in: `ft/a/a1.ts`, `ft/f/f1.ts`
- **`rag_pipeline`**: RAG as two pipelines: indexing (documents -> chunks -> embeddings -> vector index, once) and query time (question -> retrieve top-k -> rerank -> assemble prompt with numbered sources -> answer with citations); the knob of each stage is written under it. Can highlight a stage or mark a failure point FP1-FP7 (Barnett et al. 2024). Illustrative diagram, no handles.
  - params: `k: integer in [2, 6] =4 - how many chunks are retrieved (drawn)`; `rerank: boolean =true - show the reranking stage reordering the candidates`; `highlight: one of |docs|chunk|embed|index|query|retrieve|rerank|assemble|generate ="" - stage to highlight at the end`; `failure: one of |FP1|FP2|FP3|FP4|FP5|FP6|FP7 ="" - mark a failure point (Barnett et al. 2024) on its stage`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: rag, retrieval, embeddings, reranking, llm, fine-tuning
  - used in: `ft/a/a2.ts`

### ft/b

- **`attention_mask_packing`**: Padding vs packing for SFT: four examples of adjustable length batched by padding (waste = 1 - Σn/(4·max n)), naive packing (one row, causal attention crosses examples: 1 - Σn(n+1)/(N(N+1)) of the cells) or boundary-aware packing (position_ids restart, varlen attention: no waste, no cross-talk). Shows the batch, the attention matrix and position_ids. Drag the example ends; pick the batching.
  - params: `lengths: 4 numbers in [8, 512] =[300,60,120,40] - token counts of the four examples (8-512), e.g. [256,256,256,256] (equal: naive packing crosses 75% of cells) or [480,16,16,16] (padding wastes 72%)`; `mode: one of pad|naive|boundary ="naive" - 'pad' (rows padded to the longest), 'naive' (packed, plain causal attention), 'boundary' (packed, position_ids reset + varlen attention)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, sft, packing, padding, attention mask, position ids, throughput
  - used in: `ft/b/b1_sft_mechanics.ts`
- **`eval_noise`**: Is a small eval gain real? The observed gap between two checkpoints on n questions is drawn from a normal curve centred on the true gap (exact formula); the shaded area below 0 is the chance the better model looks worse. Independent SE = √((p_A q_A + p_B q_B)/n), paired SE = √((δ - Δ²)/n). Re-running an eval (seeded simulation) stamps one observed gap. Controls: n, independent/paired, disagreement δ.
  - params: `n: integer in [10, 5000] =200 - questions in the eval set (e.g. 30 for AIME, 200 for a small held-out set)`; `p_a: number in [0.05, 0.9] =0.7 - true accuracy of the old checkpoint A`; `gap: number in [0.005, 0.15] =0.03 - true gain of B over A (0.03 = 3 points)`; `paired: boolean =false - paired analysis (both models on the same questions, per-question differences) instead of comparing two independent accuracies`; `discord: number in [0.02, 0.5] =0.1 - paired only: fraction of questions where the two models disagree (must exceed the gap)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: evaluation, statistics, confidence interval, fine-tuning, checkpoint selection, llm
  - used in: `ft/b/b3_training_and_eval.ts`
- **`pad_eos_trap`**: Why a fine-tuned model doesn't stop: a padded batch (Llama 3.1 tokens) with its labels as the collator builds them. Switches: pad token (= <|eot_id|> or a dedicated pad), label masking (input_id == pad_id, or attention_mask == 0), stop token. With pad = EOS and masking by id the real <|eot_id|> is labelled -100, so it is never a training target; a strip illustrates the generation.
  - params: `pad_is_eos: boolean =true - true: tokenizer.pad_token = eos_token (<|eot_id|>), a common shortcut; false: a dedicated pad token (<|finetune_right_pad_id|>)`; `mask_rule: one of by_id|by_attention ="by_id" - 'by_id': labels[input_ids == pad_id] = -100 (DataCollatorForLanguageModeling); 'by_attention': mask where attention_mask == 0`; `stop_token: one of eot|end_of_text ="eot" - the token generation stops at: 'eot' (<|eot_id|>, the end of turn the model was trained on) or 'end_of_text' (<|end_of_text|>, a mismatch)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, sft, eos, padding, loss mask, chat template, data collator
  - used in: `ft/b/b1_sft_mechanics.ts`
- **`rejection_sampling_yield`**: Rejection sampling (best-of-n, expert iteration) as SFT data: three kinds of problems with assumed pass rates (easy 0.9, medium 0.3, hard 0.02, an illustration). Exact expectations of coverage 1-(1-p)^n, kept samples E[min(X,c)], the dataset mix and the sampling budget; bars show one seeded draw of kept answers per problem. Controls: samples per problem n, cap c per problem, extra samples m for hard problems.
  - params: `n: integer in [1, 64] =8 - samples drawn per problem`; `cap: one of 1|2|4|none ="none" - keep at most this many correct answers per problem (none = keep all)`; `hard_boost: integer in [1, 8] =1 - multiply n by this for the hard problems (pass rate below 0.1): 1, 2, 4 or 8`; `p_easy: number in [0.5, 0.99] =0.9 - assumed pass rate of the easy problems (30% of the problems)`; `p_medium: number in [0.1, 0.6] =0.3 - assumed pass rate of the medium problems (40%)`; `p_hard: number in [0.005, 0.09] =0.02 - assumed pass rate of the hard problems (30%)`; `problems: integer in [20, 1000] =100 - number of problems`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, sft, rejection sampling, best-of-n, expert iteration, synthetic data, data
  - used in: `ft/b/b2_data_sources.ts`
- **`token_loss_mask`**: Who pays the SFT loss: a real chat sample (Qwen2.5 template, losses from Qwen2.5-0.5B) as a skyline of per-token losses; its parts (template, system, user, answer, the closing <|im_end|>, tool call, tool result) sit in a "trained" or a "masked" row; masked tokens weigh λ (prompt-loss weight). A bar shows the answer's share of the loss sum. Move a card between the rows; drag λ.
  - params: `sample: one of single|multiturn|tool_call ="single" - which real sample: 'single' (long system prompt, one question, short answer), 'multiturn' (two turns), 'tool_call' (a tool call and its result)`; `start: one of all|assistant ="all" - where the cards start: 'all' trained (no mask, the plain LM-dataset default) or 'assistant' (assistant-only loss)`; `prompt_weight: number in [0, 1] =0 - λ, the weight of masked tokens in the loss (0 = fully masked; 0.01-0.5 is the range studied by Huerta-Enochian 2024)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, sft, loss mask, chat template, prompt loss weight, eos, tool calling
  - used in: `ft/b/b1_sft_mechanics.ts`, `ft/b/b2_data_sources.ts`
- **`training_curves`**: Training curves to diagnose (a figure): train loss and answer-only validation loss, and a task metric. Presets (illustrations): 'healthy', 'overfit' (val U-shape, metric falls), 'lr_high' (spikes), 'mask_bug' (train loss collapses on a repeated prompt, answer-only val and metric flat); or 'custom' with the learner's own numbers as JSON series.
  - params: `preset: one of healthy|overfit|lr_high|mask_bug|custom ="healthy" - which illustrated shape to draw; 'custom' draws `series``; `series: text (max 4000) ="" - custom only: JSON {"name": [values...], ...}, up to 4 series (e.g. {"train":[2.1,1.4,1.1],"val":[2.0,1.6,1.7]}); names ending in "acc"/"score"/"metric"/"reward" go on the right panel`; `show_answer: boolean =false - write the diagnosis of the preset under the plots (for the reveal after a question)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, sft, training curves, overfitting, learning rate, loss mask, diagnosis
  - used in: `ft/b/b3_training_and_eval.ts`
- **`two_valleys_forgetting`**: Forgetting as a two-parameter toy model: an old-task bowl around the base model and a new-task trough (steep across, nearly flat along). Gradient steps on (1-ρ)·L_new + ρ·L_old (ρ = replay) are exact; the path, L_new and L_old over steps grow as training runs. Shows: after the new loss is flat the point keeps drifting (speed ∝ learning rate) and the old loss keeps rising; replay pins the drift cheaply; preset B shows distance moved is not forgetting. Controls: learning rate, replay, preset; lessons add "train 100 steps".
  - params: `lr: number in [0.005, 0.3] =0.02 - learning rate η (the steep direction diverges above 2/8 = 0.25 without replay)`; `replay: number in [0, 0.9] =0 - ρ, the share of old-task data mixed into training`; `preset: one of A|B ="A" - 'A': the old task cares about both parameters; 'B': the old task barely cares about θ2 (moving far need not mean forgetting)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, catastrophic forgetting, learning rate, replay, optimization, toy model
  - used in: `ft/b/b4_forgetting.ts`

### ft/c

- **`lowrank_update`**: How much of a real fine-tuning update ΔW does rank r keep? Heatmaps ΔW = rank-r part + residual (one 48x48 crop), the singular-value spectra (log-log) of the official post-training ΔW of Qwen2.5-0.5B, the same ΔW cut to rank 16, and a random matrix of the same norm, with a cut line at r; readouts energy kept Σσᵢ²(i≤r)/Σσᵢ², relative error, LoRA params r(d+k) vs dk. Student drags r and switches matrix and layer.
  - params: `source: one of full_ft|rank16|random ="full_ft" - 'full_ft' the official post-training ΔW (Qwen2.5-0.5B -> Instruct, includes RL), 'rank16' the same ΔW truncated to rank 16 (exactly 100% energy at r = 16), 'random' a Gaussian matrix with the same shape and norm (illustration: no low-rank structure)`; `layer: one of q_proj|down_proj ="q_proj" - 'q_proj' (896 x 896) or 'down_proj' (896 x 4864) of the same block`; `r: integer in [1, 64] =4 - the rank kept (1-64): the top r singular values`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: lora, low rank, svd, singular values, eckart-young, fine-tuning, pca
  - used in: `ft/c/c2_lora.ts`
- **`quant_levels`**: Blockwise absmax quantisation: one block of weights with an outlier, on the value axis (the grid of levels stretched to ±absmax) and divided by absmax (weights among the levels, counts per level below). Dragging the outlier stretches the grid so the other weights collapse onto the levels near 0; smaller blocks contain the damage at 32/B bits per weight (double quantisation: 8/B + 32/(256B)); NF4 levels sit at normal quantiles. Readouts: MSE of all other weights, levels used, share quantised to 0, scale overhead. Student drags the outlier and switches format (int4/NF4/int8), block size, data and double quantisation.
  - params: `format: one of int4|nf4|int8 ="int4" - 'int4' uniform absmax (levels k/7, k = -7..7), 'nf4' (16 levels at normal quantiles with an exact 0), 'int8' (k/127, for comparison)`; `block: integer in [0, 4096] =0 - block size B: 32, 64, 256, 1024, or 0 (= 4096, one scale for the whole tensor); other values snap to the nearest`; `outlier_sigma: number in [0, 25] =0 - the outlier weight in units of σ (0-25; 25σ = 0.5 for N(0, 0.02²)); it sits in the first block`; `data: one of gaussian|real_row ="gaussian" - 'gaussian' seeded N(0, 0.02²) x 4096 (simulation), or 'real_row' 4096 real weights (the first 4096 of a row of layer 12's mlp.down_proj of Qwen2.5-0.5B)`; `double_quant: boolean =false - double quantisation of the scales: overhead 8/B + 32/(256B) bits instead of 32/B (B = 64: 0.127 instead of 0.5)`; `seed: integer in [1, 9999] =7 - seed of the gaussian data`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: quantization, qlora, nf4, int4, blockwise quantization, outliers, double quantization, fine-tuning
  - used in: `ft/c/c3_qlora_serving.ts`
- **`rank_one_update`**: A rank-1 update W = W₀ + u vᵀ on the plane (LoRA with r = 1: u is the column of B, vᵀ the row of A). The grid of W₀ morphs into W; any input x changes by u(v·x), always along u; inputs on the line perpendicular to v do not change. Student drags u, v and a probe x.
  - params: `W0: 2x2 matrix in [-2, 2] =[[1,0],[0,1]] - the frozen matrix W₀ (rows first); e.g. [[1,0],[0,1]] or [[1.2,0.3],[0.1,0.9]]`; `u: 2 numbers in [-3, 3] =[0.5,1] - output direction u (the column of B): every change points along u`; `v: 2 numbers in [-3, 3] =[1,0] - input direction v (the row of A): only the part of x along v matters`; `x: 2 numbers in [-3, 3] =[1,1] - the probe input x`; `show_null_line: boolean =true - highlight the line perpendicular to v (inputs there are unchanged)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: lora, low rank, rank one, fine-tuning, linear algebra, outer product
  - used in: `ft/c/c2_lora.ts`
- **`vram_calculator`**: Will fine-tuning fit on this GPU? A stacked bar of the C1 VRAM estimate (frozen weights, trainable weights, gradients, optimizer states, activations, logits, overhead) against 16/24/48/80 GB cards, with a ledger of values. Student switches model, method (full/LoRA/QLoRA), sequence length, micro-batch, LoRA rank, activation recomputation, fused cross-entropy and the card. An estimate from formulas, not a measurement.
  - params: `model: one of llama3.2-1b|llama3.2-3b|llama3.1-8b|llama3.1-70b|qwen2.5-7b|qwen2.5-14b|qwen2.5-32b ="llama3.1-8b" - model preset (exact architecture from config.json): llama3.2-1b, llama3.2-3b, llama3.1-8b, qwen2.5-7b, qwen2.5-14b, qwen2.5-32b, llama3.1-70b`; `method: one of full|lora|qlora ="full" - 'full' (all weights trained, AdamW 16 bytes/param), 'lora' (frozen bf16 base + fp32 adapters), 'qlora' (frozen NF4 base with double quantisation + adapters)`; `optim: one of adamw|adamw8bit|bf16 ="adamw" - 'adamw' mixed precision (16 bytes/param), 'adamw8bit' (10), 'bf16' pure bf16 (8)`; `rank: integer in [1, 256] =16 - LoRA rank r (LoRA and QLoRA only); 8B all-linear r = 16 is 41.9M parameters`; `targets: one of all-linear|attn ="all-linear" - where LoRA is attached: 'all-linear' (7 linear layers per block) or 'attn' (q, k, v, o only)`; `seq: integer in [512, 32768] =4096 - sequence length s in tokens (512-32768); activations and logits grow with s·b`; `batch: integer in [1, 32] =1 - micro-batch b per GPU (1-32)`; `ckpt: boolean =true - activation recomputation ("gradient checkpointing"): keep only each layer input, about 1.6 GB instead of 18 GB for 8B at 4k, +33% compute`; `fused_ce: boolean =false - chunked / fused cross-entropy: the b·s·V fp32 logits and their gradient are never stored whole (≈ 0 instead of 4.2 GB for 8B at 4k). TRL SFTTrainer computes log-probs in chunks by default; plain PyTorch / Trainer stores them (false)`; `gpus: integer in [1, 8] =1 - number of GPUs; only matters with zero3 (sharding), otherwise each GPU holds everything`; `zero3: boolean =false - ZeRO-3 / FSDP: weights, gradients and optimizer states are split over the GPUs (activations are not)`; `act_const: integer in [34, 41] =34 - bytes per s·b·h per layer kept for backward: 34 (Korthikanti, default) or 41 (rough Llama estimate)`; `gpu_gb: integer in [16, 80] =24 - the card the bar is compared with: 16, 24, 48 or 80 GB (other values snap to the nearest)`; `hidden: boolean =false - start with the bar and numbers hidden (for a prediction first); the lesson reveals them with scene.reveal()`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: fine-tuning, llm, vram, gpu memory, lora, qlora, activations, optimizer states
  - used in: `ft/c/c1_memory.ts`

### ft/d

- **`bradley_terry_fit`**: Bradley–Terry rewards fitted to a toy league of comparisons (A pinned at 0): each matchup shows the observed win rate and the predicted σ(r_i − r_j); dragging one reward moves every row it is in; fitting sends the reward of an undefeated response (D, 3:0 against C) up forever, until one loss is added. Drag the bars, drag comparison cards into the data.
  - params: `story: one of full|setup ="full" - 'full' plays the whole explanation (fit, runaway, one loss); 'setup' only builds the league at zero rewards (for a world)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: bradley-terry, reward model, preference, pairwise comparison, maximum likelihood, rlhf, fine-tuning
  - used in: `ft/d/d1.ts`
- **`dpo_gap_plane`**: DPO only sees the gap: the loss −log σ(β(Δ_w − Δ_l)) is constant along diagonals of the (Δ_w, Δ_l) plane, so both log-probabilities can fall while the loss falls. A toy log-linear policy over five responses (feature plane) trained by DPO on one pair moves along d = φ_w − φ_l: with a similar pair, probability flows to an unseen response that complies with a request it should refuse (likelihood displacement); a dissimilar pair or an NLL term on the chosen response avoids it. Drag the gap point, drag the rejected response, train.
  - params: `story: one of full|setup ="full" - 'full' shows the gap lines, trains the similar pair (displacement), then a dissimilar one; 'setup' builds the picture untrained (for a world)`; `nll: boolean =false - add an NLL term α·(−log π(y_w)), α = 0.5, to the loss (DPO + NLL, as in Llama 3 / RPO)`; `nll_switch: boolean =true - show the + NLL switch (a world about the pair geometry hides it)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: dpo, likelihood displacement, preference, implicit reward, ches, rlhf, fine-tuning
  - used in: `ft/d/d3.ts`
- **`kl_leash_policy`**: The KL-regularised optimum π* ∝ π_ref·e^{r/β} on eight responses (made-up numbers, exact closed form): lowering β (loosening the leash) raises the expected proxy reward monotonically, while the expected gold quality rises then falls as the policy piles onto an exploit the reward model over-rates; the trace keeps every visited β; with π_ref(exploit) = 0 no β can reach it. Drag β, reveal gold, switch the exploit off.
  - params: `story: one of full|setup ="full" - 'full' sweeps β, reveals the gold quality and the wall; 'setup' builds the picture at β = 10 with gold hidden (for a world)`; `beta: number in [0.01, 10] =1 - β where the full story ends (0.62 gives the best gold quality, below 0.29 the exploit takes over)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: rlhf, kl divergence, kl penalty, reward hacking, over-optimization, beta, dpo, preference, fine-tuning
  - used in: `ft/d/d2b.ts`
- **`pg_baseline`**: REINFORCE with a baseline: three responses (rewards 2, 5, 9, uniform policy); each one-sample update (R−b)(e_i−π) is a point in a plane; the mean update (the true gradient, gold arrow) stays fixed as the zero line b moves, while the spread of the points (the variance) is smallest at b = mean reward 5.33. Drag b.
  - params: `story: one of full|setup ="full" - 'full' sweeps b and traces the variance; 'setup' builds the picture at b = 0 with an empty trace (for a world)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: policy gradient, reinforce, baseline, variance, advantage, rlhf, grpo, fine-tuning
  - used in: `ft/d/d2a.ts`
- **`ppo_clip`**: PPO's clipped objective min(ρA, clip(ρ,1-ε,1+ε)A) against the probability ratio ρ: the arrow shows whether the gradient pushes this token's probability up, down or not at all, and the formula lights the term the min takes. Clipping only blocks a further move in the advantage's direction, never a correction. Drag ρ and flip good/bad token; eps sets the band, eps_high > 0 gives DAPO's asymmetric band.
  - params: `story: one of full|setup ="full" - 'full' sweeps a good token, then a bad one; 'setup' only builds the picture at ρ = 1 with a good token (for a world)`; `eps: number in [0.05, 0.5] =0.2 - clip range ε (lower side 1-ε); PPO uses 0.2`; `eps_high: number in [0, 0.5] =0 - upper clip range (1+ε_high); 0 = same as eps; DAPO uses 0.28 with eps 0.2`; `adv_sign: one of +|- ="+" - sign of the advantage A ('+' good token, '-' bad token) where the scene ends`; `rho: number in [0.3, 2] =1 - probability ratio ρ = π_θ/π_old where the scene ends`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: ppo, clipping, policy gradient, rlhf, grpo, reinforcement learning, fine-tuning
  - used in: `ft/d/d2a.ts`, `ft/e/e1.ts`

### ft/e

- **`e_figure`**: Diagrams for the reasoning/distillation lessons: 'grpo_loop' (sample a group, verify, group baseline, update; PPO's four models vs GRPO's), 'rollout_timeline' (sync vs async rollouts, rollout/trainer mismatch), 'agentic' (which tokens of a tool-using trajectory are trained), 'mopd' (multi-teacher on-policy distillation), 'task_vectors' (why adding task vectors sometimes interferes); data charts 'zero_var' (p^G + (1-p)^G), 'r1_zero_curves' (R1-Zero AIME accuracy and length during RL, approximate readings of the paper's figures), 'qwen3_distill_rl' (Qwen3-8B: RL vs on-policy distillation, Table 21). Figures, no handles.
  - params: `which: one of grpo_loop|rollout_timeline|agentic|mopd|task_vectors|zero_var|r1_zero_curves|qwen3_distill_rl ="grpo_loop" - which diagram`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: grpo, rlvr, ppo, async rl, agentic rl, distillation, on-policy distillation, model merging, task vectors, fine-tuning
  - used in: `ft/e/common.ts`
- **`forward_reverse_kl`**: Fit one Gaussian q to a two-peaked teacher p: forward KL(p‖q) (exact, numerical) makes q cover both peaks (moment matching), reverse KL(q‖p) makes q sit in one peak, the one nearest where it starts. The strip shows the integrand whose area is the KL. Student drags the top of q (μ, σ) and switches the direction.
  - params: `weight: number in [0.5, 0.9] =0.5 - mass of the left peak (0.5 = two equal peaks; 0.7 = the left one is heavier)`; `separation: number in [1, 3] =2 - the peaks sit at -d and +d`; `mode_width: number in [0.3, 1] =0.6 - standard deviation of each peak`; `mu: number in [-4, 4] =2.5 - student's mean where the scene ends`; `sigma: number in [0.42, 3.4] =1 - student's standard deviation where the scene ends`; `direction: one of forward|reverse ="forward" - which KL is shown and optimised: 'forward' KL(p‖q) or 'reverse' KL(q‖p)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: kl divergence, forward kl, reverse kl, distillation, on-policy distillation, mode seeking, mode covering, fine-tuning
  - used in: `ft/e/e3.ts`
- **`grpo_group`**: One GRPO group: G answer cards graded right/wrong; bars show the exact group-relative advantages (r - mean)/std, which all vanish when the group is all right or all wrong. Phase 'length' shows the per-token push under per-answer, per-token or constant averaging (GRPO's length bias). Student flips verdicts, drags lengths, switches baseline / std / aggregation.
  - params: `G: integer in [4, 8] =8 - group size: answers sampled for one question (4-8)`; `right: 8 numbers in [0, 1] =[1,1,0,0,0,0,0,0] - verdict of each answer: 1 right, 0 wrong (first G used)`; `lengths: 8 numbers in [50, 2000] =[220,180,300,260,100,1000,240,280] - answer lengths in tokens (first G used; shown in the length phase)`; `baseline: boolean =true - subtract the group mean (off = plain REINFORCE with 0/1 rewards)`; `std: boolean =true - divide by the group standard deviation (population std)`; `agg: one of sequence|token|constant ="sequence" - how the loss is averaged: 'sequence' (original GRPO, 1/|o_i|), 'token' (DAPO), 'constant' (Dr. GRPO)`; `phase: one of advantage|length ="advantage" - 'advantage': bars are Â_i; 'length': bars are the relative push per token, lengths draggable`; `p: number in [0.05, 0.95] =0.3 - toy model: this question's success rate, moved by update_step()`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: grpo, rlvr, advantage, baseline, rloo, reinforcement learning, length bias, dr grpo, dapo, fine-tuning
  - used in: `ft/e/e1.ts`
- **`pass_k_sharpen`**: pass@k before and after RL from per-question success rates (pass@k = mean of 1-(1-p)^k, exact). An illustrative 'sharpening' pushes questions above a threshold up and those below down: pass@1 rises, large-k pass@k falls, the curves cross. Lifting a never-solved question raises only the large-k end. Student drags the sharpening and individual questions.
  - params: `n_questions: integer in [12, 40] =24 - number of questions`; `seed: integer in [1, 999] =3 - seed of the illustrative question set`; `preset: one of default|easy|hard ="default" - question mix: default, easy (mostly solvable) or hard (many never solved)`; `sharpen: number in [0, 3] =0 - illustrative RL sharpening strength s where the scene ends (0 = the base model)`; `threshold: number in [0.02, 0.5] =0.1 - success rate above which sharpening pushes a question up (below: down)`; `mode: one of world|sketch ="world" - 'world': bars, curves and handles; 'sketch': axes with the base curve and the RL pass@1 point, for drawing a prediction`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: pass@k, rlvr, reasoning, grpo, sharpening, coverage, reinforcement learning, evaluation, fine-tuning
  - used in: `ft/e/e2.ts`
- **`r1_pipeline`**: DeepSeek-R1's training recipe built up step by step: R1-Zero (pure RL with rule rewards: AIME pass@1 15.6% -> 71.0%, but unreadable, mixed languages), then R1's four stages - cold-start SFT, reasoning RL, rejection sampling + SFT (~800k samples, retrained from V3-Base), RL for all scenarios - each with its data, reward and the problem it fixes. A figure, no handles.
  - params: `stage: one of zero|all ="all" - 'zero': only R1-Zero; 'all': R1-Zero, then R1's four stages`; `highlight: one of none|1|2|3|4 ="none" - stage of R1 to point at at the end`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: deepseek-r1, reasoning, rlvr, grpo, cold start, rejection sampling, training recipe, fine-tuning
  - used in: `ft/e/e2.ts`

### ft/f

- **`decision_map`**: The fine-tuning course decision map: evals, context baseline, fixed labels, then knowledge / behaviour / capability / efficiency branches down to methods (RAG, SFT, DPO, RLVR, distillation...). Shows the nodes unlocked up to a lesson, highlights nodes, traces a case path, and shows a lesson's one-line rule. A figure, no handles.
  - params: `upto: one of A1|A2|A2b|B1|B2|B3|B4|F0|C1|C2|C3|D1|D2a|D2b|D2|D3|D4|E1|E2|E3|F1 ="F1" - show the nodes taught up to this lesson (A1, A2, A2b, B1-B4, F0, C1-C3, D1, D2a, D2b, D3, D4, E1-E3, F1; D2 = D2b); later nodes are not drawn`; `highlight: text (max 120) ="" - node ids to highlight, comma separated, e.g. 'K2,K3' (ids: 0 1 T ENC 2 K1-K5 B1 B2 B3 R C1-C4 E1-E3 S X V; a 'DM-' prefix is fine)`; `path: text (max 160) ="" - a case's route, lit node by node in order, e.g. '0,1,T,2,K1,K2,K3'`; `card: one of |A1|A2|A2b|B1|B2|B3|B4|F0|C1|C2|C3|D1|D2a|D2b|D2|D3|D4|E1|E2|E3|F1 ="" - show this lesson's one-line 'how to choose' rule under the map ('' for none)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`; `show_out_of_scope: boolean =true - note that multimodal fine-tuning is out of scope`
  - topics: fine-tuning, llm, decision, rag, sft, dpo, rlvr, distillation, how to choose
  - used in: `ft/b/common.ts`, `ft/d/common.ts`, `ft/e/common.ts`, `ft/f/f1.ts`, `ft/f/kit.ts`

### geometry

- **`circle_slices`**: Cut a circle into n slices and line them up into a near-rectangle r high and πr wide, so A = πr·r = πr². Student drags "slices" and "line up" sliders.
  - params: `n: integer in [4, 60] =24 - number of slices in the explanation (even)`; `r: number in [1, 2.1] =1.6 - radius in scene units`; `show_formula: boolean =true - derive A = πr·r = πr² next to the shape`
  - topics: geometry, circles, area, pi
  - used in: _(not yet used by a lesson)_

### linalg

- **`covariance_ellipse`**: The shape of 2D data: a seeded cloud, its mean, points coloured by the sign of (x − x̄)(y − ȳ), the covariance matrix Σ live, and the 1σ/2σ ellipses along Σ's eigenvectors. Student drags points.
  - params: `correlation: number in [-0.99, 0.99] =0.7 - correlation of x and y (the sample correlation is exactly this)`; `spread: number in [0.3, 2] =1 - standard deviation of x`; `aspect: number in [0.3, 3] =0.8 - standard deviation of y divided by that of x`; `n: integer in [10, 300] =80 - number of points`; `seed: integer in [1, 9999] =7 - random seed (same seed, same cloud)`
  - topics: statistics, covariance, correlation, variance, linear algebra, pca
  - used in: `eigen-pca/lesson.ts`
- **`determinant_area`**: det A as area: the unit square becomes the parallelogram of A's columns with signed area det A; then ĵ turns onto î's line (det 0, plane squashed) and past it (det < 0, orientation flipped). Student drags î and ĵ.
  - params: `A: 2x2 matrix in [-3, 3] =[[1.5,1],[0.5,2]] - the matrix, rows first [[a, b], [c, d]]; det = ad - bc. Use parallel columns for det 0 and swapped orientation for det < 0`; `show_collapse: boolean =true - after showing det A, turn ĵ onto î's line (det 0) and past it (det < 0), then back`
  - topics: linear algebra, determinant, area, orientation, linear transformations
  - used in: `eigen-pca/lesson.ts`
- **`eigen_hunt`**: Hunting eigenvectors: a probe v turns around the unit circle with Av drawn; when they line up the eigenline is highlighted and λ = ±|Av|/|v| is read off (also repeated, λI and complex = never lines up). Student drags v.
  - params: `A: 2x2 matrix in [-3, 3] =[[3,1],[0,2]] - the matrix, rows first [[a, b], [c, d]]; e.g. [[3,1],[0,2]] (λ = 3, 2), [[1,2],[2,1]] (λ = 3, -1), [[2,1],[0,2]] (one eigenline), [[0,-1],[1,0]] (none)`
  - topics: linear algebra, eigenvalues, eigenvectors, linear transformations
  - used in: `eigen-pca/lesson.ts`
- **`lambda_sweep`**: Why det(A − λI) = 0: the grid under A − λI beside the curve det(A − λI) against λ; exactly at a root the grid collapses onto a line and the vectors sent to 0 are the eigenvectors. Student drags a λ slider.
  - params: `A: 2x2 matrix in [-3, 3] =[[3,1],[0,2]] - the matrix, rows first [[a, b], [c, d]]; the curve is λ² − (a+d)λ + (ad − bc). E.g. [[2,1],[1,2]] (roots 1, 3), [[2,1],[0,2]] (double root), [[1,-1],[1,1]] (no real root)`
  - topics: linear algebra, eigenvalues, characteristic polynomial, determinant, eigenvectors
  - used in: `eigen-pca/lesson.ts`
- **`linear_map`**: A 2x2 matrix acting on the grid: î and ĵ move to A's columns (a matrix is where the basis vectors land); optionally v = xî + yĵ lands on x·Aî + y·Aĵ. Student drags the tips of î and ĵ; grid and matrix entries follow.
  - params: `A: 2x2 matrix in [-3, 3] =[[2,-1],[1,1]] - the matrix, rows first: [[a, b], [c, d]]; î lands on (a, c), ĵ on (b, d)`; `v: 2 numbers in [-3, 3] =[-1,2] - the example vector v = x î + y ĵ that is followed through the map`; `show_vector: boolean =true - show v and the step Av = x(Aî) + y(Aĵ); false keeps only grid, î, ĵ and the matrix`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: linear algebra, matrices, linear transformations, basis vectors
  - used in: `eigen-pca/lesson.ts`, `text-pages-demo/lesson.ts`
- **`matrix_power`**: Aⁿv: a fan of vectors swings to the dominant eigenvector (power iteration); then the eigenbasis grid, where A only stretches each axis: A = PDP⁻¹, Aⁿ = PDⁿP⁻¹. Student scrubs n and turns the fan.
  - params: `A: 2x2 matrix in [-3, 3] =[[0.9,0.3],[0.2,0.8]] - the matrix, rows first; default has λ₁ = 1.1 along (3, 2) and λ₂ = 0.6 along (1, -1). Lengths are rescaled automatically when Aⁿ grows or shrinks a lot`; `steps: integer in [1, 12] =8 - how many times A is applied`; `count: integer in [1, 8] =5 - number of starting vectors (spread around the circle)`; `show_eigenbasis: boolean =true - afterwards switch the grid to the eigenbasis and show A = PDP⁻¹ as a pure stretch (skipped when A has no eigenbasis)`
  - topics: linear algebra, eigenvectors, matrix powers, diagonalization, eigenbasis, power iteration
  - used in: `eigen-pca/lesson.ts`
- **`pca_3d`**: PCA in 3D: an elongated point cloud, camera orbit, the three principal axes with their share of variance, points dropped onto the PC1-PC2 plane, camera looking straight at it (variance kept). Student turns/tilts the camera and slides the projection.
  - params: `n: integer in [30, 250] =120 - number of points`; `elongation: number in [0.2, 1] =0.55 - spread along the 2nd axis relative to the 1st`; `flatness: number in [0.03, 1] =0.18 - spread along the 3rd axis relative to the 1st (small = a flat pancake that a plane captures well; 1 = no good plane)`; `seed: integer in [1, 9999] =5 - random seed (same seed, same cloud)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: pca, principal component analysis, dimensionality reduction, statistics, eigenvectors, linear algebra, 3d
  - used in: `eigen-pca/lesson.ts`
- **`pca_projection`**: PCA as greatest spread: a line through the mean turns, points project onto it, the variance of the projections is plotted against the angle; the maximum λ₁ is exactly at Σ's top eigenvector, and along + across = total. Student turns the line.
  - params: `correlation: number in [-0.99, 0.99] =0.75 - correlation of x and y (exact in the sample)`; `spread: number in [0.3, 2] =1.1 - standard deviation of x`; `aspect: number in [0.3, 3] =0.8 - standard deviation of y divided by that of x`; `n: integer in [10, 200] =50 - number of points`; `seed: integer in [1, 9999] =11 - random seed (same seed, same cloud)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: pca, principal component analysis, statistics, variance, eigenvectors, covariance, linear algebra
  - used in: `eigen-pca/lesson.ts`
- **`rotation_no_eigen`**: Complex eigenvalues: A is moved into a rotation; its eigenlines merge and vanish, the field of Ax swirls, an orbit v, Av, A²v... circles, and λ = a ± bi = |λ|e^{±iθ} (stretch |λ|, turn θ). Student drags î and ĵ.
  - params: `A: 2x2 matrix in [-3, 3] =[[1,-1],[1,1]] - the (rotation-like) matrix, rows first [[a, b], [c, d]]; complex eigenvalues when (a−d)² + 4bc < 0, e.g. [[0,-1],[1,0]] (turn 90°), [[1,-1],[1,1]] (turn 45°, stretch √2). A matrix with real eigenvalues is shown for contrast`; `show_orbit: boolean =true - draw the orbit v, Av, A²v, ... of one vector`
  - topics: linear algebra, eigenvalues, complex eigenvalues, rotation, eigenvectors
  - used in: `eigen-pca/lesson.ts`
- **`symmetric_ellipse`**: A symmetric S maps the unit circle to an ellipse whose axes are its perpendicular eigenvectors with half-lengths |λ| (why PCA can use eigenvectors). Student drags the axis ends; S stays symmetric.
  - params: `S: 2x2 matrix in [-3, 3] =[[2,1],[1,2]] - a symmetric matrix [[a, b], [b, d]] (if the two off-diagonal entries differ, their average is used). E.g. [[2,1],[1,2]] (λ = 3, 1), [[1.5,0],[0,1.5]] (circle), [[1,2],[2,1]] (λ = 3, -1), [[1,1],[1,1]] (λ = 2, 0: a segment)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: linear algebra, symmetric matrices, eigenvectors, spectral theorem, ellipse, pca
  - used in: `eigen-pca/lesson.ts`, `ft/c/c2_lora.ts`

### mpc

- **`mpc_active_set`**: Be the active-set solver on M4's two-move cart QP, sample by sample along the MPC's own closed loop: choose which limits are held with equality (the working set W, chips in a table); the candidate plan z_W is the cheapest plan on all held lines; the table shows each held limit's multiplier λ (negative: it pulls, let it go) and whether z_W keeps or breaks each other limit. Optimal when nothing is broken and every λ ≥ 0. 'Next sample' moves one sample on and keeps W (warm start); counters compare the changes made with a from-scratch solve. Exact arithmetic on the toy cart.
  - params: `start: integer in [0, 35] =18 - the sample of the closed loop from (4 m, 0) the world starts at (18: optimal W = {v(1 s) ≤ 2, v(2 s) ≤ 2}; 22 drops one, 23 adds the wall)`; `W: text (max 40) ="" - initial working set, row ids separated by commas (e.g. 'v1+,v2+'); '' = nothing held`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, quadratic program, active set, kkt, lagrange multiplier, warm start, solver, control
  - used in: `mpc/m5_solving.ts`
- **`mpc_bars`**: The prediction X = Φx₀ + ΓU of the course’s toy cart (simulation): 10 bars of planned acceleration u_0..u_9 (0.1 s each, held), the predicted speed (running sum) and position (running sum of speeds) with the free response Φx₀ dashed, the weights 9.5..0.5 of each bar in p_10 (the position row of Γ), live v_10 = 0.5 + 0.1Σu and p_10 = 10.2 + 0.01Σ(9.5 − j)u_j, and two goals: at rest at k = 10, at the wall (10 m) and never past it. Start 9.7 m, 0.5 m/s. Student drags the bars.
  - params: `plan: one of zero|dock|early|late|even ="zero" - the bars at the start: 'zero' coast, 'dock' a plan that docks, 'early'/'late' five bars of −1 at the start/end, 'even' −0.5 on every bar`; `story: one of still|early_late ="still" - 'still': show the plan; 'early_late': brake −1 on the first five bars, then move the same braking to the last five (the early run stays faint)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, prediction, state space, discretization, zero-order hold, linear, double integrator
  - used in: `mpc/m2_model.ts`
- **`mpc_car_track`**: World: a nonlinear MPC (Gauss–Newton SQP, horizon 2 s) drives a toy car (kinematic bicycle) along an S road, simulation. Left: the road from above, the driven path, the car, and at an inspected instant the reference points, the guess the QP was linearised around (dotted), what the last QP predicted (dashed) and what that plan really does (thin). Right: lateral error e(t) against a ±15 cm brief and the run’s numbers. One QP built around "straight ahead" (cold) cuts the corners by about 33 cm and slows to 5.1 m/s; one QP around the last plan shifted (warm, the real-time iteration) stays within 9 cm, as good as iterating to convergence. Student switches the guess and the QPs per sample, and drags the inspected instant.
  - params: `guess: one of cold|warm ="cold" - what each sample's first QP is linearised around: 'cold' = straight ahead with no steering or braking from the current state; 'warm' = the last plan shifted by one step (the real-time iteration's guess)`; `iters: one of 1|2|3|conv ="1" - QPs (Gauss–Newton steps) per sample: '1' = real-time iteration, 'conv' = until the step is below 1e-4 (at most 25)`; `t: number in [0, 7.9] =3.2 - the instant [s] whose plan is drawn (the first bend is entered near 2 s, the second near 4.8 s)`; `story: one of drive|still ="drive" - 'drive': the car drives the whole S with its plan drawn live, then the view returns to t; 'still': draw the state at t at once`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, nonlinear mpc, nmpc, real-time iteration, rti, sqp, warm start, path tracking, kinematic bicycle, control
  - used in: `mpc/m8_nmpc.ts`
- **`mpc_dock_horizon`**: World: the docking cart (simulation) with a horizon-N MPC. Top: position against time with the wall; below: the accelerations with the limits. Dashed in a shaded window: the plan made at the last moment the cart could still stop, with its first step and where it ends. Short windows brake gently or not at all and hit the wall; N ≥ 19 (1.9 s) docks with brakes of 1 m/s², N ≥ 40 with 0.5 m/s². Student drags N and switches the brakes.
  - params: `N: integer in [2, 45] =10 - look-ahead in steps of 0.1 s (2–45); with brakes 1 the shortest that docks is 19, with brakes 0.5 it is 40`; `brakes: one of 1|0.5 ="1" - largest deceleration in m/s²: '1' (the course cart) or '0.5' (half as strong)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, model predictive control, horizon, receding horizon, constraints, control
  - used in: `mpc/m1_lookahead.ts`
- **`mpc_explicit_map`**: Explicit MPC on the two-move cart QP: the plane of initial states (p₀, v₀) is cut into critical regions (one active set each, coloured by the limit family that is active; exact polygons). Inside each region the first move is affine in the state, a₁ = K_r x₀ + k_r; along a horizontal slice of the map, a₁(p₀) is a chain of straight pieces with kinks at region boundaries, next to the single straight line of the no-limits law. Drag the slice.
  - params: `story: one of full|setup ="full" - 'full': the map fills in family by family, then the slice sweeps; 'setup': everything shown at once`; `v: number in [0, 2] =0.6 - speed of the slice [m/s] (0.6: motor limit, then the linear law, then braking at the limit; 1.5: speed limit, wall, linear, braking)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, explicit mpc, piecewise affine, critical region, active set, multiparametric, control
  - used in: `mpc/m4_constraints.ts`
- **`mpc_gain_horizon`**: The gain K_N = [k_p, k_v] of an unconstrained MPC on the cart against its horizon N (u_0 = −K_N x_0): with terminal weight P = Q it rises and settles on the LQR gain; with P = P_∞ (LQR cost-to-go) it equals the LQR gain for every N. Static figure.
  - params: `q_v: number in [0, 100] =0 - speed weight q_v in Q = diag(1, q_v) (0 = the docking cost of M1)`; `r: number in [0.01, 100] =0.1 - input weight R = r (0.1 in M1)`; `N_max: integer in [20, 80] =50 - largest horizon shown (steps of 0.1 s)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, lqr, riccati, horizon, terminal cost, control
  - used in: `mpc/m3_cost.ts`
- **`mpc_kalman`**: Scene (simulation): a Kalman filter on the toy cart measured in position only, with 5 cm noise. Speed from differencing two noisy measurements is useless (RMS about 0.8 m/s); the filter, which predicts with the model and corrects with each measurement, tracks it to about 0.12 m/s. Right: one correction as three bells (prediction, measurement, combined): the estimate moves L_p ≈ 0.29 of the way to the measurement. No handles.
  - params: `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, kalman filter, state estimation, noise, observer, control
  - used in: `mpc/m7_disturbances.ts`
- **`mpc_offset`**: World (simulation): the cart parked at a flag in a steady wind its MPC model does not know. The nominal MPC rests short of the flag at e = (d − d̂)/K_p, while each plan (dashed) still expects to get back. Student moves the position weight q (shrinks the offset, never removes it), sets the model’s disturbance d̂ by hand (d̂ = d removes it; the cart then holds a push u_s = −d̂), or lets d̂ be estimated online (offset-free MPC, integral action); the world can change the wind.
  - params: `q: integer in [0, 6] =3 - index of the position weight q in Q = diag(q, 0) on the stops 0.1, 0.2, 0.5, 1, 2, 5, 10 (default 3: q = 1, K_p = 2.79)`; `dhat: number in [-0.6, 0.6] =0 - the hand-set disturbance d̂ in the model [m/s²] (used when estimate is off); the first wind is −0.3`; `estimate: boolean =false - estimate d̂ online from each step’s prediction error (λ = 0.2) instead of using the hand-set value`; `wind: integer in [0, 3] =0 - which wind blows: -0.3, -0.12, 0.2, -0.45 m/s² (negative = headwind)`; `story: one of still|offset ="still" - 'still': draw the run once; 'offset': draw the nominal run, then point at the plan that still expects to reach the flag`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, offset-free, disturbance, integral action, steady-state error, estimation, control
  - used in: `mpc/m7_disturbances.ts`
- **`mpc_pd_compare`**: Static figure (simulation): position against time of the docking cart under a reactive PD controller a = k_p(10 − p) − k_d v, clipped to the brakes. With brakes of 1 m/s²: aggressive gains hit the wall, cautious ones crawl, tuned ones dock in 8.6 s; with brakes of 0.5 m/s² the tuned PD hits. Optionally the docking MPC for comparison (7.3 s; 9.0 s with weak brakes and a 4 s look-ahead). No handles.
  - params: `brakes: one of 1|0.5 ="1" - largest deceleration in m/s²: '1' shows three PD tunings, '0.5' only the tuned one (it was tuned for 1)`; `show_mpc: boolean =false - also draw the docking MPC (horizon 20 steps for brakes 1, 40 for brakes 0.5)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, pid, pd controller, saturation, control
  - used in: `mpc/m1_lookahead.ts`
- **`mpc_qp_plane`**: The cart's MPC cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can be drawn: cost ellipses around the no-limits plan, each limit (motor, speed, wall) a straight line, the feasible polygon, and the best plan where the smallest ellipse touches it (active limits drawn thick). Drag the cart's state (p₀, v₀): the lines slide, the optimum slides along edges; fast and close, the polygon vanishes (no plan). Shows the clipped no-limits plan for comparison. Exact QP on the toy cart.
  - params: `story: one of full|setup ="full" - 'full': the narrated build (cost ellipses, the limits one family at a time, the smallest ellipse touching the polygon, then the state moves); 'setup': everything shown at once at (p0, v0), for a world`; `p0: number in [4, 9.9] =8 - initial position of the cart [m] (its front bumper; the wall is at 10 m, the flag at 9.5 m)`; `v0: number in [0, 2] =0 - initial speed [m/s] (the limit is 2)`; `clip: boolean =true - show the clipped no-limits plan (□) and its cost ellipse, for comparison with the best plan`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, quadratic program, constraints, active set, kkt, feasible set, level sets, control
  - used in: `mpc/m4_constraints.ts`
- **`mpc_receding_loop`**: The receding-horizon loop on the cart docking against a wall (simulation): at every instant the MPC plans N steps (dashed predicted positions; a strip of N planned accelerations), applies only the first, the window slides one step and it re-plans. With N ≥ 19 (about the 2 s it takes to brake from 2 m/s) it docks; shorter horizons hit the wall. No handles.
  - params: `N: integer in [8, 30] =20 - horizon in steps of 0.1 s (20 = 2 s, the time it needs to brake from 2 m/s; 19 still docks, 18 and below hit the wall)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, model predictive control, receding horizon, control, planning
  - used in: `mpc/m1_lookahead.ts`
- **`mpc_replan_push`**: Static figure (simulation): why MPC applies only the first step. A push of +0.3 m/s at t = 1 s; the plan made once at t = 0 and executed blindly hits the wall at 1.92 m/s, while the controller that re-plans every 0.1 s from the measured state docks. No handles.
  - params: `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, receding horizon, feedback, open loop, disturbance
  - used in: `mpc/m1_lookahead.ts`
- **`mpc_shift_tail`**: The shift argument for recursive feasibility in the phase plane (p, v): a terminal-set plan x_0..x_N ending in X_f; one step later the candidate x_1..x_N plus one braking step from x_N, which stays in X_f because X_f is invariant under braking. Toy-cart simulation, static figure.
  - params: `N: integer in [3, 12] =8 - horizon of the terminal-set MPC whose plan is shown`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, terminal set, recursive feasibility, invariant set, control
  - used in: `mpc/m6_feasibility.ts`
- **`mpc_shooting`**: Scene: one 2.5 s horizon of the toy car (kinematic bicycle) entering a bend, solved by Gauss–Newton in single shooting (left: unknowns = inputs, every iterate is one unbroken simulated trajectory, cost 113.9 → 8.39 → 1.55 → 1.52) and multiple shooting (right: unknowns = inputs and interval start states, each interval simulated on its own; coral gaps = violated dynamics, 1.24 m → 2.6 mm → 0.01 mm). Both end at the same plan. Simulation.
  - params: `iters: integer in [1, 4] =3 - Gauss–Newton iterations shown (each is one QP)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, nonlinear mpc, nmpc, single shooting, multiple shooting, gauss-newton, sqp, optimal control
  - used in: `mpc/m8_nmpc.ts`
- **`mpc_soft_limit`**: The cart’s speed over 8 s with a soft speed limit (wall kept hard) after a gust at 3 s: a large slack price (l1 = 1000) follows the hard limit exactly and always has a solution; the hard limit has none for 3 samples (marked); a small price (l1 = 10) treats the limit as a suggestion. Static figure (simulation).
  - params: `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, soft constraints, slack, exact penalty, feasibility, control
  - used in: `mpc/m6_feasibility.ts`
- **`mpc_solver_paths`**: Three QP solver families on M4's plan plane (the two-move cart QP at one state; default 7 m at rest, where both motor limits are active): the active-set method jumps from the no-limits plan onto one limit line, then to the corner (2 changes); the interior-point method walks inside the feasible polygon along the central path (about 10 Newton steps, each a new matrix); ADMM (the OSQP iteration, fixed ρ = 3, no scaling) takes about 25 cheap steps with one matrix factored once, approaching to modest accuracy. Step counters and the cost of one step for each. Exact arithmetic on the toy cart.
  - params: `story: one of full|end ="full" - 'full': the narrated build (plane, then the three paths one after the other); 'end': all three paths drawn at once`; `p0: number in [4, 9.5] =7 - the cart's position [m] (7 m at rest: the motor limits both moves; the optimum is the corner a₁ = a₂ = 1, M4's example)`; `v0: number in [0, 2] =0 - the cart's speed [m/s]`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, quadratic program, active set, interior point, admm, osqp, solver, control
  - used in: `mpc/m5_solving.ts`
- **`mpc_terminal_world`**: World: the docking cart (simulation) in the phase plane (p across, v up), one dot per 0.1 s. Shaded: crash certain (p + v²/2 past the wall) and the trap (crash certain while the horizon-N QP still has a solution). The learner sets N and what the end of the plan must satisfy (nothing, the LQR cost P, a terminal set p + 1.95 v up to 10, or ending at the target). Nothing or the cost alone hit the wall up to N = 18 / 19; the terminal set docks for every N; ending at the target is infeasible at rest until N = 70.
  - params: `N: integer in [2, 80] =5 - look-ahead in steps of 0.1 s (2–80)`; `mode: one of none|cost|set|end ="none" - end of the plan: 'none' (only the limits), 'cost' (+ LQR terminal cost), 'set' (terminal set p + 1.95 v up to 10), 'end' (x_N = target)`; `story: one of trap|plain ="trap" - 'trap': the run unfolds, pausing where the cart enters the trap (the scene); 'plain': everything shown at once (the world)`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, model predictive control, terminal set, terminal cost, recursive feasibility, stability, horizon, control
  - used in: `mpc/m6_feasibility.ts`
- **`mpc_tube`**: Scene (simulation): tube MPC on the toy cart docking at a wall under an unknown bounded push (up to 0.15 m/s²), 12 random histories. Open loop the runs drift apart (4 of 12 cross the wall); with the feedback u = ū − K(x − x̄) they stay inside a tube of ±0.18 m around the plan, but 8 of 12 cross because the plan touches the wall; moving the plan’s wall in by the tube width keeps all 12 off it. No handles.
  - params: `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, robust mpc, tube mpc, disturbance, constraint tightening, control
  - used in: `mpc/m7_disturbances.ts`
- **`mpc_weights`**: The quadratic cost J = Σ (p − 6)² + q_v v² + r a² on the cart (simulation): MPC without limits = the fixed feedback a = −K(x − x_ref). Shows the cart, p(t) with overshoot and arrival time, a(t) against a ±1 m/s² band the controller does not know about, the gain K, and two briefs (fast: by 5 s with < 5 cm overshoot; gentle: |a| < 1, < 5 cm, by 14 s). Student drags the prices q_v (speed) and r (effort) on log sliders.
  - params: `q_v: number in [0.01, 100] =0.01 - price of speed q_v in Q = diag(1, q_v) (log scale 0.01–100): it damps the motion; with q_v near 0 the overshoot is about 26 cm for every r`; `r: number in [0.01, 100] =0.1 - price of effort R = r (log scale 0.01–100): larger r is slower and gentler; the first push is 6·k_p`; `story: one of still|sweep_r ="still" - 'still': draw the run once; 'sweep_r': then sweep r from 0.1 up to 100, down to 0.01 and back (same shape, different pace)`; `briefs: boolean =true - show the two briefs (A fast, B gentle) next to the run’s numbers`; `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, lqr, quadratic cost, weights, tuning, control
  - used in: `mpc/m3_cost.ts`
- **`mpc_zoh_step`**: Static figure (schematic): over one sample the acceleration a_k is held (zero-order hold), so v(t) is a straight ramp from v_k to v_k + Δt a_k and the distance covered (the area under v) is a rectangle Δt v_k plus a triangle ½Δt² a_k. Exact ZOH: p_{k+1} = p_k + Δt v_k + ½Δt² a_k; forward Euler keeps only the rectangle.
  - params: `lang: one of auto|en|zh ="auto" - language of the labels: 'en', 'zh', or 'auto' (the learner's language)`
  - topics: mpc, discretization, zero-order hold, euler, double integrator
  - used in: `mpc/m2_model.ts`

## manim-web extensions (the interaction toolkit)

`packages/manim-web/src/ext/`: the pieces worlds and visuals are built from. The guide with examples is `packages/manim-web/docs/EXTENSIONS.md`, and `packages/manim-web/dev/interact.demos.ts` runs them. Use one only when the action itself is the concept (`docs/lessons/llm-finetuning/INTERACTION-BAR.md`).

| module | what it is | main exports | an example of its use |
|---|---|---|---|
| `affordance` | Affordances for interactive scenes (web extension): make every draggable thing visible and self-explaining without changing the scene itself. | AffordanceOptions, AffordanceLayer | `present/src/cue.ts` |
| `cut` | Cutting: knife strokes and the geometry to split shapes (web extension, see docs/EXTENSIONS.md). | split_polygon, stroke_crosses, split_vmobject, disc_cut_angles, add_cut_angles, sectors_from_angles, sector_polygon, snap_line_through | `pizza-game/lesson.ts` |
| `describe` | Scene description (web extension): what is on screen, as data and as text. Grounds the AI tutor in the current picture ("the red dot at (2, 1)"), gives screen readers a text alternative, and lets tests assert on layout. | ObjectDescription, SceneDescription, mobject_id, describe_scene, describe_text | `present/src/view.ts` |
| `dragdrop` | Drag and drop for mobjects, with drop zones and snapping (web extension, see docs/EXTENSIONS.md). | Region, region_outline, region_contains, region_distance, region_center, region_area, snap_to_grid, snap_to_points | — |
| `export` | Export a scene as MP4 video (with its sounds) or PNG frames, in the browser (web extension). Frames are rendered as fast as the encoder accepts them - faster than real time - using WebCodecs via mediabunny. | ExportOptions, export_video, export_png | `present/src/view.ts` |
| `geom` | 2D geometry for interaction primitives (web extension, see docs/EXTENSIONS.md). | Box, point_in_polygon, polygon_area, polygon_centroid, closest_on_segment, distance_to_segment, distance_to_outline, polygon_distance | — |
| `interact` | Direct manipulation for live scenes (web extension, see docs/EXTENSIONS.md). | Constraint, PointerInfo, AffordanceCtx, CoachPath, InteractiveItem, FeedbackLike, constrain, HandleSpec | `visuals/src/ft/a/chunk_size_recall.ts` |
| `juice` | Game feel for interactive scenes (web extension, see docs/EXTENSIONS.md): snap pulse rings, success particle bursts and counter tweens drawn on an overlay canvas (like AffordanceLayer), and short synthesized WebAudio blips (no audio files). Nothing here knows about goals or scores: a lesson calls `juice.success(p)` when *it* decides something was achieved. | SoundName, set_muted, is_muted, set_volume, set_reduced_motion, prefers_reduced_motion, motion_enabled, ease | `present/src/view.ts` |
| `lint` | Scene linter (web extension): finds layout problems a viewer would notice - objects off screen, labels overlapping each other or crossing lines, text too small or too low in contrast, crowded frames. Used as the quality gate for generated scenes and in the dev overlay. | LintIssue, LintOptions, class_name, is_text, contrast_ratio, label_of, lint_frame, lint_timeline | `present/src/view.ts` |
| `marker` | A marker on a number line (web extension, see docs/EXTENSIONS.md): a pin the learner drags along a NumberLine, with a live value label. A thin convenience over Interaction.add_handle. | MarkerOptions, NumberLineMarker | — |
| `player` | ScenePlayer (web extension): plays a recorded Scene on a canvas. | preload, voice_waits, PlayerOptions, ScenePlayer | `best-angle/theme.ts` |
| `py` | Run manim scene code transpiled from Python (tools/py2js.py) - web extension. | runtime, load_transpiled | — |
| `scrub` | Scrubbable numbers: drag left/right on a number to change it (web extension, see docs/EXTENSIONS.md). Like Bret Victor's "explorable" numbers. | ScrubMath, step_value, scrub_value, ScrubOptions, Scrubber | — |
| `stamp` | Stamps: tap to place copies of a template in an area (web extension, see docs/EXTENSIONS.md). | stamp_position, can_stamp, fade_family, StampOptions, Stamp | — |
| `tokens` | Token builder: tiles (MathTex tokens) dragged from a tray into ordered slots (web extension, see docs/EXTENSIONS.md). It only reports the sequence; grading is the lesson's job (e.g. @mathnim/core's expression grader). | TokenSpec, TokenLike, token_plain, join_plain, join_latex, build_expression, TokenOptions, TokenBuilder | — |
| `widgets` | On-canvas controls drawn as mobjects, so they share the scene's style and appear in exported video (web extension). | Slider | `pizza/lesson.ts` |

## The lesson view (`packages/present`)

How lessons are shown: the essay and game views, text pages, narration, cues and affordances.

| module | what it is |
|---|---|
| `packages/present/src/cue.ts` | One cue at a time. manim-web's AffordanceLayer gives every unused handle a pulsing halo and every kind of item its own lead pulse, so a world with three sliders and a card opens with four rings at once: noisy, and it hides the order of the task. A CueGuide keeps exactly one control "unused" for the layer - the first control of the cue order that the learner has not used yet - and marks the others as used, so they show their plain static ring (handles) or nothing (items), without pulse or label. When the cued control has been used, the cue moves to the next one. The coach demonstration is pointed at the cued control. |
| `packages/present/src/highlight.ts` | A small syntax highlighter for the code in lessons: python, bash, json, yaml and plain text. It tokenizes with ordered sticky regexes (first match wins, unknown characters are plain) and returns one HTML string per line, so a code page can number lines and highlight ranges. Classes: mn-t-c comment, mn-t-s string, mn-t-n number, mn-t-k keyword, mn-t-l literal (True, null), mn-t-b builtin, mn-t-f function / command, mn-t-d decorator, mn-t-a key or flag, mn-t-v variable. |
| `packages/present/src/i18n.ts` | The learner's interface language and the one dictionary of UI strings. Lesson content is L10n data resolved with tr(); the chrome around it (buttons, labels, help) is looked up here by key. The app adds its own entries with define_ui() so the shell, its pages and the lesson view share one table. |
| `packages/present/src/icons.ts` | Line icons for the controls (play, sound, menus, close, arrows): one family, Tabler's outline set (MIT, https://tabler.io/icons), only the ones used, drawn 1.5 px wide at 18 px with round ends, in the colour of the text. The site's own marks (the logo, the account, the crown, the outline's stations, the drawing-sheet corners) are drawn where they are used. |
| `packages/present/src/index.ts` | @mathnim/present - presenters that put a lesson on screen. The essay view (chaptered scenes, checkpoints, explorations, text pages) is LessonView; the game view is the same class with mode 'game'. |
| `packages/present/src/math.ts` | Text with inline TeX (`$...$`) in DOM elements. The TeX renderer is pluggable (the app passes manim-web's MathJax adapter); without one the TeX source is shown. |
| `packages/present/src/narrator.ts` | Narration: pre-generated neural-voice audio (tools/gen_narration.py, edge-tts) with captions timed to its word boundaries. Lines without recorded audio (e.g. freshly generated by the AI) are synthesised on demand by the server (POST /api/tts: the same voice, word boundaries included) when it offers live narration (/api/providers says {tts: true}); otherwise, or when that fails, they are shown as captions only, unless the learner turns on the browser's own voice. |
| `packages/present/src/sketchpad.ts` | Draw-your-prediction overlay: the learner sketches a curve (or places a point) on top of the scene; strokes are kept in data coordinates. |
| `packages/present/src/styles.ts` | Styles for the lesson UI. Colours are CSS variables so a theme (or the host page) can restyle everything; the defaults are the quiet white theme. |
| `packages/present/src/text_pages.ts` | Text pages: read (prose, formulas, code, figures, embedded visuals), derive (a derivation revealed line by line, with "why" notes and a fill-in line) and code (code next to its notes). The HTML is built as strings (blocks_html is pure, so it is tested without a DOM), then hydrate() binds the behaviour: copy buttons, code tabs, footnote links, embedded visuals. LessonView puts the article in its reading column and the outline or progress in the side panel. |
| `packages/present/src/view.ts` | The lesson player UI (plain DOM, no framework): stage + side panel + timeline + mastery. Everything it shows comes from LessonRuntime events. Text steps (read, derive, code) replace the stage with a reading column (text_pages.ts). Every L10n text is shown in the learner's language (ViewOptions.lang, default the interface language of i18n.ts); the UI's own strings come from the i18n dictionary. |

## AI (`packages/ai`)

The tutor that answers questions (text first, a ready-made visual when it explains better), lesson generation, providers.

| module | what it is |
|---|---|
| `packages/ai/src/generate.ts` | Syllabus entry -> complete lesson: plan the steps (predict, watch, practise), then generate and validate each scene with the same pipeline as questions. |
| `packages/ai/src/grade_text.ts` | Free-text answers checked against a rubric's key points by the active model (JSON mode, thinking off): which key points the answer makes, and one sentence of feedback in the learner's language. The lesson view falls back to self-assessment when there is no model or the call fails. |
| `packages/ai/src/index.ts` | @mathnim/ai - answer questions with explanations and validated manim-web scenes. |
| `packages/ai/src/palette.ts` | Colours generated scenes use (white theme). Passed to generated code as `C`. |
| `packages/ai/src/pipeline.ts` | Question -> explanation + validated, explorable scene. generate -> validate (sandbox + linter + numeric checks) -> repair (bounded) -> answer. |
| `packages/ai/src/prompt.ts` | The instructions given to the model. Stable parts (rules, API digest, examples) form a cacheable system prompt; the question and context go in the user message. |
| `packages/ai/src/provider.ts` | Language-model providers. The pipeline only needs `complete()`. |
| `packages/ai/src/recorded.ts` | Recorded answers for the suggested questions of "The best angle to shoot". They are served by MockProvider when no API key is set, and double as the worked examples in the prompt (so they must pass the same validation). |
| `packages/ai/src/recorded_lessons.ts` | A recorded lesson generation (plan + scenes) for "Inscribed angles", so the syllabus -> lesson flow works offline. Served by MockProvider. |
| `packages/ai/src/recorded_text.ts` | Recorded text-only answers: questions that words answer well, with no picture. Offline (no API key) MockProvider serves them, streamed into the "Explain this" chat like a live answer, so the chat can be tried and shown without a model. Each answer exists in both course languages; a question in one language gets the answer in that language. |
| `packages/ai/src/run.ts` | Compile and run model-written scene code against manim-web. Shared by the sandbox worker (validation) and the answer card (display). |
| `packages/ai/src/sandbox.ts` | Validate generated scene code: must build without errors within a time limit, and the linter must find no errors on the settled frames. |
| `packages/ai/src/sandbox.worker.ts` | Validation worker: runs model-written scene code off the main thread, so a crash or an infinite loop cannot freeze the page (the host kills us on timeout). |
| `packages/ai/src/theme.ts` | Scenes generated by the AI use the white theme. |
| `packages/ai/src/tutor.ts` | The fast, personal text answer. It streams within a second or two, long before the animated scene is ready: a one-line diagnosis of what this student is confused about, then a short answer written for them. |
| `packages/ai/src/ui/ask_panel.ts` | "Ask" panel: type a question (or pick a suggestion) and get an explanation with an animated scene that becomes explorable when it ends. |
| `packages/ai/src/visual_plan.ts` | The fast picture for an answer (docs/PLAN.md WP6, "8 s"). Writing scene code from scratch takes 70-110 s; instead a fast model reads the catalog of ready-made visuals (@mathnim/visuals), picks one and fills in its parameters as a small JSON object. The parameters are checked locally (check_params), one repair round-trip fixes what cannot be used, and the scene is built from the registry. When no visual fits (or the plan fails) the caller falls back to the free-form pipeline (pipeline.ts) in the background. |

## Authoring commands

| command | what it does |
|---|---|
| `npm run dev` | npm run dev -w mathnim |
| `npm run build` | npm run build -w mathnim |
| `npm run preview` | npm run preview -w mathnim |
| `npm run test` | npm test --workspaces --if-present |
| `npm run typecheck` | npm run typecheck --workspaces --if-present |
| `npm run regress` | npm run regress -w manim-web |
| `npm run doctor` | npm run doctor -w mathnim |
| `npm run narration` | npm run narration -w mathnim |
| `npm run deploy` | npm run build && cd apps/mathnim && wrangler pages deploy dist --project-name mathnim --branch main --commit-dirty=true |
| `npm run catalog` | npm run catalog -w mathnim -- |
| `npm run dev -w mathnim` | vite |
| `npm run build -w mathnim` | vite build |
| `npm run preview -w mathnim` | vite preview |
| `npm run typecheck -w mathnim` | tsc --noEmit && tsc --noEmit -p server |
| `npm run test -w mathnim` | vitest run --config test/vitest.config.ts |
| `npm run doctor -w mathnim` | Lesson doctor: build every scene of every authored lesson, every recorded AI answer and the recorded generated lesson headlessly, and lint them; lint the text pages and both languages of every lesson (text_lint.ts) and build the visuals embedded in text pages. |
| `npm run snapshots -w mathnim` | Render key frames of every lesson scene to PNG (for design review). |
| `npm run narration -w mathnim` | Collect every narration line of the course (authored lessons + recorded generated lesson, including the triggered lines of worlds) with its audio key, for tools/gen_narration.py. Only "videos" are voiced: scene steps and worlds (core's spoken_strings); text pages and questions have no audio. Bilingual lines give one item per language: the key is computed from the text itself, so each language has its own recording, and `lang` picks the voice. `spoken` is what the voice reads (core's to_spoken: TeX and symbols as words, in that language). |
| `npm run thumbs -w mathnim` | Pre-render the home page's lesson thumbnails (the final frame of each lesson's thumbnail scene) to public/thumbs/<lesson>.<lang>.webp, so the home page shows images instead of running every lesson's first scene in the browser. Lessons without a scene keep their drawn text thumbnail. Also the course pages' feature pictures (public/courses/<course>/...). |
| `npm run manifest -w mathnim` | Writes src/lessons/<course>/manifest.generated.ts for every course whose lessons load on demand (LAZY below): the course as data (units, cards, and per lesson the skills, languages, mode, step kinds) plus one loader per lesson that imports the lesson module and the visual packs it uses. The app shows the course and keeps the learner model with this data, and downloads a lesson's code, visuals and data only when it is opened. Run after adding or changing lessons of such a course: npm run manifest -w mathnim (tools/course_manifest.mjs finds the sources on disk, bundles this file and runs it.) |
| `npm run ft-manifest -w mathnim` | Writes src/lessons/<course>/manifest.generated.ts for every course whose lessons load on demand (LAZY below): the course as data (units, cards, and per lesson the skills, languages, mode, step kinds) plus one loader per lesson that imports the lesson module and the visual packs it uses. The app shows the course and keeps the learner model with this data, and downloads a lesson's code, visuals and data only when it is opened. Run after adding or changing lessons of such a course: npm run manifest -w mathnim (tools/course_manifest.mjs finds the sources on disk, bundles this file and runs it.) |
| `npm run labs -w mathnim` | Converts the hands-on lab tutorials of each course (LAB_COURSES) into page modules: |
| `npm run catalog -w mathnim` | Write docs/CAPABILITIES.md: what the libraries offer a lesson author (step kinds and their fields, text-page blocks, every visual with its parameters and the lessons that use it, the manim-web extensions, the lesson view, the AI pieces and the authoring commands). Everything is read from the code, so the catalog cannot drift from it. |
| `npm run typecheck -w @mathnim/visuals` | tsc --noEmit |
| `npm run test -w @mathnim/visuals` | vitest run |
| `npm run check -w @mathnim/visuals` | Visual checker: for every registered visual and every example (the defaults included), in both themes: check the parameters, build the scene, lint the whole timeline, exercise explore() (drag every handle to the extremes and lint again), check that the declared ids exist, and render a contact sheet. |

Also, without an npm script: `node apps/mathnim/tools/lesson_text.mjs <lesson-id> [zh|en]` (a lesson as the student reads it) and `node apps/mathnim/tools/page_shots.mjs` (drive the running site headlessly and screenshot it; see its header).
