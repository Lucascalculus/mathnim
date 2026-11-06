// @mathnim/engine: the kernel figures are made with (docs/design/ENGINE.md). A figure is state (params and what is
// derived from them), things with roles that show it, a layout by rules, a script that is a pure function of time,
// and the checks that must hold. The look (@mathnim/look) says how every role looks; the renderer draws only what
// changed; the GPU tier shades fields; lint(), describe() and explain() make it readable to agents and the doctor.
// How it grows (docs/design/ENGINE-ARCH.md): src/kernel stays small and never imports src/lib; every piece of the
// library registers itself (kernel/registry.ts); the zones of a page meet on the page (kernel/page.ts).
export * from './kernel/state';
export * from './kernel/text';
export * from './kernel/geom';
export * from './kernel/tex';
export * from './kernel/thing';
export * from './kernel/layout';
export * from './kernel/kinds';
export * from './kernel/script';
export * from './kernel/render';
export * from './kernel/gpu';
export * from './kernel/figure';
export * from './kernel/player';
export * from './kernel/acts';
export * from './kernel/mirror';
export * from './kernel/registry';
export * from './kernel/expr';
export * from './kernel/page';
export * from './kernel/zone_figure';
export * from './lib/shapes';
export * from './lib/view3d';
export * from './kernel/sim';
export * from './lib/vectors';
export * from './kernel/version';
export * from './lib/steps';
export * from './lib/cases';
export * from './lib/trail';
export * from './lib/guess';
export * from './lib/parts';
export * from './lib/steps_check';
export * from './lib/predict';
export * from './lib/basics';
