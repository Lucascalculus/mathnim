// How far a lesson is (or a step of a course being made from slides), as a small
// circle in the site's one language of circles (the outline's stations): empty
// to come, half filled on the way, ringed where the learner is, filled with a
// check when done; a failed step of a course being made is red.
import { esc, icon } from '@mathnim/present';

export type Progress = 'new' | 'started' | 'current' | 'done' | 'failed';

/** The circle; with `label` it is announced (otherwise the text beside it says it). */
export const progress_mark = (state: Progress, label?: string): string =>
  `<span class="pm pm-${state}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>${state === 'done' ? icon('check', 8) : state === 'failed' ? icon('x', 8) : ''}</span>`;

export const PROGRESS_CSS = `
.pm{flex:none;box-sizing:border-box;width:12px;height:12px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--mn-fg) 28%,transparent);display:inline-grid;place-items:center;color:#fff}
.pm .mn-ic{stroke-width:3.6}
.pm-started{border-color:var(--mn-accent);background:linear-gradient(90deg,var(--mn-accent) 50%,transparent 50%)}
.pm-current{border-color:var(--mn-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mn-accent) 20%,transparent)}
.pm-done{border-color:var(--mn-accent);background:var(--mn-accent)}
.pm-failed{border-color:var(--mn-bad);background:var(--mn-bad)}
`;
