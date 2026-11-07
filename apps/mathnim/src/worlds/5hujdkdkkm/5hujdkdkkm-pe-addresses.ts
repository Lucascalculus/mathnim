// Addresses, subnets and the forwarding table: the table's prefixes (bars, as long as each prefix); a packet's address
// matches several of them, and the router takes the longest match (teal) and sends it out that line. Seen from above at
// rest; in the world, the matching rows rise, the longest highest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame } from '../_kit';
import { packet } from './_it';

// prefix length (bits), matches the packet
const ROWS: [number, boolean][] = [[8, true], [16, true], [24, true], [20, false], [0, true]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 5.4, 4.0, { bias: -10 })], best = 2;
    ROWS.forEach(([len, m], i) => { const z = 0.45 + i * 0.68, L = 0.2 + (len / 32) * 4.8; S.push(box(0.3, 0.05, z, 0.3 + L, 0.05 + 0.04 + (m ? (i === best ? 0.4 : 0.15) : 0) * u, z + 0.36, i === best ? { pig: 'teal', k: 1, tint: 0.6 } : m ? { pig: 'cobalt', k: 1, tint: 0.35 } : { pig: 'cobalt', k: 1, tint: 0.1 })); });
    S.push(packet(6.6, 0.45 + best * 0.68 + 0.18, Math.PI, 0));
    frame(cam, S, w, h, [12, 12, 12, 12], [[7.0, 0, 1]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [6.3, 0.08, 0.45 + best * 0.68 + 0.18], [4.3, 0.08, 0.45 + best * 0.68 + 0.18], PIG.violet, 1.4, 0.9);
  },
};
export default world;
