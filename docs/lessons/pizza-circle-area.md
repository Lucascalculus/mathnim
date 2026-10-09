# Lesson design: "The pizza deal" - why a circle's area is πr²

**Level:** grades 7-9. **Length:** about 15 minutes. **Prerequisites:** area of
a rectangle; circumference C = 2πr (reminded in the lesson).

## Why this topic

* Students meet A = πr² as a formula to memorise; almost none can say where it
  comes from. The slice-and-rearrange argument is short, visual, and becomes
  *convincing* only when you can push the number of slices up yourself - an
  ideal interactive moment.
* A real decision frames it: *one 16-inch pizza or two 8-inch pizzas for the
  same price?* Most people (adults too) think "same amount". The answer - the
  big one is **twice** as much food - is the payoff of understanding that area
  grows with the *square* of the radius.

## Learning goals

1. Explain why A = πr²: slices of a circle rearrange into a shape that tends to
   a rectangle with height r and width half the circumference, πr.
2. Estimate a circle's area as "a bit more than 3 radius-squares".
3. Predict how area changes when the radius is scaled (×k -> ×k²) and use it to
   compare pizzas.
4. Compute areas of circles and half circles from a radius or a diameter.

## Misconceptions targeted

| id | Belief | Where it shows up | Response |
|----|--------|-------------------|----------|
| linear-scaling | Double the radius -> double the area | pizza prediction, "radius ×2 -> area ×?", sketch of A(r) as a straight line | remediation scene: 1 square -> 4 squares when the side doubles |
| circumference-area | The area is 2πr (confuses the crust with the pizza) | formula question | remediation scene: the fence around vs. the paint inside |
| diameter-radius | Uses the diameter as r (a 16-inch pizza has r = 16) | pizza area question | feedback: pizza sizes are diameters |
| four-squares | The circle is 4 radius-squares (the square around it) | squares prediction | shown by the bounds scene (between 2 and 4) |

## Flow (predict -> observe -> explain, then practise)

| # | Step | Kind | Time | What happens |
|---|------|------|------|--------------|
| 1 | The deal | scene | 0:35 | Two offers: one 16-inch pizza vs two 8-inch pizzas, same price |
| 2 | Your bet | predict (choice + confidence) | 0:45 | Which is more pizza? Options tagged with linear-scaling; no answer yet ("hold that thought") |
| 3 | Measuring a circle | scene | 0:40 | A circle of radius r and one "radius-square" r×r |
| 4 | How many squares? | predict (choice) | 0:30 | How many radius-squares make the circle's area? 2 / a bit more than 3 / exactly 4 / 6 |
| 5 | Between 2 and 4 | reveal scene | 0:45 | The square around the circle is 4 r², the diamond inside is 2 r²: the answer is in between, about 3.14 |
| 6 | Slice the pizza | explore | 1:45 | Sliders: number of slices (4-48) and "rearrange" (0-1). Goal: many slices, fully rearranged - it looks like a rectangle |
| 7 | What shape? | check (choice) | 0:30 | With very many slices the shape becomes...? (rectangle) |
| 8 | Its size | check (expression) | 1:00 | Height r, width half the crust. Write the area. (πr²; wrong 2πr -> circumference-area) |
| 9 | Why πr² | scene | 0:50 | The rectangle labelled r and πr; A = πr · r = πr² ≈ 3.14 r² (matches step 5) |
| 10 | Area vs radius | predict (sketch) | 0:45 | Sketch A as a function of r (a straight line is the linear-scaling misconception) |
| 11 | Grow the circle | explore | 1:30 | Drag the rim to change r; live r, A, and "× original area". Goal: find the radius that doubles the area (r ≈ 1.41) |
| 12 | Scale factor | check (number) | 0:30 | Radius ×2 -> area ×? (4; 2 -> linear-scaling) |
| 13 | Back to the deal | scene | 0:50 | Four 8-inch pizzas fit (by area) in one 16-inch: the big one is twice the two small ones |
| 14 | Your pizza shop | practice (number, variants) | 1:00 | A d-inch pizza: area in square inches (diameter given! -> diameter-radius) |
| 15 | Half a pizza | practice (expression) | 0:45 | Area of a half circle of radius r (πr²/2) |
| 16 | Wrap-up | scene | 0:30 | Three things to remember |
| - | Remediation: squares | branch | 0:30 | Side ×2 -> 4 squares |
| - | Remediation: fence vs paint | branch | 0:30 | 2πr is the length around, πr² the space inside |

Scenes and narration total about 6 minutes; predictions, explorations and
practice about 9 minutes.

## Interaction points

* Two on-canvas sliders (slices, rearrange) with affordances; the shape updates live.
* Direct manipulation of the circle's rim (radius), constrained to a ray.
* A sketch of A(r) on real axes, graded for shape (curving up vs straight).
* Predictions with confidence; misconception-tagged options; hint ladders on
  every check; a variant pizza question each time.

## Visual language

White theme. Pizza: cheese #F2C063, crust #C98A2E, pepperoni #D9573B. Slices
alternate two warm tones so the two halves of the crust stay visible after
rearranging (top edge = one half, bottom edge = the other). Radius in accent
blue, areas as translucent fills, numbers in MathTex.
