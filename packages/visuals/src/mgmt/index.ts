// The MGMT90141 course's visuals (docs/lessons/mgmt90141): one pack, '@mathnim/visuals/mgmt', loaded by the demo
// course before its lessons (the course entry's `packs` in public/demo/courses.json). All are engine figures.
import { register } from '../registry';
import { mgmt_lp_plane } from './lp_plane';

export { mgmt_lp_plane } from './lp_plane';
export * as lp2d from './lp2d';

register(mgmt_lp_plane);
