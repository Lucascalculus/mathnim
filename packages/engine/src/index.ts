// @mathnim/engine: the kernel figures are made with (docs/design/ENGINE.md). A figure is state (params and what is
// derived from them), things with roles that show it, a layout by rules, a script that is a pure function of time,
// and the checks that must hold. The look (@mathnim/look) says how every role looks; the renderer draws only what
// changed; the GPU tier shades fields; lint(), describe() and explain() make it readable to agents and the doctor.
export * from './state';
export * from './text';
export * from './geom';
export * from './tex';
export * from './thing';
export * from './layout';
export * from './kinds';
export * from './script';
export * from './render';
export * from './gpu';
export * from './figure';
export * from './player';
export * from './acts';
export * from './mirror';
export * from './shapes';
export * from './view3d';
export * from './sim';
export * from './vectors';
export * from './version';
export * from './steps';
export * from './steps_check';
