# Coverage: every concept, example and number of the decks, and the step that teaches it

Slide order and wording are not kept; this is the floor the course has to cover. Lesson ids are `mgmt90141-<slug>`; the step ids are the
`id`s in `l<NN>_*.py`.

## Week 1 (introduction, LP)
| On the deck | Where |
|---|---|
| Subject outline, assessments (assignments 15% / 30% / 5%, exam 50%), textbooks, communication, group process, marking criteria, sources | out of scope (administration and the group assignments); the exam's structure is in lesson 16 (`clock`, `plan`) |
| Business analytics: descriptive, predictive, prescriptive; where each is in the subject | lesson 1 `name` (table of kinds) |
| LP: resources (4M + T), decision variables, objective, constraints, general form, non-negativity, deterministic, divisibility, proportionality | lesson 1 `name` |
| Shader Electronics: the four steps, the model, the graphical solution, corners, shadow price on 240, ranges 200-300 and 6.67-10 | lesson 1 (`touch`, `sweep`, `corners`, `walls`), lesson 3 (`idea`, `predict_up`, `predict_past`, `names`) |
| Special cases: infeasible, unbounded, alternative optima, redundant | lesson 1 `slack`, `cases` |
| Solution methods: graphical, simplex (corner points), LINDO, Excel Solver; how to set a model up in Solver and LINDO | lesson 2 `sheet`; lesson 3 `traps` (where the report comes from) |
| Sensitivity: reduced cost, allowable increase/decrease, shadow price, range of optimality and of feasibility | lesson 3 `names`, `which`, `exam` |
| Consolidated Electronics (a minimisation with at-least limits) | lesson 2 `story`, `write`, `picture`, `cheapest`, `one_less` |
| Failsafe Electronics workshop (four products, minimum production) | lesson 2 `failsafe` |

## Week 2 (LP applications)
| Warner Sisters (media, budget) | lesson 4 `budget` |
| Market Survey Inc (quotas, shares) with its four what-ifs | lesson 3 `msi`, `msi_lo`, `msi_c12`, `msi_hi`, `msi_cost` |
| International City Trust (portfolio, shares) | lesson 4 `share` |
| HKBC tellers (full- and part-time, lunch, 50% policy) | lesson 4 `workshop`, `hkbc`. The deck's sensitivity answers for this model (range 56-116 on the policy limit) are not reproduced: the optimum is degenerate and the engine's ranges differ from the printed Solver output, so no question asks for them |
| Benson Electronics (make or buy) | lesson 4 `workshop` (solved: cost and plan) |
| Past papers: Tucker (overtime), Grand Strand (blending), Epsilon (shift scheduling) | lesson 4 `overtime`, `blend`, `schedule` |

## Week 3 (network models)
| Transportation: general model, balance, Excel layout | lesson 5 `ship`, `greedy`, `name` |
| Unbalanced cases: dummy destination / dummy origin; workshop 1 (four factories, three warehouses) | lesson 5 `dummy`, `wk_cost` |
| Assignment: general model, five workers, five tasks; the TV station workshop with two dummy slots | lesson 5 `assign`, `asg`, `tv` |
| Transshipment: the table with warehouses on both sides, the buffer; the exam's Herman problem | lesson 5 `exam`, `herman`, `answer` |

## Week 4 (integer programming) and "additional constraints"
| Pure, binary, mixed integer; GIN / INT in LINDO, int / bin in Solver | lesson 6 `names` |
| Princess Brides: the LP, rounding, the best integer plan | lesson 6 `round`, `round_it` |
| University projects (eight binary variables, requirements) | lesson 6 `uni` |
| Quemo Chemical (selection, dependence) | lesson 6 `yesno`, `quemo`, `quemo_npv` |
| Martin-Beck (fixed-charge location) | lesson 6 `fixed`, `link`, `mb` |
| Additional constraints 1 and 2 (if-then, at most one) | lesson 6 `yesno` (checker), `extra` |
| Additional constraints 3 to 5 (warehouse throughput with penalty) | lesson 6 `extra`. The three constraint sets were images (WMF formulas) that could not be read; the lesson teaches the same big-M linking idea in its own words and does not reproduce the deck's exact lines |

## Week 5 (decision analysis)
| Elements: alternatives, states of nature, consequences, payoff | lesson 9 `table` |
| PDC; optimistic, conservative and regret criteria | lesson 9 `table`, `predict`, `name`, `regret_med` |
| Southland (workshop 1), Hudson (costs) | lesson 9 `south`, `south_reg`, `hudson`, `hudson_con`; lesson 10 `hudson_evpi` |
| Expected value, EVwPI, EVwoPI, EVPI with probabilities; PDC (0.8, 0.2), Hudson (0.2, 0.5, 0.3) | lesson 10 `ball`, `name`, `evpi_pdc`, `hudson_evpi` |
| Influence diagrams | not drawn: no exam question asks for one; lesson 9 `table` lays out the same three elements (alternatives, states, payoffs) as a table |

## Week 6 (decision analysis with sample information)
| Bayes' theorem: prior, conditional, joint, posterior, the three steps | lesson 11 `flip`, `predict`, `name`, `pu` |
| The tree for PDC with research, rollback, EV of the study | lesson 11 `pdc` |
| EVSI (and efficiency) | lesson 11 `evsi` |
| Risk profile | lesson 11 `risk` |
| Lin's land (corn, soybeans, grazing, broker's report) | lesson 11 `lin` |

## Week 7 (descriptive statistics, probability)
| Mean, median, mode, outliers (bank salaries) | lesson 7 `robust`, `predict` |
| Percentiles, quartiles (the graduates' salaries; at-home workers) | lesson 7 `name`, `workshop`, `q3`, `p32` |
| Range, IQR, variance, standard deviation | lesson 7 `name`, `spread`, `sd_dawson` |
| Dawson and Clark | lesson 7 `spread`, `sd_dawson`, `same_mean` |
| Experiments, sample space, counting rules (multiple steps, combinations) | lesson 8 `name` |
| Classical, relative-frequency (X-ray), subjective (Tom and Judy) probability; requirements; events (apartment vacancies) | lesson 8 `name` |
| Complement, union, intersection, mutually exclusive; the software company | lesson 8 `name`, `union`, `cond` |
| Conditional probability and independence; the police promotions | lesson 8 `table`, `predict`, `name` |
| The MBA survey | lesson 8 `mba`, `mba_f`, `indep` |

## Week 8 (random variables, binomial, normal)
| Discrete and continuous random variables; probability functions | lesson 12 `name` |
| Automobile sales: f(x), expected value, variance, standard deviation | lesson 12 `bars`, `predict`, `name` |
| Job satisfaction | lesson 12 `satisfaction` |
| Carolina Industries | lesson 12 `carolina`, `carolina2` |
| Binomial: conditions, function, mean and variance; Martin Clothing; the radar systems | lesson 12 `binomial`, `radar3`, `binom_ok` |
| Normal: properties, 68-95-99.7, standard normal, z, both tables | lesson 13 `area`, `name` |
| Tyres (more than 40,000 miles; the guarantee) | lesson 13 `tyre`, `guarantee` |
| Financial managers' pay (between; top 10%) | lesson 13 `pay` |

## Week 9 (simple regression)
| Model and estimated equation; least squares; Armand's Pizza | lesson 14 `line`, `name` |
| Vice presidents' bonus (workshop) | lesson 14 `bonus`. The deck's printed prediction (\$12,040) does not follow from its own sums; the correct value is about \$11,950 |
| SSE, SST, SSR, r², correlation | lesson 14 `predict`, `name`, `q5vi` |
| Excel / calculator method | lesson 14 `name` |

## Week 10 (multiple regression)
| Multiple regression equation; Excel steps; coefficient interpretation; Butler Trucking | lesson 15 `butler`, `predict`, `name` |
| R², adjusted R² | lesson 15 `adding`, `adj`, `adjbutler` |
| Correlation matrix, multicollinearity (Olympics) | lesson 15 `collinear`, `collinear_q` |
| F test and t tests | lesson 15 `name`, `ftest` |
| Qualitative (dummy) variable: Johnson Filtration | lesson 15 `collinear` (the note) |

## Week 12 and the assignments
Class presentations and the assignment material are not exam content: out of scope.

## The exam sources
| 2025 paper, all of Q1-Q5 | lessons 2, 3, 4, 5, 10, 11, 13, 14 (and 16 for the whole paper) |
| Multiple-regression past paper (Subaru) | lesson 15 `exam`, `sub_i`, `answer`, `ftest` |
| Cover sheet and subject guide (permitted materials, structure, reading time) | lesson 16 |
