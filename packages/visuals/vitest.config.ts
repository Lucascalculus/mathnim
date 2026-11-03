import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { 'manim-web': path.resolve(__dirname, '../manim-web/src'), '@mathnim/engine': path.resolve(__dirname, '../engine/src'), '@mathnim/look': path.resolve(__dirname, '../look/src') } },
  test: { environment: 'node', include: ['test/**/*.test.ts', 'src/**/*.test.ts'] },
});
