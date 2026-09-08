import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: here('./dist'),
    emptyOutDir: false,
    target: 'es2022',
    minify: false,
    lib: {
      entry: here('./src/content/main.ts'),
      name: 'CockpitContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
