// Drawing helpers for the Internet Technologies exam unit (docs/lessons/comp90007): the econ kit (the
// MPC plot panel, segmented control and live labels, plus live regions, a handle that drags a vertical
// line and number formatting) serves these figures as it is.
export * from '../econ/kit';

/** A share as a whole percentage: 0.268 → '27%'. */
export const pct = (v: number): string => `${Math.round(v * 100)}%`;
