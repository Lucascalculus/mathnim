// Each course page's cover: a drawing made for that course alone, in a style of its own (docs/TASTE.md §5: art is
// drawn, not engineered; docs/design/COVERS.md keeps what was learnt drawing them). A course with an entry here opens
// on its drawing, with its title, start and map in the drawing's clear part, and reads below as a route.
//
// Only where the words go is known here, so the page lays out before the drawing has loaded; each drawing is a
// module of its own (a string of SVG, its own animation inside), loaded with the page.
export interface Cover {
  load: () => Promise<{ svg: () => string }>;
  /** Where the title, start and map sit, in % of the cover: left edge, vertical centre, width. */
  at: [number, number, number];
  /** The column the route below keeps to, in % of the window: left and right edges (the text's left by default). */
  col?: [number, number];
  /** The title in two lines (the second light): where to break it, else at the brackets, a last comma or word. */
  split?: (title: string) => [string, string] | null;
  /** This cover's own styles for its words (scoped to it). */
  css?: string;
  /** The course's colour on its page, for a course that has none of its own (the start, the route's marks). */
  accent?: string;
}

export const COVERS: Record<string, Cover> = {
  // the Team Bat logbook's track, used as it is: the title in its infield
  mpc: { load: () => import('./mpc'), at: [20.9, 48.5, 42], col: [20.9, 83.9] },
  // a murmuration of words over the top and down the right; the title low on the left, under its wing
  'llm-finetuning': { load: () => import('./llm-finetuning'), at: [9, 64, 52], col: [9, 88], split: (s) => s.match(/^(Fine-tuning)\s+(.+)$/)?.slice(1) as [string, string] ?? s.match(/^(大模型)(微调)$/)?.slice(1) as [string, string] ?? null },
  // a Bauhaus poster: the sliced disc and its strip on the right, the title on the left
  geometry: { load: () => import('./geometry'), at: [8, 50, 44], col: [8, 88], split: (s) => (s.match(/^(Geometry)\s+(.+)$/) ?? s.match(/^(在运动中)(.+)$/))?.slice(1) as [string, string] ?? null },
  // a transit map: a loop and four lines on the right, stations named after protocols; the title on the left
  'course-5hujdkdkkm': { load: () => import('./course-5hujdkdkkm'), at: [8, 60, 40], col: [8, 88], accent: '#DC241F' },
  // a two-ink risograph: a halftone sun and two bands crossing on the right; the title on the left
  'course-econ90015': { load: () => import('./course-econ90015'), at: [8, 56, 45], col: [8, 88], accent: '#E5357F' },
  // a pointillist dusk on the right, dissolving towards the title
  'course-comp90049': { load: () => import('./course-comp90049'), at: [8, 54, 42], col: [8, 88], accent: '#2E7D5B' },
  // paper cut-outs after Matisse, pinned loosely over the right; the title on the left
  'course-mktg90037': { load: () => import('./course-mktg90037'), at: [8, 54, 42], col: [8, 88], accent: '#2341B5' },
  // a dry garden: three stones in raked gravel on the right; the title on the left
  'course-mgmt90141': { load: () => import('./course-mgmt90141'), at: [8, 54, 42], col: [8, 88], accent: '#5E7D4A' },
};
