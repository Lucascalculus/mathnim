// The physics stress test's figures (docs/design/PHYSICS-STRESS.md): one pack, '@mathnim/visuals/physics', loaded by
// the unlisted demo course before its lesson (its entry's `packs` in public/demo/courses.json). All are engine figures.
import { register } from '../registry';
import { phys_pendulum } from './pendulum_figure';
import { phys_charges } from './charges_figure';
import { phys_torque } from './torque_figure';
import { phys_throw } from './throw_figure';

export { phys_pendulum, phys_charges, phys_torque, phys_throw };
export * as pendulum from './pendulum';
export * as electro from './electro';
export * as torque from './torque';

register(phys_pendulum, phys_charges, phys_torque, phys_throw);
