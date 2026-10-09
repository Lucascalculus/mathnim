import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dev_api } from './server/dev';

// Model keys live in the repo's .env.local (or the environment) and are only
// read here, on the dev server, so a key never reaches the browser. The /api
// routes are the production Pages Functions' handlers (server/, see
// docs/DEPLOY.md) mounted as middleware: /api/providers, /api/deepseek/*,
// /api/tts, /api/feedback. Only the Anthropic proxy is dev-only.
const root = path.resolve(__dirname, '../..');

function keyed(target: string, header: (key: string) => [string, string], key: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/[a-z]+/, ''),
    configure: (proxy) => proxy.on('proxyReq', (req) => req.setHeader(...header(key))),
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const proxy: Record<string, ProxyOptions> = {};
  if (env.ANTHROPIC_API_KEY) proxy['/api/anthropic'] = keyed('https://api.anthropic.com', (k) => ['x-api-key', k], env.ANTHROPIC_API_KEY);
  const api_options = { env, fs, cache_dir: path.resolve(__dirname, 'node_modules/.cache/mathnim') };
  const api: Plugin = {
    name: 'mathnim-api',
    configureServer: (server) => void server.middlewares.use(dev_api(api_options)),
    configurePreviewServer: (server) => void server.middlewares.use(dev_api(api_options)),
  };
  return {
    plugins: [api],
    resolve: {
      alias: {
        'manim-web': path.resolve(__dirname, '../../packages/manim-web/src'),
        '@mathnim/core': path.resolve(__dirname, '../../packages/core/src'),
        '@mathnim/present': path.resolve(__dirname, '../../packages/present/src'),
        '@mathnim/ai': path.resolve(__dirname, '../../packages/ai/src'),
        '@mathnim/visuals': path.resolve(__dirname, '../../packages/visuals/src'),
      },
    },
    server: { fs: { allow: ['../..'] }, proxy },
    worker: { format: 'es' },
  };
});
