# Lesson design: "The pizza deal" as a game (grades 7-9)

Same learning goals and misconceptions as `pizza-circle-area.md`; the difference
is that the student *does* almost everything. Every level is a world
(`kind: 'explore'` with goals, detectors, stars and lines, see
`packages/core/src/world.ts`), shown by the game view (`mode: 'game'`). Scenes
are short cut-ins (under 10 s). Target: an action every 10-20 seconds.

**Character:** Marco, who runs the pizzeria (avatar 🧑‍🍳). He speaks in short
reactions; numbers are on screen, not in his lines (lines are pre-recorded,
so they must not depend on variant values).

**Mechanics used** (manim-web `ext/`, WP1): drag and drop into zones, the knife
(cut gesture), stamps, a number-line marker, tokens into slots, scrubbable
numbers, the existing radius handle and sliders; juice for snaps and wins.

## Levels

| # | Level | What the student does | Goal (to move on) | Stars | Detectors -> misconception | Replaces |
|---|-------|----------------------|-------------------|-------|-------------------------|----------|
| 0 | **The bet** | Drags a coin onto "one 16-inch", "two 8-inch" or "same amount" | Coin placed | none (a prediction) | coin on "two 8-inch" or "same" -> linear-scaling (not graded, it is a bet) | deal scene + prediction |
| 1 | **Cover the pizza** | Stamps radius-squares (r x r tiles) over a pizza; a meter shows how much cheese is covered; then drags a marker on a number line 0-6: "how many radius-squares of cheese?" | Marker within 2.9-3.4 | 3: within 0.1 of π; 2: within 0.25; 1: otherwise | estimate >= 3.8 -> four-squares; <= 2.2 -> "only the diamond inside" | measure scene, bounds scene, "how many squares" question |
| 2 | **The knife** | Cuts the pizza with knife strokes through the centre (each cut = 2 more slices), drags the first slices into a row (they snap tip-up / tip-down), then the "more slices" and "line up" sliders finish it | 24+ slices, fully lined up | by time: < 60 s 3, < 120 s 2 | none | slice explore |
| 3 | **Build the formula** | The row is now a rectangle labelled "height r" and "width = half the crust". Drags tokens (π, r, r, 2, x, ½) into A = [ ] x [ ] | πr·r (or πr², any order) | 3: first try; 2: second; 1: later | 2πr·r or 2πr -> circumference-area; r·r -> "forgot π" | what shape + area expression + why-πr² scene |
| 4 | **The dough machine** | Drags the rim of a pizza (radius handle); live readouts: diameter, area, "x the 8-inch" | Area exactly 2x the 8-inch (within ±0.05) | precision: ±0.02 3, ±0.04 2 | releases at diameter 16 while aiming for 2x -> linear-scaling | sketch A(r), grow explore, scale-factor question |
| 5 | **Rush hour** | Three customers each order an area ("I want 113 square inches"); the student scrubs the diameter and serves; a till shows profit or loss | All three served within 5% | mistakes: 0 -> 3, 1 -> 2, more -> 1 | diameter = the radius the area needs -> diameter-radius | pizza-shop practice |
| B | **Boss: settle the bet** | Drags the small pizzas onto the big one one by one; each "pours" its cheese in (the big one fills a quarter each time). After two it is only half full | All four poured, big pizza full | none | none | verdict scene |

Between levels: quick checks graded for mastery (a number question "radius x3 ->
area x?" after level 4; "area of a 10-inch pizza" is part of rush hour). The
remediation scenes (squares, fence vs paint) stay as branch-only steps and are
triggered by findings, not only by wrong answers.

## Lines (Marco)

Short, spoken once each (`once: true`). `enter` = on arrival, `idle` = after 15 s
without action, events and findings as named.

**0 The bet**
- enter: "Friday night. Same price: one big sixteen-inch pizza, or two eight-inch ones. Put your coin on the better deal."
- event coin_placed: "Bet placed. Let's find out who's right."
- idle: "Just drag the coin onto the offer you'd pick."

**1 Cover the pizza**
- enter: "How much cheese is on a pizza? Let's measure it in squares as wide as the radius."
- event tile_placed (first): "One radius-square. Keep going - cover the cheese."
- event covered_half: "Halfway there."
- idle: "Tap the pizza to drop another square."
- enter_estimate (event marker_shown): "Now, how many squares of cheese is that, really? Drag the marker."
- finding four-squares: "Careful - four squares cover the whole box around the pizza, corners and all."
- finding diamond: "Two squares is only the diamond inside. There's more cheese than that."
- goal: "A bit more than three squares. Remember that number."

**2 The knife**
- enter: "Here's a knife. Cut straight through the middle."
- event first_cut: "Two slices. Keep cutting."
- event many_slices: "Now line them up - tip up, tip down."
- idle: "Draw a line across the pizza to cut it."
- goal: "Look at that. Almost a perfect rectangle."

**3 Build the formula**
- enter: "A rectangle's area is width times height. So what's the area of this one?"
- finding circumference-area: "That's the crust - how far around. We want what's inside."
- finding forgot-pi: "Close. How wide is the rectangle, exactly?"
- goal: "Pi r squared. You built it yourself."

**4 The dough machine**
- enter: "My dough machine makes any size. I need a pizza with exactly twice the cheese of an eight-inch."
- event released (ratio near 4): "Whoa, that's four times the cheese!"
- finding linear-scaling: "Twice as wide isn't twice the pizza. The area grows in both directions."
- idle: "Drag the edge of the pizza in or out."
- goal: "Eleven and a bit inches. Not sixteen!"

**5 Rush hour**
- enter: "Rush hour! Each customer wants a certain amount of pizza. Set the size and serve."
- event served_ok: "Perfect."
- event served_big: "Too big - we're giving away cheese."
- event served_small: "Too small - they'll be hungry."
- finding diameter-radius: "Pizza sizes are diameters. The radius is half of that."
- goal: "Rush hour done. Not bad at all."

**B Settle the bet**
- enter: "Back to Friday's deal. Pour the small pizzas into the big one."
- event poured_two: "Two small pizzas... and the big one is only half full."
- event poured_all: "Four small pizzas fill one big one."
- goal (bet was big): "You called it. The big pizza is twice the food."
- goal (bet was small or same): "So the big pizza is twice the food of the two small ones."
- (the goal line is chosen by the world state `bet`)

## Checks (lesson_doctor)

- Every world must be winnable by a scripted player (doctor v2, WP10).
- Every line has a recording (`npm run narration`).
- Levels 1-5 each need at least 3 student actions before the goal can be reached.
