// Unit tests for the API (server/, functions/), the narration helpers they
// share, and the Narrator's use of live narration.
import { defineConfig } from 'vitest/config';

const here = decodeURIComponent(new URL('.', import.meta.url).pathname);
export default defineConfig({
  root: here,
  resolve: {
    alias: {
      'manim-web': `${here}../../../packages/manim-web/src`,
      '@mathnim/core': `${here}../../../packages/core/src`,
    },
  },
  test: { environment: 'node', include: ['**/*.test.ts'] },
});
