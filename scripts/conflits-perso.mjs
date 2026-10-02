// Résout les conflits habituels d'un report dans Cockpit Benjamin : nom/version gardés en 2.x,
// documentation : côté upstream sauf la mention Ventes, ligne de journal ajoutée.
import fs from 'node:fs';
const [version, ligneJournal] = process.argv.slice(2);
const garde = {
  'package.json': `  "name": "cockpit-benjamin",\n  "version": "${version}",`,
  'public/manifest.json': `  "name": "Cockpit Benjamin",\n  "version": "${version}",\n  "description": "Panneau latéral pour Salesforce : anamnèse, MV non joignable, commentaires, mails, prise de RDV et suivi des ventes — version personnelle de Benjamin.",`,
};
for (const [f, g] of Object.entries(garde)) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('<<<<<<<')) s = s.replace(/<<<<<<< HEAD\n[\s\S]*?=======\n[\s\S]*?>>>>>>> [^\n]*\n/, () => g + '\n');
  else s = s.replace(/"version": "2\.\d+\.\d+"/, () => `"version": "${version}"`);
  if (s.includes('<<<<<<<')) throw new Error('conflit restant : ' + f);
  fs.writeFileSync(f, s);
}
let l = fs.readFileSync('package-lock.json', 'utf8');
if (l.includes('<<<<<<<')) l = l.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> [^\n]*\n/g, (m, a) => a);
l = l.replace(/"name": "cockpit-audibene"/g, '"name": "cockpit-benjamin"').replace(/("name": "cockpit-benjamin",\s*\n\s*)"version": "[^"]*"/g, (m, a) => a + `"version": "${version}"`);
fs.writeFileSync('package-lock.json', l);
let c = fs.readFileSync('CLAUDE.md', 'utf8');
while (c.includes('<<<<<<<')) {
  const m = c.match(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/);
  if (!m) throw new Error('marqueur CLAUDE.md illisible');
  c = c.replace(m[0], () => m[1]);
}
if (ligneJournal && !c.includes(ligneJournal)) {
  const ancre = c.match(/→ v2\.0\.\d+\.(?=[^\n]*\n)/g);
  const derniere = ancre ? ancre[ancre.length - 1] : null;
  if (derniere) { const i = c.lastIndexOf(derniere); c = c.slice(0, i + derniere.length) + ' ' + ligneJournal + c.slice(i + derniere.length); }
}
fs.writeFileSync('CLAUDE.md', c);
for (const f of ['docs/equipe/chef-orchestre.md']) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  while (s.includes('<<<<<<<')) {
    const m = s.match(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/);
    if (!m) throw new Error('marqueur journal illisible');
    s = s.replace(m[0], () => m[1] + m[2]);
  }
  fs.writeFileSync(f, s);
}
console.log('CONFLITS_PERSO_OK');
