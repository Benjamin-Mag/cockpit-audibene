import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Build principal : panneau latéral (panel.html) + service worker (background.js).
// Le script de contenu est construit à part (vite.content.config.ts) car il doit
// être un seul fichier sans import.
export default defineConfig({
  root: here('./src'),
  publicDir: here('./public'),
  plugins: [preact()],
  define: { __COCKPIT_BUILD__: JSON.stringify(process.env.COCKPIT_BUILD_ID ?? 'dev') },
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        panel: here('./src/panel.html'),
        background: here('./src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
