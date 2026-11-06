// import.meta.env (DEV: a development build; production builds drop what it guards).
/// <reference types="vite/client" />

/** Mathium's version (packages/engine/src/version.ts). */
declare const __MATHIUM_VERSION__: string;
/** The build of the site: commit and day (apps/mathnim/vite.config.ts); 'dev' on the dev server. */
declare const __MATHIUM_BUILD__: string;
