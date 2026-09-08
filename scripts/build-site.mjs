import { build } from 'vite';
import { rmSync } from 'node:fs';

await build({ configFile: 'vite.site.config.ts' });
rmSync('dist-site/manifest.json', { force: true });
console.log('site → dist-site/');
