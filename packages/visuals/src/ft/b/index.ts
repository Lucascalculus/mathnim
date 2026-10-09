// Part B of the fine-tuning course (SFT): its visuals.
import { register } from '../../registry';
import { attention_mask_packing } from './attention_mask_packing';
import { pad_eos_trap } from './pad_eos_trap';
import { rejection_sampling_yield } from './rejection_sampling_yield';
import { eval_noise } from './eval_noise';
import { token_loss_mask } from './token_loss_mask';
import { two_valleys_forgetting } from './two_valleys_forgetting';
import { training_curves } from './training_curves';

export { pad_eos_trap, collate, eos_targets, outcome, GENERATIONS } from './pad_eos_trap';
export { attention_mask_packing, padding_waste, cross_fraction, position_ids } from './attention_mask_packing';

export { rejection_sampling_yield, expected_kept, coverage, rs_yield } from './rejection_sampling_yield';
export { eval_noise, se_gap, flip_prob, n_for_flip, simulate_gap, phi } from './eval_noise';
export { token_loss_mask, parts_of, loss_share, is_assistant_only, type Part } from './token_loss_mask';
export { TOKEN_SAMPLES, type TokenRow } from './token_data';
export { two_valleys_forgetting, gd, L_new, L_old, h_old } from './two_valleys_forgetting';
export { training_curves, preset_curves, parse_series } from './training_curves';

register(training_curves, two_valleys_forgetting, token_loss_mask, pad_eos_trap, attention_mask_packing, rejection_sampling_yield, eval_noise);
