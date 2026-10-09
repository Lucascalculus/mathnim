import { defineConfig } from 'vite';

// Dev server for the playground and the regression gallery; serves examples/ at /.
export default defineConfig({
  publicDir: '../examples',
  server: { fs: { allow: ['..'] } },
});
