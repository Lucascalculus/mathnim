# Internet Technologies: the final-exam units

The last three units of the Internet Technologies demo course (COMP90007,
Semester 2, 2026; course id `5hujdkdkkm` in `apps/mathnim/public/demo/`). The
course's other units were generated from the 20 lecture decks; these units are
written by hand, the way the ECON90015 course is
(`docs/lessons/econ90015/README.md`):

1. **Final exam: the sample questions, explained** (`build.py`): the ten sample
   questions of the two review lectures. It replaces the generated "final exam
   practice" lesson (fifteen bare questions).
2. **Practice exam: every question, explained** (`practice.py`): the sixteen
   questions of the practice exam that the first unit does not teach.
3. **Classic hard problems, worked** (`hard.py`): the calculations the slides
   work through that neither the sample questions nor the practice exam ask.

`build.py` writes all three units and swaps them into `courses.json`, leaving
the generated units alone:

```bash
python3 docs/lessons/comp90007/build.py && node apps/mathnim/tools/demo_check.mjs 5hujdkdkkm
npm run check -w @mathnim/visuals -- --only it_mac_load,it_tahoe
```

The helpers it shares with the ECON90015 build (two-language strings, blocks
and steps, `Plot`) are in `docs/lessons/lesson_kit.py`; the drawing helpers
(`Fig`, `drawn`) are in `build.py`, and `practice.py` and `hard.py` use them.
Both new units spread the right answers: choice checkpoints are shuffled when
shown, and each in-page quiz puts its right option in a different place
(`mixed` in `practice.py`).

The course map now has nine stops, two more than the playbook's 3-7. They read
well on a phone as a vertical list and fit one row on a desktop.

# Unit 1: the sample questions

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

# Unit 2: the practice exam

## Sources

The practice exam (18 questions, 60 marks) and its sample solutions. Q5 and
Q16 are the first unit's R1 · 1 and R1 · 2, so the start page sends the learner
there. Every idea is taught as the course's slides teach it (physical layer,
data link layer 1-3, network layer 1-3, transport layer, application layer,
security). Facts beyond the slides are standard: ITU-T G.114's 150 ms for a
call, base64's 4/3, the socket primitives' table (Tanenbaum), count to
infinity.

## Who it is for, and what they need

The same student, now with the practice paper in hand. The paper reaches the
lower layers that the sample questions skip, a third of its marks ask for
differences, and five questions need a calculation. So each lesson follows the
first unit's arc (the question as printed, a slow read, the ideas, the answer
link by link and in full, the wider topic, practice), and the start page adds
how to read the marks (about one point per mark; matched pairs for compare
questions; working shown for calculations).

## Lessons

| Lesson | Questions | Answer |
|---|---|---|
| The cable and the signal | Q1, Q2 | fibre: bandwidth, distance, no interference, hard to tap / cost, specialists, fragile; copper the reverse. (1) more bits per symbol (2 to 8 levels); (2) 2 × 4000 × 5 = 40 kbps |
| Frames and errors | Q3, Q4 | A B ESC ESC D ESC FLAG ESC FLAG ESC ESC C; at most 100% (50% of what is sent) when the data is all FLAG and ESC. Correction locates and fixes (noisy channels); detection only sees, then retransmits (clean channels) |
| When a frame is lost | Q6 | Selective Repeat: buffer the good frames, NAK the lost one, resend it alone, cumulative ACK (or Go-Back-N: discard, time out, resend all after) |
| Addresses and the forwarding table | Q8, Q7 | one network outside, managed parts inside, no routing table explosion; /22 (1024 ≥ 1000). 148.96.40.12 → R2; 196.4.153.50 → R3 |
| Routing | Q9, Q10 | datagrams routed independently, no setup / virtual circuit set up first, all packets follow it. C: (11, 7, 0, 4, 6, 9) via (E, B, –, D, E, E) |
| A TCP connection | Q12, Q11 | the OS binds the client at connect, the server learns its port from the request. Flow control window protects the receiver's buffer; congestion window protects the network |
| DNS, email and a video call | Q15, Q13, Q14 | name resolution and load distribution (or aliasing, mail servers); MIME adds types, encodings and multipart to 7-bit ASCII mail; a buffer adds delay to a two-way conversation |
| Keys | Q17, Q18 | one shared key, fast, key distribution problem / public and private key, slow, solves distribution; a fake key on the page lets Trudy read and change everything (certificates are the fix) |

Drawings (SVG, one per language, made by `practice.py`): copper and fibre,
signal levels, byte stuffing, codewords, Go-Back-N against Selective Repeat, a
/22 prefix, the AND with a mask, the question's network, datagrams and virtual
circuits, a sender's two windows, DNS load distribution, jitter and buffers,
symmetric and public keys, the man in the middle.

# Unit 3: classic hard problems

## Sources

Each lesson is one practice problem, written for the course in the style of
the exam and labelled so (never presented as an exam question). The numbers
come from the slides' worked examples or standard textbook exercises: the CRC
and checksum examples and Hamming's rule (data link 2), the minimum frame of
CSMA/CD and the efficiency formula (MAC 2), fragmentation fields and path MTU
discovery (network 1-2), CIDR allocation and aggregation (Tanenbaum's
exercises on 198.16.0.0 and 57.6.96.0/21), Dijkstra on Tanenbaum's
eight-router network, the satellite link (Tanenbaum, with the acknowledgement's
transmission time taken as 0, as on the stop-and-wait slide), RSA with p = 3,
q = 11 (security 2) and Diffie–Hellman with n = 23, g = 5.

## Lessons

| Lesson | Problem | Answer |
|---|---|---|
| Computing the check bits | CRC of 10011101 with x³ + 1; Hamming code for 1101, receiver gets 1010111 | 10011101100 (remainder 100; third bit flipped leaves 100, detected); 1010101, bit 6 wrong, data 1101 |
| Ethernet's shortest frame | CSMA/CD, 1 Gbps, 1 km, 200,000 km/s | 2τ = 10 µs, 10,000 bits = 1250 bytes |
| Fragmenting a datagram | 4000 bytes (20 header) through MTU 1500 | 3 fragments: 1500/1500/1040 bytes, offsets 0/185/370, MF 1/1/0 |
| Handing out address blocks | A–D need 4000, 2000, 4000, 8000 from 198.16.0.0; aggregate four /21s from 57.6.96.0 | 198.16.0.0/20, 198.16.16.0/21, 198.16.32.0/20, 198.16.64.0/19; 57.6.96.0/19 |
| Shortest paths by hand | A to D on Tanenbaum's network | A0 B2 E4 G5 F6 H8 C9 D10; A–B–E–F–H–D = 10 |
| A window over a satellite | 1000-bit frames, 1 Mbps, 270 ms | round 541 ms; 1.85 kbps; 12.9 kbps with 7; window 541, 10 bits (GBN) / 11 bits (SR) |
| Public-key arithmetic | RSA p = 3, q = 11, d = 7; DH n = 23, g = 5, x = 6, y = 15 | e = 3; 19 → 28 → 19; signature of 4 is 16; DH sends 8 and 19, key 2; the man in the middle |

Drawings: Hamming's check groups, the collision window on a cable, three
fragments, the CIDR blocks on a line, the eight-router network (and its
shortest path), one satellite round, Diffie–Hellman and its man in the middle.
Long divisions are generated as text by `long_division`, so they always match
the numbers.
