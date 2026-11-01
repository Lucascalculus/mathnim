# Internet Technologies: the final-exam unit

The last unit of the Internet Technologies demo course (COMP90007, Semester 2,
2026; course id `5hujdkdkkm` in `apps/mathnim/public/demo/`). The course's other
units were generated from the 20 lecture decks; this unit is written by hand,
the way the ECON90015 course is (`docs/lessons/econ90015/README.md`), and
replaces the generated "final exam practice" lesson (fifteen bare questions).
`build.py` here writes the nine lessons and swaps the unit in `courses.json`,
leaving the generated units alone:

```bash
python3 docs/lessons/comp90007/build.py && node apps/mathnim/tools/demo_check.mjs 5hujdkdkkm
npm run check -w @mathnim/visuals -- --only it_mac_load,it_tahoe
```

The helpers it shares with the ECON90015 build (two-language strings, blocks
and steps, `Plot`) are in `docs/lessons/lesson_kit.py`.

## Sources

The ten sample questions of the two Week 12 review lectures, with the
lecturers' answers: Review (1) (Ling Luo; three questions, two of them
questions 5 and 16 of the practice exam, answers in the solutions deck) and
Review (2) (Maria Rodriguez Read; seven questions with answers). Every idea is
taught as the course's slides teach it (MAC sublayer decks 1 and 2, transport
layer decks 1 to 3, application layer decks 1 to 3, network security decks 2
and 3). Numbers that are not on the slides are standard: slotted ALOHA's
S = G·e^(−G), CD audio's bit rate, raw HD video, base64's 4/3.

## Who it is for, and what they need

- **Who**: a COMP90007 student preparing for the final exam. They may have
  worked through the course's lessons, or come straight to this unit.
- **What they need**: to understand each idea behind the sample questions from
  the ground up, and to write short answers that earn the marks. Almost every
  question is *briefly explain*: two to four sentences, each carrying a reason.

## Structure

Each lesson follows the learner, as in ECON90015: the question as printed
(`paper`, English with the Chinese under it), a slow read of its terms; the
ideas it needs, from the ground up, with the question's own scenario; the
answer built link by link, then a full-mark answer on the paper and where the
marks are; the wider topic, taught; practice.

What is different from ECON90015, because the questions are short answers
rather than calculations:

- The answer is built as a chain of links (the choice, the condition, the
  mechanism, the contrast), not as a derivation. A `derive` with one line left
  to the learner (`blank`) is used where there is a calculation: the bit-map
  protocol's efficiency, the Tahoe question's four round trips, counting the
  round trips of a page.
- Practice includes questions answered in the learner's own words (`text`
  checkpoints, marked by the tutor against the points an examiner looks for),
  because that is what the exam asks for.
- Two questions share a lesson where one builds on the other (a port, then UDP
  or TCP for RPC; DNS, then HTTP over one connection: opening one web page;
  SMTP and lossy compression: the course's email and multimedia lecture). Such
  a lesson has one chapter per question.

Lessons go up the layers, so each uses only what came before: a start page
(each question as a story, the order, and two habits that earn the marks),
the shared channel (R1 · 1), reaching a process and RPC (R2 · 1, 2),
congestion control (R2 · 3), opening a web page (R2 · 4, 5), email and
multimedia (R2 · 6, 7), cipher modes (R1 · 2), public-key authentication
(R1 · 3), and a page of answer patterns with a ten-question drill.

Two interactive figures (`packages/visuals/src/it/`, the course entry's
`packs: ['it']`), each where moving the cause shows the answer:
`it_mac_load` (drag the load: slotted ALOHA's useful share peaks at 37% and
collapses into collisions while the bit-map protocol fills the channel) and
`it_tahoe` (the question's connection round by round; drag the moment of the
loss, switch to Reno and to three duplicate ACKs). The other drawings are SVG,
one per language, made by `build.py`.

## Answers (as the lecturers give them)

| Question | Answer |
|---|---|
| R1 · 1 (practice Q5) | collision-free: under high load contention protocols collide constantly; collision-free ones take turns |
| R1 · 2 (practice Q16) | counter mode: each block from its position; CFB needs the 8 preceding ciphertext bytes |
| R1 · 3 | after message 6: only Bob can extract $R_A$, which Alice encrypted with $E_B$ in message 3 |
| R2 · 1 | the IP address and the port to which the destination process's socket is bound |
| R2 · 2 | idempotent: UDP (a retry is harmless, no handshake or connection state); not idempotent: TCP (duplicates rejected, exactly once) |
| R2 · 3 | threshold 8 KB; windows 2, 4, 8, 9 (additive increase after reaching 8) |
| R2 · 4 | names cannot be resolved; pages only by IP address; extremely inefficient, if not impossible, for most users |
| R2 · 5 | reusing one TCP connection: less overhead, higher throughput (pipelining); challenge: when to close |
| R2 · 6 | + simple text protocol, easy to read, debug and implement; − several back-and-forth messages per email |
| R2 · 7 | decoded data approximates the original; perceptual encoding: a small loss buys a large compression ratio |
