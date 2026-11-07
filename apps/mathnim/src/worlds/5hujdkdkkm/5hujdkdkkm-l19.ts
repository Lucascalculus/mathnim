// Putting cryptography into the network: IPsec, firewalls, VPNs and HTTPS. The office network behind its firewall (the
// ochre wall): packets from outside are checked at the wall, most turned back (dashes); a VPN is a tunnel through the
// open internet (violet) that joins a distant site as if it were inside. Seen from above at rest; in the world, the
// wall stands.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, disc, frame } from '../_kit';
import { host, packet } from './_it';

const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [disc([0.8, 1.3], 1.4, 0.03, { pig: 'teal', k: 1, tint: 0.14, bias: -10 }), disc([6.6, 1.3], 0.9, 0.03, { pig: 'teal', k: 1, tint: 0.14, bias: -10 })];
    S.push(box(2.4, 0, -0.2, 2.6, 0.1 + 0.8 * u, 2.8, { pig: 'ochre', k: 1, tint: 0.45 }));
    for (const [x, z] of [[0.4, 0.8], [1.2, 1.8], [0.5, 1.9]] as [number, number][]) S.push(host(x, z, 0.1 + 0.3 * u));
    S.push(host(6.6, 1.3, 0.1 + 0.3 * u));
    S.push(box(1.4, 0.06, 1.12, 6.2, 0.06 + 0.16 + 0.1 * u, 1.48, { kind: 'wire', pig: 'violet', solid: 1, alpha: 0.75 }));
    S.push(packet(4.3, 1.3, 0, 0.08), packet(3.6, 0.0, Math.PI, 0, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.6 }), packet(3.8, 2.5, Math.PI, 0, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [3.3, 0.03, 0.1], [4.4, 0.03, -0.25], PIG.graphite_t, 1, 0.6);
    arrow3(ctx, cam, [3.5, 0.03, 2.4], [4.6, 0.03, 2.75], PIG.graphite_t, 1, 0.6);
  },
};
export default world;
