import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const BUILD_TIME = new Date().toISOString();

/**
 * Configuração Vite v5.22.2
 *
 * Define globals injetadas via `define`:
 *   - window.__APP_VERSION__ — versão do package.json (visível em /health)
 *   - window.__BUILD_TIME__  — timestamp ISO do build (visível em /health)
 *
 * `manualChunks` separa o vendor (vue/vuex/router/supabase) do código próprio
 * para que mudanças no app não invalidem cache do browser de bibliotecas
 * estáveis.
 */
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, host: '0.0.0.0' },
  define: {
    'window.__APP_VERSION__': JSON.stringify(pkg.version),
    'window.__BUILD_TIME__': JSON.stringify(BUILD_TIME),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('vue-router')) return 'vendor-vue-router';
            if (id.includes('vuex')) return 'vendor-vuex';
            if (id.includes('vue')) return 'vendor-vue';
            if (id.includes('bootstrap')) return 'vendor-bootstrap';
            return 'vendor-misc';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
