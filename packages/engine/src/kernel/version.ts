// Mathium's version: one number for the engine and the site it runs (docs/DEPLOY.md, "Versions").
// Bump it here, with packages/engine/package.json (a test keeps the two equal), when a deploy changes what learners
// see; the build adds the commit and the date (__MATHIUM_BUILD__, apps/mathnim/vite.config.ts), so two builds of the
// same version can still be told apart.
export const MATHIUM_VERSION = '0.4.0';
