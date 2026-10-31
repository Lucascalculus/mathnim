// The ECON90015 mock-exam course's visuals (docs/lessons/econ90015): one pack,
// '@mathnim/visuals/econ', loaded by the demo course before its lessons (the
// course entry's `packs` in public/demo/courses.json).
import { register } from '../registry';
import { econ_quota } from './quota';
import { econ_monopoly_tax } from './monopoly_tax';
import { econ_screening } from './screening';
import { econ_cournot } from './cournot';
import { econ_malthus } from './malthus';

export { econ_quota, quota_market } from './quota';
export { econ_monopoly_tax, monopoly_tax } from './monopoly_tax';
export { econ_screening, packages } from './screening';
export { econ_cournot, replies } from './cournot';
export { econ_malthus, n_star } from './malthus';

register(econ_quota);
register(econ_monopoly_tax);
register(econ_screening);
register(econ_cournot);
register(econ_malthus);
