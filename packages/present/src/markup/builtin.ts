// The text tools Mathium has, as entries (markup/registry.ts). Their rendering is math.ts's (it decides the order in
// which a text's pieces are turned into HTML); their behaviour on the page is text_wire.ts's. What is here is what
// every guide says about them and how a malformed use is caught. A tool added later is its own file with its own
// define_markup, and brings its renderer (`html`, `pattern`).
import { define_markup } from './registry';

// (two languages, as everywhere; written here so the server's bundle does not bring the engine's text module)
const t = (en: string, zh: string) => ({ en, zh });

const SRC = 'packages/present/src/markup/builtin.ts';
const V = '0.2.1';

define_markup({
  name: 'noun', form: 'inline', order: 10, zones: ['text'], maturity: 'stable', since: V, from: 'int/brush', source: SRC,
  says: t('a word in the colour of its thing in the figure', '和图里的东西同色的词'),
  syntax: '[cost](noun:cost)',
  demo: (lang) => (lang === 'zh' ? '[代价](noun:cost)是一个碗：[小车](noun:cart)离目标越远，它越高。' : 'The [cost](noun:cost) is a bowl: the further the [cart](noun:cart) is from the goal, the higher it is.'),
  shows: 'the word in the noun\'s colour; touching it lights its thing in the figures on the page, and touching the thing lights the word',
  rules: ['only the nouns the page\'s figures draw (their roles), so the colour means the same thing in both'],
  // (the tutor does not see the figures' roles yet, so it is not told about nouns)
  audience: ['author', 'gallery'],
});

define_markup({
  name: 'def', form: 'inline', order: 20, zones: ['text'], maturity: 'stable', since: V, from: 'int/stretch', source: SRC,
  says: t('a definition that opens in its sentence', '在句子里原地展开的定义'),
  syntax: '[convex](def: a set that holds every segment between two of its points)',
  demo: (lang) => (lang === 'zh' ? '一个[凸](def: 任意两点之间的线段都还在集合里)的集合，从里面看不到任何凹进去的地方。' : 'A [convex](def: holding every segment between two of its points) set has no dent you could see from inside it.'),
  shows: 'a dotted term; tapped, the definition opens right after it on a faint ground and the rest of the sentence steps down (a definition may hold definitions)',
  rules: ['only for a term this reader may not know', 'the first time the term appears, instead of a sentence of definition that interrupts the argument'],
  tutor: 'A term the student may not know: [term](def: what it means in a short phrase). The page opens it in the sentence.',
  lesson: 'a definition in its sentence: [term](def: what it means), opened in place when the learner taps the term\n(use it the first time a term appears, instead of a sentence of definition that interrupts the argument)',
});

define_markup({
  name: 'number', form: 'inline', order: 30, tutor_order: 65, zones: ['text', 'page'], maturity: 'stable', since: V, from: 'int/tangle', source: SRC,
  says: t('a number in a sentence the learner drags', '句子里学生可以拖动的数'),
  syntax: '{{n = 3, 1..12}}', example: '{{rate = 0.5, 0..2, 0.1}}', note: 'value, range, step',
  demo: (lang) => (lang === 'zh' ? '你买 {{n = 3, 1..12}} 杯，每杯 2.5 元：一共 {{= 2.5*n, 2}} 元。' : 'You buy {{n = 3, 1..12}} cups at $2.50: that is {{= 2.5*n, 2}} dollars.'),
  shows: 'a glass number; drag it sideways (or arrow keys); a figure bound to it follows',
  rules: ['only where "what if it were bigger?" is the point of the paragraph', 'the numbers of one page share their names (a figure can bind to them)'],
  tutor: 'A quantity that changes with another (what if it were bigger?): {{n = 3, 1..12}} is a number the student drags,\n  {{= 2.5*n, 2}} follows it (2 decimals). Plain names, * for times.',
  lesson: 'and numbers the learner drags: {{n = 3, 1..12}} (value, range) with {{= 2.5*n, 2}} following it (2 decimals),\nwhere "what if it were bigger?" is the point of the paragraph',
});

define_markup({
  name: 'computed', form: 'inline', order: 31, zones: ['text', 'page'], maturity: 'stable', since: V, from: 'int/tangle', source: SRC,
  says: t('a number computed from the ones the learner drags', '由学生拖动的数算出来的数'),
  syntax: '{{= 2.5*n}}', example: '{{= 2.5*n, 2}}', note: '2 decimals',
  demo: (lang) => (lang === 'zh' ? '边长 {{s = 2, 1..9}} 的正方形，面积 {{= s^2}}，对角线 {{= s*sqrt(2), 2}}。' : 'A square of side {{s = 2, 1..9}} has area {{= s^2}} and diagonal {{= s*sqrt(2), 2}}.'),
  shows: 'it follows as you drag, every digit a wheel',
  rules: ['names are words (cups, rate, n); + − * / ^ ( ), sqrt, abs, round, min, max, log, exp, sin, cos'],
  tutor: null, lesson: null,
});

define_markup({
  name: 'why', form: 'fence', fence: 'why', order: 40, zones: ['text'], maturity: 'stable', since: V, from: 'int/why', source: SRC,
  says: t('a claim with its chain of reasons, each opened on demand', '一个论断和它的一串理由，每一层按需展开'),
  syntax: '```why … ```',
  example: '```why\nA function differentiable at $x_0$ is continuous there.\n- the difference is the quotient times $h$, and that tends to 0\n  - the quotient tends to $f\'(x_0)$\n    - that is what differentiable means [definition]\n  - a limit of a product is the product of the limits [assumption]\n- so there is no jump at $x_0$\n```',
  shows: 'the claim with a hollow ring; tapped, its reasons drop on threads, down to a definition or an assumption',
  rules: ['the first line is the claim; each `- ` line is a reason; two spaces deeper is a reason for the reason', 'end a chain at bedrock with `[definition]` or `[assumption]` (`[定义]` / `[假设]`); at most three deep', 'only for a claim a reader would doubt'],
  tutor: 'A "why" question with a chain of reasons: end with a why block. The first line is the claim; each "- " line a reason;\n  two more spaces for a reason of a reason; end at [definition] or [assumption]; at most three deep.\n```why\nThe ball stops at the wall.\n- the valley\'s lowest point is outside the fence\n  - the fence is a constraint: a plan outside it is not allowed [definition]\n- along the fence the cost falls toward the wall\n```',
  check: (body) => {
    const lines = body.split('\n').filter((l) => l.trim());
    if (!lines.length || /^\s*[-*•]\s/.test(lines[0])) return 'the first line is the claim (not a "- " reason)';
    const reasons = lines.filter((l) => /^\s*[-*•]\s/.test(l));
    if (!reasons.length) return 'no reasons: each reason is a "- " line under the claim';
    const deep = reasons.find((l) => /^(\s*)/.exec(l.replace(/\t/g, '  '))![1].length > 4);
    return deep ? `at most three deep: "${deep.trim().slice(0, 40)}" is deeper` : null;
  },
});

define_markup({
  name: 'steps', form: 'fence', fence: 'steps', order: 50, zones: ['text', 'figure'], maturity: 'stable', since: V, from: 'rare/algebra', source: SRC,
  says: t('a derivation written line by line, every line checked', '一行一行写出的推导，每一行都检查'),
  syntax: '```steps … ```',
  example: '```steps\n% nouns: x_0 = value\n2x + 3 = 11\n2x = 8        % subtract 3 from both sides\nx = 4         % divide both sides by 2\n```',
  shows: 'written line by line, each line coming down out of the one above, every line checked',
  rules: ['one complete TeX formula per line, 2 to 8 lines, one change per line; `%` and a few words for what was done', 'the optional first line `% nouns: x_0 = value, f = function` draws those symbols in their noun\'s colour'],
  tutor: 'Steps: when the answer is a short derivation - solving, simplifying, expanding, factoring, differentiating, rearranging\na formula, putting numbers into a formula, a unit conversion, balancing a reaction, showing two logic formulas are\nequivalent - end the answer with a steps block. The page turns it into one formula that changes line by line, and checks every line. It\ndoes not count toward the 80 words.\n```steps\n2x + 3 = 11\n2x + 3 - 3 = 11 - 3   % subtract 3 from both sides\n2x = 8\nx = 4                 % divide both sides by 2\n```\n- 2 to 6 lines. Each line is one complete TeX formula, without $ and without \\\\ or &.\n- One change per line: do the operation on one line, simplify on the next. Keep the relation (=, <, \\to) in its place.\n- After a line, `%` and at most 8 words in the answer\'s language saying what was done to get it (the first line has none).\n- Every line must be exactly right: it is checked, and a wrong line is shown to the student as doubtful.\n- Chemistry in \\ce{...}; words and units in \\text{...}; logic with \\neg \\land \\lor \\to.',
  check: (body) => {
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !/^%\s*(?:nouns?|名词)\s*[:：]/i.test(l))
      .map((l) => l.replace(/(^|[^\\])%.*$/, '$1').trim()).filter(Boolean);
    if (lines.length < 2) return 'at least 2 lines (one formula per line)';
    if (lines.length > 8) return `at most 8 lines (${lines.length} written)`;
    const two = lines.find((l) => /\\\\|(^|[^\\])&/.test(l));
    return two ? `one formula per line, without \\\\ or &: "${two.slice(0, 40)}"` : null;
  },
});

define_markup({
  name: 'parts', form: 'fence', fence: 'parts', order: 60, zones: ['text', 'figure'], maturity: 'stable', since: V, from: 'int/explode', source: SRC,
  says: t('a formula taken apart block by block: pulled up or tapped, each block moves apart onto its own card with what it means; a card that holds more splits into its blocks\' cards in turn', '一块一块拆开的公式：往上拉或点一下，每一块移开到自己的卡片上，引线指向它的意思；装着更多的卡片点开后分裂成几张卡片'),
  syntax: '```parts … ``` (```parts 3d: in depth, for the one formula a lesson is about)',
  example: '```parts\nL = \\frac{1}{n}\\sum_i (\\hat y_i - y_i)^2\n\\frac{1}{n}\\sum_i: **average** over all n points\n(\\hat y_i - y_i)^2: point i\'s miss, squared: big misses count far more\n  \\hat y_i - y_i: **miss** prediction minus truth\n```',
  shows: 'the formula, a lever at its right; pulled up, tapped or moved on the lever, its outer blocks move apart onto cards, each with a leader to its name and meaning; tap a card that holds more (two sheets thick) and it splits into its blocks\' cards. With 3d the camera turns and the cards lift off the paper instead',
  rules: ['the formula on the first line; then each block as it is written in the formula, a colon, and what it means', 'a block is whatever means one thing: one symbol or several terms (the error, the average, the share of the whole)', 'a block with a name says it first in bold: **prior** belief in A before B', "indent a block two spaces under the block it is part of: the big picture first, the inside on demand", 'write the formula in the form whose blocks carry the idea (−b/2a ± …, not one bar over everything)', 'a line % nouns: A = hypothesis, B = evidence colours those symbols as their nouns, in the formula and in the words', '```parts 3d for the one formula a lesson is about, at most one per lesson; every other formula in the plane'],
  tutor: 'What the blocks of a formula mean: a parts block, the formula on the first line, then "block: meaning" lines (a name first in bold, if the block has one); a block is one symbol or several terms that mean one thing, and a block indented two spaces is part of the block above it.\n```parts\n\\theta \\leftarrow \\theta - \\eta\\,\\nabla L(\\theta)\n\\theta - \\eta\\,\\nabla L(\\theta): **step** one step downhill from where you are\n  \\eta: **learning rate** how big a step\n  \\nabla L(\\theta): **gradient** the direction the loss rises fastest\n```',
  check: (body) => {
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const tex = (lines[0] ?? '').replace(/^\$+|\$+$/g, '');
    const parts = lines.slice(1).filter((l) => !l.startsWith('%')).map((l) => /^\$?(.+?)\$?\s*[:：]\s+(.+)$/.exec(l)).filter((m): m is RegExpExecArray => !!m);
    if (!tex || !parts.length) return 'the formula on the first line, then "piece: meaning" lines';
    const flat = (s: string) => s.replace(/\s+/g, '');
    const missing = parts.map((m) => m[1].trim()).find((p) => !flat(tex).includes(flat(p)));
    return missing ? `"${missing}" is not written that way in the formula` : null;
  },
});

define_markup({
  name: 'details', form: 'fence', fence: 'details', order: 70, zones: ['text'], maturity: 'stable', since: V, from: 'motion/fold', source: SRC,
  says: t('more, folded under the sentence, for who wants it', '折在句子下面的更多内容，给想看的人'),
  syntax: '```details Title … ```',
  example: '```details Why the gradient is held by the active constraint\nAt the optimum the cost cannot fall along the wall.\n\n$\\nabla J + \\lambda \\nabla g = 0,\\ \\lambda \\ge 0$\n```',
  shows: 'a title; tapped, the rest unfolds like folded paper',
  rules: ['the title on the fence line; each paragraph of the body is one sheet of the fold'],
  audience: ['author', 'gallery'],
  check: (body, head) => (!head?.trim() ? 'the title goes on the fence line: ```details Title' : !body.trim() ? 'nothing folded under the title' : null),
});

define_markup({
  name: 'footnote', form: 'inline', order: 80, zones: ['text'], maturity: 'stable', since: V, from: 'motion/condense', source: SRC,
  says: t('a source, on glass beside its mark', '一个出处，显示在标记旁的玻璃上'),
  syntax: '[^key]', note: 'and a `cite` block with that key',
  shows: 'a small number; tapped, the source is on glass beside it',
  audience: ['author', 'gallery'],
});

define_markup({
  name: 'prose', form: 'inline', order: 5, also: true, zones: ['text'], maturity: 'stable', since: '0.2.0', source: SRC,
  says: t('TeX, emphasis, code and links in any sentence', '任何句子里的公式、强调、代码和链接'),
  syntax: '`$inline TeX$`, `$$display TeX$$`, `**bold**` (the one key idea), `*italic*`, `` `code` ``, `[text](https://…)`',
  shows: 'typeset maths, the one key idea in bold, code, links',
  demo: (lang) => (lang === 'zh' ? '**关键的一点**加粗，公式 $x^2 + y^2 = r^2$，代码 `solve(A, b)`。' : 'The **one key idea** in bold, a formula $x^2 + y^2 = r^2$, code `solve(A, b)`.'),
  tutor: null,
  lesson: 'inline TeX between $...$ (escape a literal dollar as \\$), **bold**, *italic*, `code`',
});
