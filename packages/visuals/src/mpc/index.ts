// The model predictive control course's visuals (docs/lessons/mpc): one pack,
// '@mathnim/visuals/mpc', loaded by every MPC lesson. Each lesson's agent adds
// its own visuals (import, export, register) in its own section below, and
// re-reads the file right before editing (other agents edit it too).
import { register } from '../registry';
import { mpc_receding_loop } from './receding_loop';
import { mpc_dock_horizon } from './dock_horizon';
import { mpc_pd_compare } from './pd_compare';
import { mpc_replan_push } from './replan_push';
import { mpc_weights } from './weights';
import { mpc_gain_horizon } from './gain_horizon';
import { mpc_qp_plane } from './qp_plane';
import { mpc_explicit_map } from './explicit_map';

export * as mpc_math from './math';
export * as mpc_kit from './kit';
export * as mpc_qp2d from './qp2d';
export { dock_run, pd_run, needed_steps, shortest_safe_N, shown_instant, plan_end, push_runs, type DockRun, type Trace } from './dock';
export { mpc_receding_loop, position_at } from './receding_loop';
export { mpc_dock_horizon, dock_view, DOCK_LABELS } from './dock_horizon';
export { mpc_pd_compare, PD_TUNINGS } from './pd_compare';
export { mpc_replan_push } from './replan_push';
export { mpc_weights } from './weights';
export * as mpc_weights_math from './weights_math';

// ---- M1 (agent M-A)
register(mpc_receding_loop);
register(mpc_pd_compare);
register(mpc_replan_push);
register(mpc_dock_horizon);

// ---- M2 (its agent)
import { mpc_bars } from './bars';
import { mpc_zoh_step } from './zoh_step';
export { mpc_bars, bar_label } from './bars';
export { mpc_zoh_step } from './zoh_step';
export * as mpc_bars_math from './bars_math';
register(mpc_bars);
register(mpc_zoh_step);
// ---- M3 (agent M-C)
register(mpc_weights);
register(mpc_gain_horizon);
// ---- M4–M6 (agent M-B)
register(mpc_qp_plane);
register(mpc_explicit_map);
// ---- M7 (agent M7)
import { mpc_offset } from './offset';
export { mpc_offset, OFFSET_LABELS } from './offset';
export * as mpc_disturbance from './disturbance';
register(mpc_offset);
// ---- M7, M8 (their agents): add their visuals here when reported
