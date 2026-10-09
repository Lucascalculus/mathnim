import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { 'manim-web': path.resolve(__dirname, '../manim-web/src'), '@mathnim/core': path.resolve(__dirname, '../core/src'), '@mathnim/present': path.resolve(__dirname, '../present/src'), '@mathnim/visuals': path.resolve(__dirname, '../visuals/src') } },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
