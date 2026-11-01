// The Internet Technologies course's exam-unit visuals (docs/lessons/comp90007): one pack,
// '@mathnim/visuals/it', loaded by the demo course before its lessons (the course entry's `packs` in
// public/demo/courses.json).
import { register } from '../registry';
import { it_mac_load } from './mac_load';
import { it_tahoe } from './tahoe';

export { it_mac_load, channel } from './mac_load';
export { it_tahoe, tcp_rounds, loss_round } from './tahoe';

register(it_mac_load);
register(it_tahoe);
