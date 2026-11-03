# What the 2026-11 interface previews taught us

Three previews (展厅, 路线, 镜头) and a tutor sketch (笔) were built in November 2026 from a long design study
(`research.md` here). Judged against the live site, they were not better: one style in three arrangements, figures
cut by automatic crops, decoration back in (crop marks on every picture, shape codes for step kinds, monospace on
Chinese). Lucas: "还差一大截 … 不如之前的 UI." They were discarded; what they taught is kept here. The live site's
language (the engineering sheet, crop marks for focus, the margin tutor, the course map) stays, and improves by
these lessons, one page at a time.

## Keep (each was seen working in a preview, or names a real problem of the live site)

1. **The course page reads as one walk**: before you start (what you need) → the lessons in order → what you can do
   at the end. The cumulative time beside each lesson and each unit ("0:30", "1.5 h") answers "how much is left"
   without a sentence. (路线's course page, the best page of the three.)
2. **In a lesson, you always see where you are**: the step titles of the lesson, past ones dimmed, the current one
   lit, the next one visible. Today it is a tiny "1/14" in the bottom bar.
3. **Pictures must be legible at their size.** A card shows a frame composed for it (thicker strokes, one label,
   no axis clutter), not a shrunken screenshot and not an automatic crop that cuts labels.
4. **One container per relation.** Text sits on the paper, not in a white card on the paper; no card in a card.
5. **Use the width.** At 1440 px the home grid fills only the left half.
6. **One primary action per screen, next to what it acts on.**
7. **Course colours of equal weight** (same OKLCH lightness, different hue), so no course looks more important.
8. **On a phone, the controls live in one reachable place** (from 镜头's bottom "hand"), without fake glass.
9. **The tutor has a voice before you ask** (from 笔): one line in its serif that remembers where you stopped, and
   speaks only when it has something useful to say.
10. **Quiet at rest, clear on touch**: the margin's sheet and the crop marks should not shout before they are used.

## Do not repeat

- Starting from a metaphor (a gallery, a metro, a lens) instead of from a page's actual problems.
- Crop marks on every thumbnail: they mark focus, so they belong on one thing at a time.
- Shapes (▮ ◇ ▯ □ ○) or bar codes that a learner has to learn before they mean anything.
- Monospace with letter-spacing on Chinese text; numbers belong in the text face's tabular figures.
- Blurred "glass" on the web, and pills that look like every other SaaS button.
- Three previews that share everything but the layout: if variants are built again, they must differ in what they
  decide, not in how they arrange the same parts.

## Using research.md

Read sections 1 (Apple, from the sources), 2.2 (learning science), 3.1 (Chinese typography from W3C clreq),
6.1 (what is wrong with the live site) and 9 (misleading metaphors). Treat section 7's numbers as proposals to check
against the live tokens, and leave section 8 (the three directions) and most of section 4 (cases) as background.
Parts outside Apple and W3C were written from memory, as it says.
