import archiver from 'archiver';
import { copyFileSync, createWriteStream, mkdirSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
mkdirSync('release', { recursive: true });
const file = `release/cockpit-audibene-${version}.zip`;
const out = createWriteStream(file);
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(out);
zip.directory('dist/', false);
await zip.finalize();
await new Promise((r) => out.on('close', r));
// Nom stable pour le lien « dernière version » du site.
copyFileSync(file, 'release/cockpit-audibene.zip');
console.log(`${file} (${(zip.pointer() / 1024).toFixed(0)} Ko) + release/cockpit-audibene.zip`);
