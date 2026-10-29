// "Eigenvectors and PCA" - eigenvalues and eigenvectors, then
// PCA. The university demo: an essay lesson in the same light theme as every
// other lesson, built from @mathnim/visuals. Each segment resolves one confusion: watch the
// visual, then hold it yourself, then a question aimed at the usual mistake.
import type { ExploreStep, Lesson } from '@mathnim/core';
import { check_params, get_visual, linalg } from '@mathnim/visuals';

type Raw = Record<string, unknown>;
/** The visual's scene with checked parameters. */
const vis = (name: string, raw: Raw = {}) => () => {
  const v = get_visual(name)!;
  return v.scene(check_params(v, raw).params);
};
/**
 * Its explore() handles, for a world step. The explanation ends on the answer,
 * so `start` moves the scene to a neutral position first (the doctor fails a
 * world whose goal is reached before anyone acts).
 */
const hold = (name: string, raw: Raw = {}, start?: (scene: any) => void): ExploreStep['setup'] => (scene, ui) => {
  const v = get_visual(name)!;
  start?.(scene);
  v.explore?.(scene, ui, check_params(v, raw).params);
};

const A_SYM = [[2, 1], [1, 2]]; // eigenvalues 3 and 1, eigenvectors (1,1) and (1,-1)
const SHEAR = [[2, 1], [0, 1]];
const TARGET = [[2, 1], [1, 2]];
const near = (a: number[][], b: number[][], tol: number) => a.every((row, i) => row.every((x, j) => Math.abs(x - b[i][j]) <= tol));
/** Angle between direction th and the line through eigenvector v (mod π). */
const off_line = (th: number, v: number[]) => Math.abs(Math.sin(th - Math.atan2(v[1], v[0])));
/** The two eigen-directions of A_SYM (distinct real eigenvalues 3 and 1). */
const EV = linalg.eig2(A_SYM as any).vectors as unknown as [number[], number[]];

export const lesson: Lesson = {
  id: 'eigen-pca',
  title: 'Eigenvectors and PCA',
  description: 'Eigenvectors and eigenvalues from the picture up - and why they are exactly what PCA needs.',
  mode: 'essay',
  skills: [
    { id: 'linear-maps', name: 'Matrices as motions of the plane' },
    { id: 'determinant', name: 'Determinant = area scale factor', prerequisites: ['linear-maps'] },
    { id: 'eigen', name: 'Eigenvectors and eigenvalues', prerequisites: ['linear-maps'] },
    { id: 'char-poly', name: 'Why $\\det(A - \\lambda I) = 0$', prerequisites: ['eigen', 'determinant'] },
    { id: 'pca', name: 'PCA: directions of greatest spread', prerequisites: ['eigen'] },
  ],
  misconceptions: [
    { id: 'matrix-as-table', description: 'A matrix acts entry by entry, like a table of numbers - not as a motion of the whole plane.' },
    { id: 'det-formula-only', description: 'The determinant is just the formula ad - bc, with no meaning.' },
    { id: 'columns-eigen', description: 'The eigenvectors are the columns of the matrix.' },
    { id: 'diag-eigen', description: 'The eigenvalues are the numbers on the diagonal.' },
    { id: 'rotation-has-eigen', description: 'Every matrix has real eigenvectors.' },
    { id: 'pca-regression', description: 'The first principal component is the least-squares regression line.' },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. matrices move the plane
    {
      id: 'moves', kind: 'scene', chapter: 'A matrix is a motion', title: 'Where the basis vectors land', scene: vis('linear_map', { A: SHEAR }),
      narration: 'A matrix is not a table of numbers. It is a motion of the whole plane. Its first column says where i-hat lands, its second column where j-hat lands, and every other vector just follows along.',
    },
    {
      id: 'moves-try', kind: 'explore', title: 'Build a matrix by hand', skill: 'linear-maps', scene: vis('linear_map', { A: [[1, 0], [0, 1]], show_vector: false }),
      prompt: 'Drag the tips of $\\hat\\imath$ and $\\hat\\jmath$ until the matrix reads $\\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$.',
      setup: hold('linear_map', { A: [[1, 0], [0, 1]], show_vector: false }),
      goals: [{ id: 'built', check: (s: any) => near(s.M.get(), TARGET, 0.2), message: 'That is $\\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$ - we will meet it again.' }],
      hints: ['The first column is where $\\hat\\imath$ lands: put its tip at $(2, 1)$.'],
      solve: (s: any) => s.M.set(TARGET),
    },
    {
      id: 'moves-q', kind: 'checkpoint', skill: 'linear-maps', purpose: 'check', title: 'Follow a vector',
      prompt: 'Under $A = \\begin{bmatrix} 2 & 1 \\\\ 0 & 1 \\end{bmatrix}$, where does the vector $(1, 1)$ land?',
      question: {
        type: 'choice', options: [
          { id: 'a', label: '$(3, 1)$', correct: true },
          { id: 'b', label: '$(2, 1)$', misconception: 'matrix-as-table', feedback: 'That multiplies entry by entry. The vector is $1\\cdot$(first column) $+ 1\\cdot$(second column).' },
          { id: 'c', label: '$(3, 2)$', feedback: 'Close - check the second coordinate: $0 + 1 = 1$.' },
          { id: 'd', label: '$(1, 3)$' },
        ],
      },
      explain: '$(1,1) = \\hat\\imath + \\hat\\jmath$ lands on $(2,0) + (1,1) = (3,1)$.',
    },

    // ---------------------------------------------------------------- 2. determinant
    {
      id: 'det', kind: 'scene', chapter: 'The determinant', title: 'Area scale factor', scene: vis('determinant_area', { A: [[1.5, 0.5], [0.5, 1.2]] }),
      narration: 'The determinant is how much the motion scales area. The unit square becomes a parallelogram, and its area is the determinant. When the two columns line up, the plane is squashed flat and the determinant is zero.',
    },
    {
      id: 'det-try', kind: 'explore', title: 'Squash the plane', skill: 'determinant', scene: vis('determinant_area', { A: [[1.5, 0.5], [0.5, 1.2]], show_collapse: false }),
      prompt: 'Drag $\\hat\\imath$ and $\\hat\\jmath$ until the plane is **squashed flat**: area zero.',
      setup: hold('determinant_area', { A: [[1.5, 0.5], [0.5, 1.2]], show_collapse: false }),
      goals: [{
        id: 'flat',
        check: (s: any) => {
          const [[a, b], [c, d]] = s.M.get();
          return Math.abs(a * d - b * c) < 0.06 && Math.hypot(a, c) > 0.3 && Math.hypot(b, d) > 0.3;
        },
        message: 'Determinant 0: both columns on one line, the plane collapses onto it.',
      }],
      hints: ['Put the tip of $\\hat\\jmath$ on the line through $\\hat\\imath$.'],
      solve: (s: any) => s.M.set([[1.5, 1], [0.6, 0.4]]),
    },
    {
      id: 'det-q', kind: 'checkpoint', skill: 'determinant', purpose: 'check', title: 'Read it from the picture',
      prompt: 'What is $\\det \\begin{bmatrix} 2 & 4 \\\\ 1 & 2 \\end{bmatrix}$ - and what does the plane do?',
      question: { type: 'number', answer: 0, wrong: [{ answer: 8, misconception: 'det-formula-only', feedback: 'It is $ad - bc = 4 - 4$. And look at the columns: $(4, 2)$ is twice $(2, 1)$, so they lie on one line.' }] },
      explain: 'The second column is twice the first: the plane is squashed onto a line, so the area scale is $0$.',
    },

    // ---------------------------------------------------------------- 3. eigenvectors
    {
      id: 'eigen-predict', kind: 'checkpoint', skill: 'eigen', purpose: 'predict', chapter: 'Directions that stay put', title: 'Guess first',
      prompt: 'Most vectors get knocked off their own line by $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$. Which one stays on its line?',
      question: {
        type: 'choice', options: [
          { id: 'a', label: '$(1, 1)$', correct: true },
          { id: 'b', label: '$(2, 1)$, the first column', misconception: 'columns-eigen' },
          { id: 'c', label: '$(1, 0)$' },
          { id: 'd', label: 'None of them' },
        ],
      },
      reveal: 'hunt',
    },
    {
      id: 'hunt', kind: 'scene', title: 'Hunting eigenvectors', scene: vis('eigen_hunt', { A: A_SYM }),
      narration: 'Turn a probe vector all the way around and watch where the matrix sends it. Most of the time the image points somewhere else. But in a few directions the two line up: the matrix only stretches. Those are the eigenvectors, and the stretch is the eigenvalue.',
    },
    {
      id: 'hunt-try', kind: 'explore', title: 'Find both', skill: 'eigen', scene: vis('eigen_hunt', { A: A_SYM }),
      prompt: 'Drag $\\vec v$ around the circle. Find **both** directions where $A\\vec v$ lines up with $\\vec v$.',
      setup: hold('eigen_hunt', { A: A_SYM }, (s) => s.th.set_value(0.3)),
      goals: [
        { id: 'l3', check: (s: any) => off_line(s.th.get_value(), EV[0]) < 0.035, message: 'Found one: $A\\vec v = 3\\vec v$.' },
        { id: 'l1', check: (s: any) => off_line(s.th.get_value(), EV[1]) < 0.035, message: 'And the other: $A\\vec v = 1\\cdot\\vec v$.' },
      ],
      hints: ['Try the diagonals.'],
      solve: (s: any, _c, w) => {
        s.th.set_value(Math.atan2(EV[0][1], EV[0][0]));
        w.emit('probe'); // goals are checked after each event
        s.th.set_value(Math.atan2(EV[1][1], EV[1][0]));
      },
    },

    // ---------------------------------------------------------------- 4. why det(A - λI) = 0
    {
      id: 'why', kind: 'scene', chapter: 'Why det(A − λI) = 0', title: 'The key idea', scene: vis('lambda_sweep', { A: [[3, 1], [0, 2]] }),
      narration: 'Here is why the recipe works. A v equals lambda v § means that A minus lambda I sends v to zero. § A matrix that sends a nonzero vector to zero squashes the plane flat, so its determinant is zero. § Slide lambda: exactly at the eigenvalues, the grid collapses.',
    },
    {
      id: 'why-try', kind: 'explore', title: 'Make the grid collapse', skill: 'char-poly', scene: vis('lambda_sweep', { A: A_SYM }),
      prompt: 'Now for $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$: slide $\\lambda$ (or drag this number: $\\lambda =$ {scrub:lam}) and find **every** value where the grid collapses.',
      scrub: { lam: { tracker: (s: any) => s.lam, min: -1, max: 5, step: 0.05, decimals: 2, label: 'lambda' } },
      setup: hold('lambda_sweep', { A: A_SYM }, (s) => s.lam.set_value(0)),
      goals: [
        { id: 'one', check: (s: any) => Math.abs(s.lam.get_value() - 1) < 0.04, message: '$\\lambda = 1$: collapse.' },
        { id: 'three', check: (s: any) => Math.abs(s.lam.get_value() - 3) < 0.04, message: '$\\lambda = 3$: collapse - the same 1 and 3 you found by hunting.' },
      ],
      solve: (s: any, _c, w) => {
        s.lam.set_value(1);
        w.emit('lambda');
        s.lam.set_value(3);
      },
    },
    {
      id: 'why-q', kind: 'checkpoint', skill: 'char-poly', purpose: 'check', title: 'Use it',
      prompt: 'What is the **larger** eigenvalue of $\\begin{bmatrix} 4 & 1 \\\\ 2 & 3 \\end{bmatrix}$?',
      question: {
        type: 'number', answer: 5,
        wrong: [
          { answer: 4, misconception: 'diag-eigen', feedback: 'The diagonal entries are eigenvalues only for triangular matrices. Solve $(4-\\lambda)(3-\\lambda) - 2 = 0$.' },
          { answer: 7, feedback: '7 is the trace - the *sum* of the eigenvalues. Solve $\\lambda^2 - 7\\lambda + 10 = 0$.' },
        ],
      },
      hints: ['$\\det(A - \\lambda I) = (4-\\lambda)(3-\\lambda) - 2$.', 'That is $\\lambda^2 - 7\\lambda + 10 = (\\lambda - 2)(\\lambda - 5)$.'],
    },

    // ---------------------------------------------------------------- 5. rotations
    {
      id: 'rotation', kind: 'scene', chapter: 'When no direction survives', title: 'Rotations', scene: vis('rotation_no_eigen'),
      narration: 'Turn the matrix into a rotation and the eigenlines merge, then vanish: every vector gets turned. The equation still has solutions, but they are complex numbers. Complex eigenvalues are the algebra’s way of saying rotation.',
    },
    {
      id: 'rotation-q', kind: 'checkpoint', skill: 'eigen', purpose: 'check', title: 'Count them',
      prompt: 'How many real eigen-directions does a rotation by $90°$ have?',
      question: {
        type: 'choice', options: [
          { id: 'a', label: 'None', correct: true },
          { id: 'b', label: 'Two, like every $2\\times 2$ matrix', misconception: 'rotation-has-eigen', feedback: 'Every vector turns by $90°$ - none stays on its line. The eigenvalues are $\\pm i$.' },
          { id: 'c', label: 'One' },
          { id: 'd', label: 'Infinitely many' },
        ],
      },
    },

    // ---------------------------------------------------------------- 6. why it matters: powers
    {
      id: 'power-predict', kind: 'checkpoint', skill: 'eigen', purpose: 'predict', chapter: 'Why it matters', title: 'Apply it again and again',
      prompt: 'Apply $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$ fifty times to $(1, 0)$. The result points almost along…',
      question: {
        type: 'choice', options: [
          { id: 'a', label: '$(1, 1)$', correct: true },
          { id: 'b', label: '$(1, 0)$, where it started' },
          { id: 'c', label: '$(1, -1)$' },
          { id: 'd', label: 'It keeps spinning' },
        ],
      },
      reveal: 'power',
    },
    {
      id: 'power', kind: 'scene', title: 'Powers of a matrix', scene: vis('matrix_power', { A: A_SYM }),
      narration: 'Apply the matrix again and again. The part along the eigenvector with eigenvalue three grows three times each step; the other part only once. So every vector swings onto the dominant eigenvector. In the eigenvector basis, A to the n is just stretching.',
    },

    // ---------------------------------------------------------------- 7. symmetric matrices
    {
      id: 'symmetric', kind: 'scene', chapter: 'Symmetric matrices', title: 'Perpendicular axes', scene: vis('symmetric_ellipse'),
      narration: 'Symmetric matrices are special. They turn the unit circle into an ellipse, and the axes of that ellipse are the eigenvectors - always perpendicular. This is the fact PCA is built on.',
    },
    {
      id: 'symmetric-q', kind: 'checkpoint', skill: 'eigen', purpose: 'check', title: 'The special property',
      prompt: 'The eigenvectors of a symmetric matrix (for different eigenvalues) are always…',
      question: {
        type: 'choice', options: [
          { id: 'a', label: 'perpendicular', correct: true },
          { id: 'b', label: 'parallel' },
          { id: 'c', label: 'the columns of the matrix', misconception: 'columns-eigen' },
          { id: 'd', label: 'of length 1 automatically' },
        ],
      },
    },

    // ---------------------------------------------------------------- 8-9. data, covariance, PCA
    {
      id: 'data', kind: 'scene', chapter: 'The shape of data', title: 'Covariance', scene: vis('covariance_ellipse'),
      narration: 'Now some data. § Its covariance matrix records how the points spread and how x and y move together. § It is symmetric, so it has perpendicular eigenvectors: the axes of the data’s own ellipse.',
    },
    {
      id: 'pca', kind: 'scene', chapter: 'PCA', title: 'The direction of greatest spread', scene: vis('pca_projection'),
      narration: 'Project the points onto a line and measure how spread out the shadows are. Turn the line. The spread is largest exactly along the top eigenvector of the covariance matrix, and the largest spread is its eigenvalue. That direction is the first principal component.',
    },
    {
      id: 'pca-try', kind: 'explore', title: 'Find the widest shadow', skill: 'pca', scene: vis('pca_projection'),
      prompt: 'Turn the line until the shadows are **as spread out as possible**.',
      setup: hold('pca_projection', {}, (s) => s.th.set_value(s.phi1 + 1.2)),
      goals: [{ id: 'pc1', check: (s: any) => Math.abs(Math.sin(s.th.get_value() - s.phi1)) < 0.03, message: 'The widest shadow lies along the top eigenvector of the covariance matrix: the first principal component.' }],
      hints: ['Watch the plot on the right: find its peak.'],
      solve: (s: any) => s.th.set_value(s.phi1),
    },
    {
      id: 'pca-q', kind: 'checkpoint', skill: 'pca', purpose: 'check', title: 'Not a regression line',
      prompt: 'Is the first principal component the same line as the least-squares regression of $y$ on $x$?',
      question: {
        type: 'choice', options: [
          { id: 'a', label: 'No - PCA makes the *perpendicular* distances smallest; regression the *vertical* ones', correct: true },
          { id: 'b', label: 'Yes, both are the line of best fit', misconception: 'pca-regression', feedback: 'Regression treats $x$ as exact and only measures errors in $y$. PCA treats both coordinates alike.' },
        ],
      },
    },

    // ---------------------------------------------------------------- 10. dimensionality reduction
    {
      id: 'reduce', kind: 'scene', chapter: 'Fewer dimensions', title: 'Flatten a cloud', scene: vis('pca_3d'),
      narration: 'In three dimensions the top two eigenvectors span the plane that keeps the most variance. Flatten the cloud onto it and you lose very little. That is dimensionality reduction.',
    },
    {
      id: 'reduce-q', kind: 'checkpoint', skill: 'pca', purpose: 'check', title: 'How much is kept?',
      prompt: 'The covariance matrix of a 3D cloud has eigenvalues $9$, $4$ and $1$. What fraction of the variance do the first two principal components keep?',
      question: { type: 'number', answer: 13 / 14, tolerance: 0.01, wrong: [{ answer: 2 / 3, feedback: 'Not two out of three components - weight them by their variance: $(9 + 4)/(9 + 4 + 1)$.' }] },
      explain: '$(9 + 4) / 14 \\approx 0.93$: flattening keeps 93% of the spread.',
    },
  ],
};
