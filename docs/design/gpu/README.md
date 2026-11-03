# The material lab

Every material on its own exact mathematics, rendered by our own small WebGL2 core (`lib/gl.js`) or by Canvas 2D
alone. Each tests itself in the page: `window.__accept()` returns the measured numbers.

```bash
python3 -m http.server 5184 --directory docs/design/gpu      # then open http://localhost:5184/?v=<set>
node docs/design/gpu/tools/shoot.cjs <out> <set> <id,id> 1280 800 1500 2   # headless: run tests, save shots
```

| Set (`?v=`) | What | Where |
|---|---|---|
| `a1` | Interface materials: liquid algebra, semantic zoom, pull a noun out, time as matter, the guess object, certainty, one thing in another view, liquid glass, liquid selection | `m/a1/` |
| `m` | Mathematical objects: vector field as light, linear map as fabric, complex function in cloisonné, surface in plaster and water, Fourier in steel, topology in glass, optimisation swarm, Newton's method, tesseract, Chladni sand | `m/m/` |
| `d` | 2D only (Canvas 2D, fits manim-web as it is): broad-nib pen, folding paper, marbling, engraving, a thread, Galton sand, halftone, area-keeping morph, guilloché, paper layers | `m/d/` |
| `lab` | The first physics round: caustics, soap film, ink in water, liquid metal, iron filings, light particles, reaction–diffusion, loupe | `m/v1/` |

Add `&m=<id>` to see one material full screen, `&lang=en` for English. Contact sheets of every set are in `shots/`.
The reasoning and the measured results are in `docs/design/UI-MATERIALS.md` and `docs/design/MATERIALS-20.md`.
