# Text markup: what any text in Mathium can hold

One page for whoever writes text for a page (a person, the course generator, the margin tutor). Every piece below
works in any prose: a lesson's `p` block, a caption, a tutor's answer. Each is checked and has a plain fallback, so a
mistake shows as plain text, never as a broken page. Design: `docs/design/ENGINE-ZONES.md` (the text zone),
`docs/design/specimen` (the experiments they come from).

| You want | Write | The learner sees |
|---|---|---|
| a word in the colour of its thing in the figure | `[cost](noun:cost)` | the word in the noun's colour; touching it lights its thing in the figure on the page |
| a term the reader may not know | `[convex](def: a set that holds every segment between two of its points)` | a dotted term; tapped, the definition opens right after it on a faint ground and the rest of the sentence steps down (a definition may hold definitions) |
| a number the reader can drag | `{{n = 3, 1..12}}` or `{{rate = 0.5, 0..2, 0.1}}` (value, range, step) | a glass number; drag it sideways (or arrow keys) |
| a number computed from those | `{{= 2.5*n}}` or `{{= 2.5*n, 2}}` (2 decimals) | it follows as you drag, every digit a wheel |
| why something is true | a ```` ```why ```` fence (below) | the claim with a hollow ring; tapped, its reasons drop on threads, down to a definition or an assumption |
| a derivation | a ```` ```steps ```` fence (below) | written line by line, each line coming down out of the one above, every line checked |
| what each part of a formula means | a ```` ```parts ```` fence (below) | the formula; tapped, each part lifts on a card with its meaning |
| more, for who wants it | a ```` ```details Title ```` fence (below) | a title; tapped, the rest unfolds like folded paper |
| a source | `[^key]` (and a `cite` block with that key) | a small number; tapped, the source condenses as glass beside it |

Also: `$inline TeX$`, `$$display TeX$$`, `**bold**` (the one key idea), `*italic*`, `` `code` ``, `[text](https://…)`.

```why
A function differentiable at $x_0$ is continuous there.
- the difference is the quotient times $h$, and that tends to 0
  - the quotient tends to $f'(x_0)$
    - that is what differentiable means [definition]
  - a limit of a product is the product of the limits [assumption]
- so there is no jump at $x_0$
```
The first line is the claim. Each `- ` line is a reason; two spaces deeper is a reason for the reason. End a chain at
bedrock with `[definition]` or `[assumption]` (`[定义]` / `[假设]`). At most three deep.

```steps
% nouns: x_0 = value
2x + 3 = 11
2x = 8        % subtract 3 from both sides
x = 4         % divide both sides by 2
```
One complete TeX formula per line, 2 to 8 lines, one change per line; `%` and a few words for what was done. The
optional first line `% nouns: x_0 = value, f = function` draws those symbols in their noun's colour.

```parts
P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}
P(A\mid B): how likely A is, now that B is seen
P(B\mid A): how likely B is if A is true
P(A): how common A is before any evidence
P(B): how common the evidence is
```
The formula on the first line; then each part as it is written in the formula, a colon, and what it means.

```details Why the gradient is held by the active constraint
At the optimum the cost cannot fall along the wall.

$\nabla J + \lambda \nabla g = 0,\ \lambda \ge 0$
```
The title on the fence line; each paragraph of the body is one sheet of the fold.

## In lesson data

The same pieces as blocks (`packages/core/src/content.ts`): `{ "type": "why", "claim", "because": [{ "text", "kind"?,
"because"? }] }`; `{ "type": "steps", "lines": [{ "tex", "why"? }], "nouns"? }`; `{ "type": "math", "tex", "parts": [{
"tex", "says" }] }`; `{ "type": "details", "summary", "blocks" }`. Inline pieces (nouns, definitions, numbers) go in
any text string.

## Rules of use

- One of each where it helps; a page is not a showcase. A definition only for a term this reader may not know; a
  chain of why only for a claim a reader would doubt; numbers to drag only where "what if it were bigger?" is the
  point.
- Nouns: only the nouns the page's figures draw (their roles), so the colour means the same thing in both.
- Never instructions in the text ("tap the ring", "drag the number"): the page shows what can be done.
