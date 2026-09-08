// Construit le panneau + service worker puis le script de contenu avec le MÊME
// identifiant de build : le panneau remplace tout script de page dont l'identifiant
// diffère (sinon un onglet Salesforce ouvert garderait l'ancien code).
import { build } from 'vite';

process.env.COCKPIT_BUILD_ID = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
await build({ configFile: 'vite.config.ts' });
await build({ configFile: 'vite.content.config.ts' });
console.log(`build ${process.env.COCKPIT_BUILD_ID}`);
