# MGMT90141 checkpoint (2026-11-06)

**State: all 17 lessons built on the studio demo format; `python3 docs/lessons/mgmt90141/build.py && node apps/mathnim/tools/demo_check.mjs mgmt90141` passes; `npm run typecheck && npm test` pass. Not deployed (Lucas deploys).**

## What is where
- Lessons: `l01_lp_picture.py` ... `l17_drill.py` (one `L_<name>()` each), registered in `build.py` (ORDER, UNITS). `common.py` holds the frame helper, the LP numbers
  (`lp_solve`: solved by the instruments' own engine through `lpnode.cjs`, cross-checked with scipy, shadow prices re-checked by re-solving), the
  paper's z table (`ztable`, `z_from_table`: computed, equal to the printed four-place table), `roll` and `tree_svg` (decision trees), `ptxt` (paper text).
- Instruments (`apps/mathnim/public/frames/mgmt90141/`): `lp_plane` (also lattice mode), `lp_check` (formulation checker; the sentences of a story light up),
  `lp_report` (Excel's sensitivity report beside the plane; every cell moves a slider), `flow_net` (ship / balance / assign / build tables),
  `logic_check`, `payoff_dial`, `evpi_lines`, `bayes_flip`, `tree_roll`, `dot_plot`, `area_table`, `dist_lab`, `normal_area` (reads the paper's table),
  `reg_lab`, `reg_output`, `exam_clock`. Shared: `frames/kit/` (the LP kit was already there; `kit.css` got a phone rule that enlarges SVG text).
- `coverage/decks.md`: every deck item and the step that teaches it.

## Decisions taken (Lucas said: decide, do not ask)
1. **Rounding in the paper's answers.** The paper's own answers round posteriors to two places before using them (0.98, 0.79) and the PDC lecture does the same
   (EVSI 1.73; exact is 1.62). The lessons teach the rounded route as the main line, say what the unrounded route gives, and check numbers with a tolerance that
   accepts both where they differ (EVSI), and the exact route elsewhere (the tree tool accepts either to 0.2%).
2. **Subaru (ii).** Followed the paper (three decimals of the coefficients: 1,085.838). The lesson says that the unrounded income coefficient gives about 1,068.
3. **The deck's vice-president example** prints a bonus of \$12,040 that does not follow from its own sums (b1 = 1114/6046, b0 = -10.164: 11.95). The lesson uses the computed value.
4. **HKBC**: the deck's range for the corporate-policy limit (56 to 116) is not reproduced; the optimum is degenerate and the engine's ranges differ. No question asks for them.
5. **Additional constraints 3-5** were images in WMF format that could not be read; lesson 6 teaches the same big-M idea in its own words.
6. **Integer programs** have no 2025 question and the LP engine is LP-only: the integer numbers come from enumerating the whole-number or yes/no plans (and scipy's `milp` as a check).
7. **The decision-tree picture on a phone** is scaled down (the exam tree is wide). The interactive outline (`tree_roll`) is the phone-friendly form; the drawn tree is for desktop reading.
8. Frames cannot send events to the page (sandboxed, no storage): every instrument holds its own checking; the lessons' number and choice steps are the page-level practice.

## Not checked / open
- The frame sandbox (`sandbox="allow-scripts"`) was verified in headless Chrome only. The engine branch noted the Claude desktop app's pane may block it.
- No narration (not wanted). The margin tutor's suggested questions come from the misconception lists.
- Chinese wording was written natively but not read by a Chinese-speaking reviewer.
