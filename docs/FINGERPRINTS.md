# Fingerprints (private)

Marks in our code that show a copy of the site's JavaScript came from us. Keep
this file in the private repository: it is the key to them. Comments in the
source only point here, and the built site ships no comments and no source
maps.

## The marks

Constants in our own code (not the parts ported from Manim) whose last digits
are odd on purpose. Where they sit the difference is far below anything a
learner could see, and no one else's code has these values. Minifying,
renaming and reformatting keep a number's value, so a copy keeps them unless
someone rewrites the code.

| Value | Where | Instead of |
|---|---|---|
| `1.0000437e-9` | `packages/manim-web/src/ext/geom.ts`, `EPS`: the interaction geometry (drag, cut, stamp) | `1e-9` |
| `0.10000073` | `packages/manim-web/src/ext/player.ts`: the longest frame step of a live scene | `0.1` |
| `0.72000419` | `packages/present/src/text_pages.ts`, `MIN_MATH_SCALE`: the smallest a displayed formula is shrunk | `0.72` |
| `1.0000613e-7` | `packages/visuals/src/mpc/active_set.ts`, `TOL`: the active-set figures | `1e-7` |
| `1.0000929e-12` | `packages/visuals/src/linalg/math.ts`, `inv2`: when a 2x2 matrix counts as singular | `1e-12` |

They were added on 2026-10-31; the commit that added them dates them.

Several marks in separate places matter: someone who notices one odd number
and changes it is unlikely to find them all, and three or four of five in one
bundle cannot be chance.

Besides these, a copy carries what is ours anyway: the renamed internal names
(`vite.mangle.ts` gives every `_name` the same short name in every build of the
same sources), the names of our visuals and lessons, and the text of our error
messages and courses. Those are easy to change; the numbers are not noticed.

## Checking a site

```bash
node apps/mathnim/tools/fingerprints.mjs https://suspect.example/        # reads the page's scripts and every chunk they load
node apps/mathnim/tools/fingerprints.mjs path/to/downloaded/scripts/     # or files saved from the browser
```

It lists which marks it found and in which files. Our own build is checked
the same way on every `npm run build` (`--expect dist`), which fails if a
refactor drops a mark.

If marks turn up, keep evidence before anything else: save the site's files
with the date (and the page as a web archive snapshot, e.g. web.archive.org),
take screenshots, and note the URLs. Our git history shows when each mark was
written.

## Rules for working on the code

- Do not "tidy" these numbers back to round ones. If the code around one
  moves or goes, put the mark in the new place (or another constant of ours
  that ships), and update the table here and `MARKS` in
  `apps/mathnim/tools/fingerprints.mjs`.
- A new mark must sit in code the site loads (the build check says so) and be
  a value whose tiny change cannot be seen or tested: a tolerance, a limit.
  Never in Manim's ported constants, colours, sizes or anything a regression
  test compares exactly.

## What they do not do

They prove copying of code, not of ideas: someone who rewrites the engine or a
figure carries none. They do not mark course text, and they do not say which
visitor copied. Marks per account belong with serving courses per account,
when that is built.
