import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { dev_api } from './server/dev';
import { mangle_internals } from './vite.mangle';
import { MATHIUM_VERSION } from '../../packages/engine/src/kernel/version';

// Model keys live in the repo's .env.local (or the environment) and are only
// read here, on the dev server, so a key never reaches the browser. The /api
// routes are the production Pages Functions' handlers (server/, see
// docs/DEPLOY.md) mounted as middleware: /api/providers, /api/ai, /api/tts,
// /api/feedback, /api/auth/*, /api/me/state, /api/studio/*. Only the
// Anthropic proxy is dev-only.
const root = path.resolve(__dirname, '../..');

function keyed(target: string, header: (key: string) => [string, string], key: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/[a-z]+/, ''),
    configure: (proxy) => proxy.on('proxyReq', (req) => req.setHeader(...header(key))),
  };
}

// Which build this is (Settings and <meta name="generator"> show it beside the version): the commit, "+" when the tree
// had uncommitted changes, and the day it was built. "dev" on the dev server.
function build_stamp(command: string): string {
  if (command !== 'build') return 'dev';
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
    const dirty = execSync('git status --porcelain --untracked-files=no -- apps packages', { cwd: root }).toString().trim() ? '+' : '';
    return `${sha}${dirty} ${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default defineConfig(({ mode, command }) => {
  const build = build_stamp(command);
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const proxy: Record<string, ProxyOptions> = {};
  if (env.ANTHROPIC_API_KEY) proxy['/api/anthropic'] = keyed('https://api.anthropic.com', (k) => ['x-api-key', k], env.ANTHROPIC_API_KEY);
  // accounts and uploaded courses in dev: Node's built-in SQLite (Node 22+), loaded only when a route needs it
  const sqlite = (file: string) => new (createRequire(import.meta.url)('node:sqlite').DatabaseSync)(file);
  const api_options = { env, fs, cache_dir: path.resolve(__dirname, 'node_modules/.cache/mathnim'), sqlite, bin_fs: fs };
  const api: Plugin = {
    name: 'mathnim-api',
    configureServer: (server) => void server.middlewares.use(dev_api(api_options)),
    configurePreviewServer: (server) => void server.middlewares.use(dev_api(api_options)),
  };
  const generator: Plugin = {
    name: 'mathium-version',
    transformIndexHtml: (html) => html.replace('</title>', `</title>\n<meta name="generator" content="Mathium ${MATHIUM_VERSION} (${build})">`),
  };
  return {
    // real paths (/<course>/<lesson>): assets are absolute, and dev / preview answer every page path with index.html
    base: '/',
    appType: 'spa',
    // (production builds rename our internal properties: vite.mangle.ts)
    plugins: [api, generator, mangle_internals(root)],
    define: { __MATHIUM_VERSION__: JSON.stringify(MATHIUM_VERSION), __MATHIUM_BUILD__: JSON.stringify(build) },
    resolve: {
      alias: {
        'manim-web': path.resolve(__dirname, '../../packages/manim-web/src'),
        '@mathnim/core': path.resolve(__dirname, '../../packages/core/src'),
        '@mathnim/present': path.resolve(__dirname, '../../packages/present/src'),
        '@mathnim/ai': path.resolve(__dirname, '../../packages/ai/src'),
        '@mathnim/visuals': path.resolve(__dirname, '../../packages/visuals/src'),
        '@mathnim/engine': path.resolve(__dirname, '../../packages/engine/src'),
        '@mathnim/look': path.resolve(__dirname, '../../packages/look/src'),
      },
    },
    server: { fs: { allow: ['../..'] }, proxy },
    worker: { format: 'es', plugins: () => [mangle_internals(root)] },
  };
});
