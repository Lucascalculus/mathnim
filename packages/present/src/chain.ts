// A chain of why, as HTML (the text zone; docs/design/specimen gpu/int/why.js). Every claim carries a hollow ring in
// its margin with a short thread hanging from it: something is folded there. Tapped, its reasons drop out on threads,
// one step in, and the ring fills; a reason has its own ring, down to bedrock: a definition or an assumption ends in
// a ground mark instead of a ring. The threads are drawn by text_wire.ts once the chain is on the page.
//
// Written two ways, both easy for a model to get right: the lesson block { type: 'why', claim, because: [...] }, and
// in any prose (a tutor's answer, a paragraph) a fence:
//   ```why
//   A function differentiable at $x_0$ is continuous there.
//   - the difference is the quotient times $h$, and that tends to 0
//     - the quotient tends to $f'(x_0)$
//       - that is what differentiable means [definition]
//     - a limit of a product is the product of the limits [assumption]
//   - so there is no jump at $x_0$
//   ```
import { t } from './i18n';
import type { Lang } from '@mathnim/core';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** One step of a chain, its text already HTML. */
export interface ChainNode { html: string; kind?: 'definition' | 'assumption'; because?: ChainNode[] }

/** The chain's HTML: the claim and everything folded under it. */
export function chain_html(claim: ChainNode, lang?: Lang): string {
  return `<div class="mn-chain">${node(claim, 0, lang)}<svg class="mn-chain-threads" aria-hidden="true"></svg></div>`;
}
function node(n: ChainNode, depth: number, lang?: Lang): string {
  const kids = n.because ?? [];
  const mark = kids.length
    ? `<button type="button" class="mn-chain-ring" aria-expanded="false" aria-label="${esc(t('why_ask', undefined, lang))}"></button>`
    : n.kind ? '<span class="mn-chain-ground" aria-hidden="true"></span>' : '<span class="mn-chain-leaf" aria-hidden="true"></span>';
  const kind = n.kind ? `<span class="mn-chain-kind">${esc(t(`why_${n.kind}`, undefined, lang))}</span>` : '';
  const under = kids.length ? `<div class="mn-chain-under" hidden>${kids.map((k) => node(k, depth + 1, lang)).join('')}</div>` : '';
  return `<div class="mn-chain-node${depth ? '' : ' mn-chain-claim'}">${mark}<div class="mn-chain-text">${n.html}${kind}</div>${under}</div>`;
}

/**
 * A ```why fence's body as a chain: the first line that is not a list item is the claim; `- ` lines are reasons,
 * two spaces (or a tab) deeper for each step in; a reason ending in [definition] / [assumption] (or [定义] / [假设])
 * is bedrock. `html` turns a line's text into HTML (TeX, emphasis). Null when there is no claim.
 */
export function parse_chain(body: string, html: (s: string) => string): ChainNode | null {
  let claim: ChainNode | null = null;
  const stack: { depth: number; n: ChainNode }[] = [];
  for (const raw of body.split('\n')) {
    if (!raw.trim()) continue;
    const m = /^(\s*)[-*•]\s+(.*)$/.exec(raw.replace(/\t/g, '  '));
    if (!m) {
      if (!claim) { claim = { html: html(raw.trim()) }; stack.splice(0, stack.length, { depth: -1, n: claim }); }
      continue;
    }
    if (!claim) continue;
    const depth = Math.floor(m[1].length / 2);
    let text = m[2].trim(), kind: ChainNode['kind'];
    const k = /\s*[[［【](definition|assumption|def|定义|假设)[\]］】]\s*$/i.exec(text);
    if (k) { kind = /^(definition|def|定义)$/i.test(k[1]) ? 'definition' : 'assumption'; text = text.slice(0, k.index).trim(); }
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1].n, n: ChainNode = { html: html(text), ...(kind ? { kind } : {}) };
    (parent.because ??= []).push(n);
    stack.push({ depth, n });
  }
  return claim;
}
