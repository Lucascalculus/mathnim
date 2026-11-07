// When addresses run out, and choosing a route: behind one router (NAT), many hosts share a single public address
// (left, the private side; right, the one public link); the router rewrites each packet's address and port and
// remembers which is whose. Seen from above at rest; in the world, the hosts and the router stand.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { disc, frame, words } from '../_kit';
import { host, link, packet, router } from './_it';

const HOSTS: [number, number][] = [[0, 0], [0, 1.1], [0, 2.2], [0, 3.3]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [disc([0.9, 1.65], 2.0, 0.03, { pig: 'teal', k: 1, tint: 0.14, bias: -10 })];
    for (const [x, z] of HOSTS) S.push(host(x, z, 0.12 + 0.3 * u));
    S.push(router(2.4, 1.65, 0.1 + 0.4 * u, { pig: 'violet', k: 1, tint: 0.3 }), packet(4.4, 1.65, 0));
    frame(cam, S, w, h, [12, 12, 12, 22], [[6.2, 0, 1.65], [0.9, 0, 4.05]]);
    for (const [x, z] of HOSTS) link(ctx, cam, [x + 0.35, z], [2.2, 1.65], PIG.ink, 1, 0.55);
    link(ctx, cam, [2.65, 1.65], [6.0, 1.65], PIG.ink, 2, 0.75);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'private addresses', '私有地址'), [0.9, 0.03, 3.95], PIG.teal, 10.5);
    words(ctx, cam, say(st, 'one public address', '一个公网地址'), [4.5, 0.03, 2.2], PIG.violet, 10.5);
  },
};
export default world;
