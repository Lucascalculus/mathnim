# MKTG90037 Managing for Value Creation, taught for the exam

A demo course in the studio format (lesson JSON in `apps/mathnim/public/demo/mktg90037/`, entry in
`apps/mathnim/public/demo/courses.json`), written in Python with `docs/lessons/lesson_kit.py`; the figures are
instruments (`docs/lessons/NEXT-LEARNING.md`, read it first). Status: **built 2026-11-06: all 20 lessons (0 to 19), checked with `demo_check`, the pages and the instruments at desktop and phone width. See `CHECKPOINT.md` for what was and was not checked, and the decisions taken.**

Sources (`~/Downloads/MKTG90037/`): the subject guide (`MKTG90037 (2).pdf`) and the decks of weeks 1-4 and 6-11
(there is no week 5 or 12 lecture). Week 11 is the lecturer's exam briefing: it says what the paper looks like,
lists the four exam brands, and has the marking rubric as an image. Text with `pdftotext -layout`; the decks carry
many frameworks as pictures, so look at those pages when a lesson uses one.

## Who it is for, and what they need

- **Who**: a postgraduate student sitting the MKTG90037 final exam (examination period 2-20 November 2026). Not
  assumed to have a marketing degree.
- **What they need most**: the exam is **four long written answers** (20 marks each, 600-750 words, typed in a
  locked Canvas quiz, closed book, no notes). They need (1) each framework understood well enough to explain it
  in their own words, precisely; (2) *brand knowledge in their head* to apply it with, because they cannot look
  anything up; (3) the writing skill: explain, apply, recommend, in the proportions the rubric pays for; (4) to
  connect weeks, since questions combine topics (the lecturer's own sample joins transaction costs, week 8, with
  pricing, week 10).
- A lecture deck does none of these. So the course is built around the learner producing answers.

## The exam (from the Week 11 deck)

Four questions, 20 marks each, 80 marked and scaled to 50. Each has three parts: **Explain** the concept (5),
**Apply** a framework to a real company (10), **Recommend** exactly two things to managers from the analysis (5).
Two questions use a real brand of the student's choice (the assignment company is allowed); two use the named
brands, Lipton Tea Australia, Who Gives a Crap, Hilton Hotel Australia, Coles (Australian market only; these four
are not used in the supplementary exam). No references, data or diagrams needed. The rubric has three levels per
part (exceed, meet, not met): "precise, thorough, clear" for Explain; "comprehensive application to the specific
company, rigorous cause-and-effect analysis, well-reasoned with evidence" for Apply; "realistic, strategic,
actionable, directly follows from the analysis" for Recommend. The lecturer says plainly: do not rely on the
slides; read the recommended readings.

## Structure (by what the learner has to do, not by week)

The weeks group into five movements, so ideas that are examined together are learned together:

0. **The paper**: what a top answer is made of, taken apart sentence by sentence; the four brands in a minute
   each; how the course works.
1. **What value is, and who decides** (week 1, week 4).
2. **How a firm creates it** (weeks 2 and 3).
3. **Creating it with others** (weeks 6, 7, 8).
4. **Measuring and capturing it** (weeks 9, 10).
5. **Putting it together**: connecting weeks, then whole questions on every brand, written and marked.

Every lesson runs the loop of NEXT-LEARNING.md around **a puzzle on a real brand**: touch an instrument, predict,
name the framework, apply it to a brand (fully worked in lesson 1, then faded so the learner does more each time),
meet the neighbour that gets confused with it, recall two older ideas. Each lesson ends with an exam-shaped
Explain / Apply / Recommend that is marked against the rubric.

## Lessons

| # | Slug | The question it answers | Weeks and content it must cover | Instrument (new) |
|---|---|---|---|---|
| 0 | `start` | What does an answer that scores look like? | Week 11: structure, rubric, the four brands, what to read | answer x-ray (a model answer taken apart by sentence type) |
| 1 | `value` | Why does the same product have different value for different people? | W1: customer as the focus (Drucker, Keynes), value is perceived, relative, dynamic; Zeithaml's four meanings (low price; what I want; benefits for price; what I get for what I give); means-end model and the Rokeach values; B2C versus B2B (Smith and Colgate; Ulaga and Eggert); price as the weakest differentiator; the four types (functional, experiential, symbolic, cost); sources of value (product, information, environment, interactions, ownership) | persona value radar; means-end ladder (Place); sources matrix (Place) |
| 2 | `market-orientation` | Do I do what customers say, or what they will want? | W4: market orientation (Kirca et al.), responsive versus proactive, customer-led versus market-oriented, market-driven versus driving markets (deconstruction, construction, functional modification), the market-driven organisation (sensing, linking, bonding), agility, adaptive versus transformative change, the Post-it story | customer-led / market-oriented dial; market-shaping diagram |
| 3 | `service-logic` | Who creates the value: the factory or the customer? | W4: service-dominant logic (Vargo and Lusch), goods versus service logic, the foundational premises, Grönroos "customers create value", value-in-use, unit of analysis | lens toggle on one product (Choose) |
| 4 | `advantage` | Why can this firm do what others cannot, and for how long? | W2: marketing's three eras (Lusch and Webster), from process sequence to value delivery, core competence and VRIN (Prahalad and Hamel), Porter's value chain (insurance, banking), Porter's generic strategies, Ansoff, value disciplines (Treacy and Wiersema), Klarna | value-chain builder; strategy 2×2 and discipline triangle (Place) |
| 5 | `stp` | Who do we serve and how do they see us? | W2: segmentation (Smith), the five tests, bases of segmentation, the efficiency-effectiveness trade-off, targeting, perceptual maps and MDS, positioning on two axes, tracking and repositioning | perceptual map (Place), segment-size dial |
| 6 | `value-proposition` | Can I say what I promise in one sentence? | W2: promise of value, not a slogan; the statement (for, who need, our business, that provides, unlike, this offering); the painting-contractor example; the six properties; the seven critique questions | sentence builder (Place) with a critic |
| 7 | `business-model` | How does the whole business make a promise and a profit? | W3: what a business model is and is not (Teece; DaSilva and Trkman), create, deliver, capture; the nine blocks with their sub-types (segments, channels, relationships, revenue streams including subscription, advertising, freemium, hybrid), key resources, activities, partners, cost structure; the story (Magretta); dynamics (Arsenal) | the canvas (Place), snapshot-to-film timeline |
| 8 | `vpc` | Is what we offer what the customer actually needs? | W3: the Value Proposition Canvas: jobs (functional, social, emotional), pains, gains (required, expected, desired, unexpected), products, pain relievers, gain creators, fit; the link to the four value types | fit board (Connect) |
| 9 | `employees` | How do the people inside create value? | W6: employees' role in value creation, the Strategic Alignment Model (human capital needs, HR system), EPS values, autonomy and value creation, Deloitte's engagement model, engagement versus satisfaction versus commitment (Saks), Gallup Q12, the friction critique, Netflix | alignment chain (Connect), three-way compare |
| 10 | `salesforce` | How do I make people who sell for several brands sell mine? | W6: independent sales forces, Vroom's expectancy theory (expectancy, instrumentality, valence), Tesla's direct channel, incentives, Apple's tiers, make versus buy a sales force (Anderson and Weitz), outcome versus behaviour control, pledges | expectancy product dial (E×I×V) |
| 11 | `community` | What does a firm owe the community, and when does it pay? | W7: philanthropy, CSR, CSV (Porter and Kramer), the CSR paradox and the intention-action gap, the three ways to create shared value (new needs, value chain, clusters; TOMS, Who Gives a Crap, Nespresso), measuring shared value, B Corporations | evolution staircase; value-chain overlay (Place) |
| 12 | `co-creation` | How do customers and partners create value with us? | W8: why firms work with others, the 787, co-creation (Grönroos), the DART model, co-design versus co-production (IKEA), vertical and horizontal, open innovation, lead users (Camembert and liver) | continuum (Dial); DART quad |
| 13 | `make-or-buy` | What do I do myself and what do I buy? | W8: transaction cost theory (Coase), safeguarding, adaptation, measurement costs, opportunism, make versus buy total cost, value chain and outsourcing, the customer interface (Amazon), innovation in relationships | transaction-cost dial (the cross-over) |
| 14 | `firm-value` | How do I know the value was created? | W9: value to the customer and to the firm, EVA (NOPAT, capital employed, WACC), its drivers and limits, the Balanced Scorecard (four perspectives), price wars (Domino's and Pizza Hut) | EVA waterfall; scorecard map |
| 15 | `marketing-metrics` | What do I measure about marketing, and what goes wrong? | W9: why marketing metrics, the funnel, ROMI, the three equities (value, brand, relationship; Interbrand, Volkswagen), CLV and customer equity, measurement issues, the surrogation problem and its three conditions | funnel (Dial), metric-to-strategy connector |
| 16 | `pricing-cost` | Why is price the lever firms use worst? | W10: pricing myths (Hinterhuber), elasticity and its factors, pricing objectives, cost-based pricing (markup, floor, break-even), economies of scale, target costing, learning curve, static and dynamic cost management | elasticity and revenue dial; break-even |
| 17 | `pricing-value` | How do I charge for what it is worth? | W10: new-product pricing (skimming, penetration, line pricing), innovation in pricing, value-based pricing and conjoint, value-in-use, personalised pricing and when it works, arbitrage, variable and odd pricing, reference pricing (isolation, compromise, attraction effects), group pricing, competition and ethics | conjoint game, decoy experiment (Choose) |
| 18 | `combine` | What connects the weeks? | all: the questions that join two or three topics (transaction costs and pricing, employees and value disciplines, co-creation and shared value, metrics and strategy) | concept constellation (Connect), link sentences marked |
| 19 | `exam` | Can I write four of them? | all: full Explain / Apply / Recommend questions on the four brands and one of the student's own, each part marked against the rubric; time plan; mistakes | answer studio |

Week 5 and 12 have no lectures; assessment and group-work pages in the decks are out of scope and noted in
`coverage/`. The week 11 sample question (Hinterhuber and Coase, transaction costs in make-or-buy and pricing) is
the worked example of lesson 19.

## The four brands (a research task before writing)

Lipton Tea Australia, Who Gives a Crap, Hilton Hotel Australia and Coles are examined, so each gets a verified
fact sheet in `brands.md` (what it sells, to whom, its business model, its value proposition, how it treats
employees and community, how it co-creates, what it measures, how it prices) with a source for every fact, and
each lesson's Apply step may pick one. Facts are checked against the company's own and public sources before
they are written; what is the course's own *reading* of a brand through a framework is marked as a reading, not
a fact. The learner can use the same method on their own brand.

## Details and traps to teach on purpose

- Value proposition versus slogan; business model versus strategy; customer-led versus market-oriented; CSR
  versus CSV; engagement versus satisfaction versus commitment; co-design versus co-production; cost-based versus
  value-based pricing; EVA versus accounting profit; metric versus strategy (surrogation).
- Apply means *this company, this evidence, this cause and effect*, not a definition with the brand's name on it.
- Two recommendations, no more: each follows from the analysis and says how and why it would work.

## Build

```bash
python3 docs/lessons/mktg90037/build.py && node apps/mathnim/tools/demo_check.mjs mktg90037
```

`coverage/<lesson>.md` lists, per lesson, every concept, example and name on the decks it covers and the step that
teaches it. Slide order and wording are not kept.
