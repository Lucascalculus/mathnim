# Twenty hard materials, ten chosen (2026-11-03)

Lucas asked for the hardest next-generation materials and animations: twenty proposed, the ten most artistic
chosen, each with acceptance criteria, then built one by one. They live in `docs/design/gpu/` and run on our own
small WebGL2 code (no library). Serve the folder and open `index.html`:
`python3 -m http.server 5184 --directory docs/design/gpu`.

Each one has to keep the specimen's law (`docs/design/NEXT.md`): **a material means one exact thing, in every
course, and means what it means in life.** Beauty that means nothing is decoration and does not pass.

## The twenty

| # | Material / animation | The mathematics it carries | Why it is hard |
|---|---|---|---|
| 1 | **Caustics** under rippling water | Change of variables: brightness = 1/\|det J\| of the light map | A wave PDE on the GPU, a refracted light mesh, area ratios per fragment, energy conservation |
| 2 | **Soap film** between two rings | Minimal surfaces (the catenoid) and when they stop existing | Solving the catenoid, spectral thin-film interference, draining, a physical burst |
| 3 | **Ink in water** (stable fluids) | Incompressible flow: the Helmholtz projection, div u = 0 | Semi-Lagrangian advection, a pressure solve every frame, subtractive pigment mixing |
| 4 | **Liquid metal** | A Gaussian mixture: blobs merge into one peak exactly when d ≤ 2σ | A mirror material needs an environment, analytic normals, mode counting |
| 5 | **Iron filings** | A vector field: each filing is a tangent | Tens of thousands of shaded instances, torque dynamics, a moving magnet |
| 6 | **Light particles** that draw a shape | Sampling: Langevin dynamics follow the score ∇log p (the idea under diffusion models) | 262 144 particles on the GPU, a density from a signed distance field, additive light in a dark tray |
| 7 | **Reaction–diffusion** as letterpress | Local rules make global pattern; the (F, k) parameter plane | Thousands of PDE steps per second, a relief lit like paper, a live parameter map |
| 8 | **Dispersive glass loupe** | A lens is a local linear map: magnification is its Jacobian | Refraction through a height field, spectral dispersion, Fresnel, a focused spot on the paper |
| 9 | **Plaster world** in real light | The "物" material made physical: one light, soft shadows whose penumbra grows with distance | Ray-marched signed distance fields, soft shadows, ambient occlusion, subsurface wrap |
| 10 | **Diffraction foil** | The grating equation d(sin θᵢ + sin θₒ) = mλ; frequency made visible | Integrating over the spectrum per pixel, grooves that encode a figure, tilt with the hand |
| 11 | Ripple-tank interference | Superposition; the double slit | A clean wave equation with absorbing borders |
| 12 | Cloth as least squares | Springs are residuals; the cloth settles at the least-squares fit | Position-based dynamics on the GPU, collisions |
| 13 | Sand with an angle of repose | Probability is amount; a histogram builds itself | A granular automaton that looks like sand, not pixels |
| 14 | Sumi ink on rice paper | Diffusion along fibres; anisotropy | Fibre fields, Kubelka–Munk pigment layers |
| 15 | Curl-noise smoke | Divergence-free fields from a potential | Volumetric shading of particles |
| 16 | Frost growth (DLA) | Random walks and fractal dimension | Millions of walks, crystal shading |
| 17 | Depth-of-field bokeh | Focus as attention; the circle of confusion | Physically sized blur, ordered compositing |
| 18 | Marbling (ebru) | Exact, invertible, area-preserving maps | Composing maps on the GPU without loss |
| 19 | Moiré | Beat frequency: two gratings make a slow third | Alias-free line rendering at any scale |
| 20 | Signed-distance level sets | Constraints as intersections: max of SDFs | Smooth booleans, contour extraction, morphing |

## The ten chosen, and why

Chosen for artistic strength first, then for how many courses the meaning serves:
**1 caustics, 2 soap film, 3 ink in water, 4 liquid metal, 5 iron filings, 6 light particles, 7 reaction–diffusion,
8 glass loupe, 9 plaster world, 10 diffraction foil.**

Left for later: 11 to 20. They are strong ideas but either less beautiful at a glance (moiré, ripple tank), close to
a chosen one (smoke is close to ink, bokeh to the loupe), or better as a second round (marbling, cloth, sand).

## Acceptance criteria

Every material must pass **the common bar** and **its own test**. The page runs both and prints the result under
each tile (`window.__accept()` returns them all).

### The common bar

1. **Meaning.** One sentence says what it means, and a 12-year-old could repeat it after playing.
2. **Truth.** Every frame is a true state of the model, not an interpolation of pictures. A measured number proves it
   (its own test below).
3. **Quiet at rest.** With no input it settles and stops drawing (no endless loop); touch wakes it. Every motion can
   be interrupted.
4. **Speed.** At least 50 frames a second at 1440 × 900 on a laptop GPU while active; a phone gets a lower
   resolution, never a broken picture.
5. **Palette.** Only the site's pigments: paper, ink, graphite, cobalt, ochre, teal, violet, viridian, vermilion.
   No glow as decoration, no gradient as decoration. The night tray is allowed as a window.
6. **One hand.** It answers a single drag or tap, obviously: a child knows what to do in five seconds.
7. **Taste.** Fresh eyes do not call it trendy, tacky, a screensaver, or "AI style".

### Each one's own test

| # | Test (measured in the page) | Passes when |
|---|---|---|
| 1 | Total caustic light on the floor ÷ light arriving (flat water = 1) | Within 3 % while the water moves |
| 2 | The film breaks at separation h/R | 1.3255 ± 0.01 (the catenoid limit); colours follow Newton's series: black film is dark, thick film goes through white, yellow, magenta, blue |
| 3 | Mean \|div u\| after the projection ÷ before | Below 5 % |
| 4 | Peaks counted on the surface vs theory for two equal blobs | Equal at every separation tried (one peak iff d ≤ 2σ) |
| 5 | Mean angle between filings and the field after settling | Below 3° |
| 6 | Share of particles within 2s of the outline (s = the band width) | 95.4 % ± 3 % (a Gaussian band) |
| 7 | Spots setting vs stripes setting, told apart by the pattern's own measure | Spots: many round blobs; stripes: long connected bands; no NaN after 10 000 steps |
| 8 | Measured magnification at the lens centre vs the lens's computed Jacobian | Within 3 % |
| 9 | Penumbra width at two occluder heights | Grows with height, ratio within 25 % of the geometric ratio |
| 10 | Wavelength seen at a given tilt vs the grating equation | Within 5 nm |

## Lucas's correction for the second round (2026-11-03)

"第二轮，最好是 generalizable 的材质，是为 UI 设计服务的。而不是为了某个专业问题服务。"

So the ten new materials are **interface materials**: what a panel, a control, focus, a transition, progress or
feedback is made of, usable in every course. Their mathematics is how they behave (physics that makes them feel
real), not a lesson topic. The second pass of the first ten also asks of each one: what would it be in the
interface?
