// Part D (preference optimization) visuals: Bradley–Terry fitting, the
// REINFORCE baseline, PPO clipping, the KL-regularised optimum and DPO's gap
// plane. Importing this module registers them.
import { register } from '../../registry';
import { bradley_terry_fit } from './bradley_terry_fit';
import { ppo_clip } from './ppo_clip';
import { pg_baseline } from './pg_baseline';
import { kl_leash_policy } from './kl_leash_policy';

export { bradley_terry_fit, ppo_clip, pg_baseline, kl_leash_policy };
export { leash_state, LEASH_LB } from './kl_leash_policy';
export { attach_bt_cards, league, fit_from, BT_CARDS } from './bradley_terry_fit';
export { PG_REWARDS, PG_PROBS, PG_BEST } from './pg_baseline';
export * as dmath from './math';

register(bradley_terry_fit, pg_baseline, ppo_clip, kl_leash_policy);
