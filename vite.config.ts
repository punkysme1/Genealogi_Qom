import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'node:fs/promises';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), {
      name: 'nasab-local-seed',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__nasab-local/seed', async (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          try { res.end(await fs.readFile(path.resolve(__dirname, '.local/nasab-seed.json'), 'utf8')); }
          catch { res.statusCode = 404; res.end('{"error":"LOCAL_SEED_MISSING"}'); }
        });
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      watch: { ignored: ['**/.local/**'] },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
