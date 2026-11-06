// The MGMT90141 course's visuals (docs/lessons/mgmt90141): one pack, '@mathnim/visuals/mgmt', loaded by the demo
// course before its lessons (the course entry's `packs` in public/demo/courses.json). All are engine figures.
import { register } from '../registry';
import { mgmt_lp_plane } from './lp_plane';
import { mgmt_tree } from './decision_tree';
import { mgmt_normal } from './normal_area';

export { mgmt_lp_plane } from './lp_plane';
export { mgmt_tree } from './decision_tree';
export { mgmt_normal } from './normal_area';
export * as lp2d from './lp2d';
export * as tree from './tree';
export * as normal from './normal';

register(mgmt_lp_plane);
register(mgmt_tree);
register(mgmt_normal);
