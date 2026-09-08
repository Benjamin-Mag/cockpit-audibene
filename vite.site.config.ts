import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Site GitHub Pages : page d'installation + version web du panneau (sans manifest ni scripts d'extension).
export default defineConfig({
  root: here('./src'),
  publicDir: here('./public'),
  base: './',
  plugins: [preact()],
  define: { __COCKPIT_BUILD__: JSON.stringify('web') },
  build: {
    outDir: here('./dist-site'),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { index: here('./src/index.html'), panel: here('./src/panel.html') },
    },
  },
});
