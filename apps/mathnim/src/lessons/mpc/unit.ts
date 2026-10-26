// The model predictive control course's units (docs/lessons/mpc). Each lesson's agent
// fills in its own two lines (the import and its entry) once its lesson passes the doctor,
// re-reading this file right before editing (other agents edit it too), then runs
// `npm run manifest -w mathnim`. Batch 1 = M1-M4 (published first), batch 2 = M5-M8.
import type { CourseLesson, Unit } from '../../course';
import { t } from './common';
// ---- imports (one per lesson; uncomment and fix the file name when the lesson exists)
// import { lesson as m1 } from './m1_...';
// import { lesson as m2 } from './m2_...';
// import { lesson as m3 } from './m3_...';
// import { lesson as m4 } from './m4_...';
// import { lesson as m5 } from './m5_...';
// import { lesson as m6 } from './m6_...';
// import { lesson as m7 } from './m7_...';
// import { lesson as m8 } from './m8_...';

/** One entry: `{ id: mN.id, lesson: mN, minutes, thumb: '<step id>', title: t(en, zh), summary: t(en, zh) }`. */
const basics: CourseLesson[] = [
  // M1
  // M2
  // M3
];
const constraints: CourseLesson[] = [
  // M4
  // M5
  // M6
];
const real: CourseLesson[] = [
  // M7
  // M8
];

export const units: Unit[] = [
  { id: 'mpc-basics', title: t('Basics', '基础'), lessons: basics },
  { id: 'mpc-constraints', title: t('Constraints and solving', '约束与求解'), lessons: constraints },
  { id: 'mpc-real', title: t('Real systems', '真实系统'), lessons: real },
].filter((u) => u.lessons.length > 0);
