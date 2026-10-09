// The course-wide decision map: from a requirement to a method. Nodes appear as
// the course unlocks them (`upto`), some are highlighted, a case can be traced
// along a `path`, and a lesson's one-line "how to choose" card is shown below.
// A figure (no handles): the questions on it are answered in the lesson.
import { Arrow, Create, FadeIn, Indicate, LaggedStart, Scene, Succession } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, group, label, LANG_SPEC, pick, resolve_lang, seg, type Lang } from './kit';
import { CARDS, COL_X, HEADERS, HEADER_Y, LESSONS, NODES, lesson_index, node_list, type LessonId, type MapNode } from './map_data';

export interface DecisionMapParams extends Record<string, unknown> {
  upto: string;
  highlight: string;
  path: string;
  card: string;
  lang: string;
  show_out_of_scope: boolean;
}

const NODE_H = 0.56;

export const decision_map = define_visual<DecisionMapParams>({
  name: 'decision_map',
  summary: 'The fine-tuning course decision map: evals, context baseline, fixed labels, then knowledge / behaviour / capability / efficiency branches down to methods (RAG, SFT, DPO, RLVR, distillation...). Shows the nodes unlocked up to a lesson, highlights nodes, traces a case path, and shows a lesson\'s one-line rule. A figure, no handles.',
  topics: ['fine-tuning', 'llm', 'decision', 'rag', 'sft', 'dpo', 'rlvr', 'distillation', 'how to choose'],
  params: {
    upto: { type: 'enum', values: [...LESSONS], default: 'F1', doc: 'show the nodes taught up to this lesson (A1, A2, A2b, B1-B3, F0, C1-C3, D1, D2a, D2b, D3, D4, E1-E3, F1; D2 = D2b); later nodes are faint empty boxes' },
    highlight: { type: 'text', max_length: 120, default: '', doc: "node ids to highlight, comma separated, e.g. 'K2,K3' (ids: 0 1 T ENC 2 K1-K5 B1 B2 B3 R C1-C4 E1-E3 S X V; a 'DM-' prefix is fine)" },
    path: { type: 'text', max_length: 160, default: '', doc: "a case's route, lit node by node in order, e.g. '0,1,T,2,K1,K2,K3'" },
    card: { type: 'enum', values: ['', ...LESSONS], default: '', doc: "show this lesson's one-line 'how to choose' rule under the map ('' for none)" },
    lang: LANG_SPEC,
    show_out_of_scope: { type: 'boolean', default: true, doc: 'note that multimodal fine-tuning is out of scope' },
  },
  examples: [
    {},
    { upto: 'A1', card: 'A1', lang: 'zh' },
    { upto: 'A2', highlight: 'K2,K3', card: 'A2' },
    { upto: 'F1', path: '0,1,T,2,K1,K2,K3', lang: 'zh' },
    { upto: 'E1', highlight: 'C1,C2', card: 'E1', lang: 'zh', show_out_of_scope: false },
  ],
  // 'path' and 'card' are also named when those parameters are set
  ids: ['map'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const upto = lesson_index(p.upto);
    const open = (n: MapNode) => lesson_index(n.lesson) <= upto;
    const card = p.card ? CARDS[p.card as LessonId] : null;
    return build(lang, open, new Set(node_list(p.highlight)), node_list(p.path), card, p);
  },
});

function build(lang: Lang, open: (n: MapNode) => boolean, hl: Set<string>, route: string[], card: { en: string; zh: string } | null, p: DecisionMapParams): Scene {
  class DecisionMap extends Scene {
    override construct() {
      const c = palette();
      const by_id = new Map(NODES.map((n) => [n.id, n]));
      const visible_ids = new Set(NODES.filter(open).map((n) => n.id));
      const shapes = new Map<string, any>();

      const node_mob = (n: MapNode) => {
        if (!visible_ids.has(n.id)) {
          const b = box(n.x, n.y, n.w, NODE_H, { stroke: c.faint, fill: c.bg, width: 2 });
          return group(b);
        }
        const strong = hl.has(n.id);
        const b = box(n.x, n.y, n.w, NODE_H, { stroke: strong ? c.accent : c.muted, width: strong ? 4 : 2, fill: strong ? c.accent : c.bg, fill_opacity: strong ? 0.1 : 1 });
        const id = n.id === 'ENC' ? '' : n.id.length === 1 && /[0-9TSXV]/.test(n.id) ? '' : n.id;
        const text = id ? `${id}  ${pick(lang, n.en, n.zh)}` : pick(lang, n.en, n.zh);
        const t = fit(label(text, 22, c.ink, { muted: id ? [id] : [] }), n.w - 0.24, NODE_H - 0.14).move_to([n.x, n.y, 0]);
        return group(b, t);
      };

      // ---- edges (drawn first, under the boxes)
      const edge = (a: number[], b: number[]) => seg(a, b, c.muted, 2, 0.8);
      const arrow = (a: number[], b: number[]) => Arrow([a[0], a[1], 0], [b[0], b[1], 0], { color: c.muted, stroke_width: 3, buff: 0, max_tip_length_to_length_ratio: 0.25, tip_length: 0.16 } as any);
      const N = (id: string) => by_id.get(id)!;
      const right = (n: MapNode) => [n.x + n.w / 2, n.y];
      const left = (n: MapNode) => [n.x - n.w / 2, n.y];
      const top_edges = group(
        arrow(right(N('0')), left(N('1'))),
        arrow(right(N('1')), left(N('T'))),
        arrow(right(N('T')), left(N('ENC'))),
        arrow([N('T').x, N('T').y - NODE_H / 2], [N('2').x, N('2').y + NODE_H / 2]),
      );
      const yes = label(pick(lang, 'yes', '是'), 22, c.muted).move_to([(right(N('T'))[0] + left(N('ENC'))[0]) / 2, N('T').y - 0.36, 0]);
      const no = label(pick(lang, 'no', '否'), 22, c.muted).move_to([N('T').x + 0.32, (N('T').y + N('2').y) / 2, 0]);
      // gap type fans out to the four columns
      const fan = group(...HEADERS.map((h) => edge([N('2').x, N('2').y - NODE_H / 2], [COL_X[h.col], HEADER_Y + 0.22])));
      const headers = group(...HEADERS.map((h) => label(pick(lang, h.en, h.zh), 26, c.ink, { weight: 'BOLD' }).move_to([COL_X[h.col], HEADER_Y, 0])));
      // column spines
      const spines = group(...(['K', 'B', 'C', 'E'] as const).map((col) => {
        const ns = NODES.filter((n) => n.col === col);
        const y0 = HEADER_Y - 0.2, y1 = Math.min(...ns.map((n) => n.y));
        return edge([COL_X[col] - 1.68, y0], [COL_X[col] - 1.68, y1]);
      }));
      const ticks = group(...NODES.filter((n) => n.col).map((n) => edge([COL_X[n.col!] - 1.68, n.y], [n.x - n.w / 2, n.y])));
      // every weight-changing path ends in data -> constraints -> verify
      const bus_y = -2.3;
      const bus = group(
        edge([COL_X.K, bus_y], [COL_X.E, bus_y]),
        ...(['K', 'B', 'C', 'E'] as const).map((col) => edge([COL_X[col], Math.min(...NODES.filter((n) => n.col === col).map((n) => n.y)) - NODE_H / 2], [COL_X[col], bus_y])),
        edge([N('S').x, bus_y], [N('S').x, N('S').y + NODE_H / 2]),
        arrow(right(N('S')), left(N('X'))),
        arrow(right(N('X')), left(N('V'))),
      );
      for (const n of NODES) shapes.set(n.id, node_mob(n));
      const row = (ids: string[]) => group(...ids.map((id) => shapes.get(id)));
      const top = row(['0', '1', 'T', 'ENC']);
      const gap = row(['2']);
      const cols = (['K', 'B', 'C', 'E'] as const).map((col) => row(NODES.filter((n) => n.col === col).map((n) => n.id)));
      const bottom = row(['S', 'X', 'V']);
      const note = p.show_out_of_scope
        ? fit(label(pick(lang, 'Multimodal: out of scope', '多模态：不在本课范围'), 22, c.muted), 2.5).move_to([5.55, -2.78, 0])
        : null;

      const map = group(top_edges, yes, no, fan, headers, spines, ticks, bus, top, gap, ...cols, bottom, ...(note ? [note] : []));
      map.name = 'map';

      this.play(LaggedStart(FadeIn(top), Create(top_edges), FadeIn(yes), FadeIn(no), { lag_ratio: 0.4 }), { run_time: 1.6 });
      this.play(FadeIn(gap), Create(fan), FadeIn(headers), { run_time: 1.2 });
      this.play(Create(spines), Create(ticks), LaggedStart(...cols.map((g) => FadeIn(g, { shift: [0, 0.15, 0] })), { lag_ratio: 0.25 }), { run_time: 2.2 });
      this.play(Create(bus), FadeIn(bottom), ...(note ? [FadeIn(note)] : []), { run_time: 1.2 });
      this.add(map);

      const lit = [...hl].filter((id) => visible_ids.has(id) && shapes.has(id));
      if (lit.length) this.play(...lit.map((id) => Indicate(shapes.get(id), { color: c.accent, scale_factor: 1.06 })), { run_time: 1 });

      const steps = route.filter((id) => visible_ids.has(id) && shapes.has(id));
      if (steps.length) {
        const marks = steps.map((id) => {
          const n = by_id.get(id)!;
          return box(n.x, n.y, n.w + 0.12, NODE_H + 0.12, { stroke: c.gold, width: 5, fill_opacity: 0, radius: 0.16 });
        });
        this.play(Succession(...marks.map((m) => Create(m, { run_time: 0.45 }))), { run_time: 0.5 * marks.length });
        const trail = group(...marks);
        trail.name = 'path';
        this.add(trail);
      }

      if (card) {
        const lid = p.card as string;
        const text = fit(label(`${lid}  ${pick(lang, card.en, card.zh)}`, 26, c.ink, { muted: [lid] }), 13.2, 0.5);
        const panel = box(0, -3.52, Math.min(13.8, text.width + 0.6), 0.62, { stroke: c.gold, width: 3, fill: c.gold, fill_opacity: 0.1 });
        text.move_to([0, -3.52, 0]);
        const cardg = group(panel, text);
        cardg.name = 'card';
        this.play(FadeIn(cardg, { shift: [0, 0.2, 0] }), { run_time: 1 });
      }
      this.wait(card ? 1.5 : 2.5);
    }
  }
  return new DecisionMap();
}
