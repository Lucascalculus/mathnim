// A figure as a zone of its page (page.ts). It tells the page which nouns it shows (its things whose role is a noun,
// and the nouns inside a formula's pieces), turns to the page's attention (the things of the noun the hand is on
// stay, the rest recede, over a fifth of a second), shows the page's light when it falls on one of its things, and
// tells the page which noun the learner's pointer is on. The tutor's acts reach it through the page (acts.ts).
//
//   const z = figure_zone(player, { id: 'throw' });
//   page.attach(z);
import { check_act, manifest_of, type Act } from './acts';
import type { NounAnchor, ActResult, Attention, Page, PageAct, Zone, ZoneManifest } from './page';
import type { FigurePlayer } from './player';
import { untracked } from './state';
import { noun_of, type Thing } from './thing';

/** Kinds that name or number a thing rather than draw it: a word points at what it names, not at its number. */
const WORDY = /^(readout|label|text|caption|legend|list|light|handle)$/;

export interface FigureZone extends Zone {
  readonly player: FigurePlayer;
}

export function figure_zone(player: FigurePlayer, o: { id?: string; kind?: 'figure' | 'world' } = {}): FigureZone {
  const fig = player.scene;
  let page: Page | null = null;
  let lit: string | null = null;
  const off: (() => void)[] = [];
  const shown = (t: Thing) => untracked(() => t.visible()) && t.box.w > 0;
  const anchors = (): NounAnchor[] => {
    // (a figure whose canvas has left the page - an answer written again - shows nothing any more)
    if ((player.canvas as HTMLCanvasElement).isConnected === false) return [];
    const out: NounAnchor[] = [];
    for (const t of fig.registry.all()) {
      if (!shown(t)) continue;
      for (const n of t.noun_pieces?.() ?? []) out.push({ noun: n.noun, id: t.id, size: n.box.w * n.box.h });
      if (WORDY.test(t.kind)) continue;
      const n = noun_of(untracked(() => t.role_of?.() ?? t.role));
      if (n) out.push({ noun: n, id: t.id, size: t.box.w * t.box.h });
    }
    return out;
  };
  const shows = (noun: string) => anchors().some((a) => a.noun === noun);
  const zone: FigureZone = {
    id: o.id ?? 'figure',
    kind: o.kind ?? (fig.sims.length ? 'world' : 'figure'),
    player,
    anchors,
    attend(a: Attention) {
      // the hand on a noun this figure shows: the figure turns to it; on any other (or none): it turns back
      const noun = a.hover && shows(a.hover) ? a.hover : null;
      if (noun) {
        fig.focus.set(noun);
        void player.tween(fig.focus_k, 1, 0.18);
      } else if (fig.focus.peek()) void player.tween(fig.focus_k, 0, 0.22).then(() => { if (fig.focus_k.peek() === 0) fig.focus.set(null); });
      // the page's one light: shown here when it falls on one of this figure's things, put out when it moves away
      const here = a.light && a.light.zone === zone.id ? a.light.id : null;
      if (here && here !== lit) void player.act({ op: 'point', id: here });
      else if (!here && lit) fig.hands().light.level.set(0);
      lit = here;
    },
    manifest: (): ZoneManifest => manifest_of(fig),
    act(a: PageAct): ActResult {
      const act = { ...a } as unknown as Act;
      delete (act as { zone?: string }).zone;
      // (a noun named instead of a thing: its most particular thing here)
      if ((a.op === 'point' || a.op === 'note') && !a.id && a.noun) {
        const best = anchors().filter((x) => x.noun === a.noun).sort((p, q) => (p.size ?? 0) - (q.size ?? 0))[0];
        if (!best) return { ok: false, why: `this figure does not show '${a.noun}'` };
        (act as { id: string }).id = best.id;
      }
      const why = check_act(fig, act);
      if (why) return { ok: false, why };
      void player.act(act);
      return { ok: true };
    },
    describe: () => fig.describe(),
    joined(p: Page) {
      page = p;
      // the learner's pointer on a thing that shows a noun: the page hears it (and every zone answers)
      const c = player.canvas as HTMLCanvasElement;
      if (typeof c.addEventListener !== 'function') return;
      // (on the canvas's own box, which also holds its DOM mirror: the mirror's words lie over the canvas and take the
      // pointer where they are, so the canvas alone would not hear it there)
      const box: HTMLElement = c.parentElement ?? c;
      const move = (e: PointerEvent) => page?.hover(fig.noun_at(player.point_of(e)), zone.id);
      const leave = () => { if (page?.attention.from === zone.id) page.hover(null); };
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerleave', leave);
      off.push(() => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave); });
    },
    dispose() {
      for (const f of off.splice(0)) f();
      fig.focus_k.set(0);
      fig.focus.set(null);
      page = null;
    },
  };
  return zone;
}
