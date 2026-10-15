import { expect, test } from '@playwright/test';
import { fusionnerAvecBase } from '../../src/panel/storage/sync';
import type { AppData } from '../../src/panel/model';
import { donneesTest } from './outils';

// Benjamin (2026-10-15) : « je voudrais que tout le monde utilise le même fichier ». Quatre Cockpit (deux navigateurs,
// version perso et version d'équipe) partagent un cockpit.json ; la simple réunion faisait revenir ce qu'il
// supprimait et doublait une vente passée de CAT 1 à CAT 2. Fusion à trois avec le dernier état commun.

const base = (): AppData => {
  const d = donneesTest() as unknown as AppData;
  d.updatedAt = 1000;
  d.anamnese.phrases = { 'Conversations de groupe': ['Bruit', 'Répéter', 'Renouveler'], Mutuelle: ['Aesio', 'Axa'] };
  d.ventes.sales = { 'Octobre 2026': [{ name: 'Patient A', cat: 1 }, { name: 'Patient B', cat: 1 }] };
  return d;
};
/** Copie modifiée d'un côté, datée `t`. */
const copie = (t: number, f: (d: AppData) => void): AppData => { const d = structuredClone(base()); f(d); d.updatedAt = t; return d; };
const titres = (d: AppData) => d.templates.map((x) => x.title);

test.describe('Fichier partagé : fusion avec le dernier état commun', () => {
  test('modèle supprimé dans un autre Cockpit : supprimé ici aussi', () => {
    const b = base();
    const supprime = b.templates[1].title;
    const out = fusionnerAvecBase(b, structuredClone(b), copie(2000, (d) => { d.templates.splice(1, 1); }));
    expect(titres(out)).not.toContain(supprime);
    expect(out.templates).toHaveLength(b.templates.length - 1);
  });

  test('modèle supprimé ici, fichier inchangé : il ne revient pas', () => {
    const b = base();
    const out = fusionnerAvecBase(b, copie(2000, (d) => { d.templates.splice(0, 1); }), structuredClone(b));
    expect(out.templates).toHaveLength(b.templates.length - 1);
    expect(titres(out)).not.toContain(b.templates[0].title);
  });

  test('vente passée en CAT 2 ailleurs : une seule vente, en CAT 2 (plus de doublon)', () => {
    const b = base();
    const out = fusionnerAvecBase(b, structuredClone(b), copie(2000, (d) => { d.ventes.sales['Octobre 2026'][0].cat = 2; }));
    expect(out.ventes.sales['Octobre 2026']).toEqual([{ name: 'Patient A', cat: 2 }, { name: 'Patient B', cat: 1 }]);
  });

  test('vente passée en CAT 2 ici, vente ajoutée ailleurs : les deux changements sont gardés', () => {
    const b = base();
    const out = fusionnerAvecBase(b,
      copie(3000, (d) => { d.ventes.sales['Octobre 2026'][1].cat = 2; }),
      copie(2000, (d) => { d.ventes.sales['Octobre 2026'].push({ name: 'Patient C', cat: 1 }); }));
    expect(out.ventes.sales['Octobre 2026']).toEqual(expect.arrayContaining([{ name: 'Patient A', cat: 1 }, { name: 'Patient B', cat: 2 }, { name: 'Patient C', cat: 1 }]));
    expect(out.ventes.sales['Octobre 2026']).toHaveLength(3);
  });

  test('phrase ajoutée ici (« Résonne »), phrase supprimée ailleurs (« Axa ») : les deux s\'appliquent', () => {
    const b = base();
    const out = fusionnerAvecBase(b,
      copie(2000, (d) => { d.anamnese.phrases['Conversations de groupe'].push('Résonne'); }),
      copie(3000, (d) => { d.anamnese.phrases.Mutuelle = ['Aesio']; }));
    expect(out.anamnese.phrases['Conversations de groupe']).toEqual(['Bruit', 'Répéter', 'Renouveler', 'Résonne']);
    expect(out.anamnese.phrases.Mutuelle).toEqual(['Aesio']);
  });

  test('phrases réordonnées ailleurs (glisser) et phrase ajoutée ici : ordre de l\'autre, ajout à la fin', () => {
    const b = base();
    const out = fusionnerAvecBase(b,
      copie(2000, (d) => { d.anamnese.phrases['Conversations de groupe'].push('Résonne'); }),
      copie(3000, (d) => { d.anamnese.phrases['Conversations de groupe'] = ['Renouveler', 'Bruit', 'Répéter']; }));
    expect(out.anamnese.phrases['Conversations de groupe']).toEqual(['Renouveler', 'Bruit', 'Répéter', 'Résonne']);
  });

  test('même modèle modifié des deux côtés : la modification la plus récente gagne', () => {
    const b = base();
    const id = b.templates[0].id;
    const recent = fusionnerAvecBase(b,
      copie(3000, (d) => { d.templates[0].body = 'Version d\'ici'; }),
      copie(2000, (d) => { d.templates[0].body = 'Version d\'ailleurs'; }));
    expect(recent.templates.find((t) => t.id === id)?.body).toBe('Version d\'ici');
    const ancien = fusionnerAvecBase(b,
      copie(1500, (d) => { d.templates[0].body = 'Version d\'ici'; }),
      copie(2000, (d) => { d.templates[0].body = 'Version d\'ailleurs'; }));
    expect(ancien.templates.find((t) => t.id === id)?.body).toBe('Version d\'ailleurs');
  });

  test('modèle modifié ici mais supprimé ailleurs : la modification est gardée (rien ne se perd)', () => {
    const b = base();
    const out = fusionnerAvecBase(b,
      copie(2000, (d) => { d.templates[0].body = 'Retouché'; }),
      copie(3000, (d) => { d.templates.splice(0, 1); }));
    expect(out.templates.find((t) => t.id === b.templates[0].id)?.body).toBe('Retouché');
  });

  test('réglage des primes changé ailleurs : appliqué, jamais écrasé par l\'ancienne valeur', () => {
    const b = base();
    const out = fusionnerAvecBase(b, structuredClone(b), copie(2000, (d) => { d.ventes.settings.primeCat2 = 95; }));
    expect(out.ventes.settings.primeCat2).toBe(95);
  });

  test('ajouts des deux côtés : tout est gardé ; date = la plus récente des deux', () => {
    const b = base();
    const out = fusionnerAvecBase(b,
      copie(2000, (d) => { d.chatPartenaire.push({ id: 'chat-ici', label: 'Ici', text: 'x' }); }),
      copie(3000, (d) => { d.chatPartenaire.push({ id: 'chat-ailleurs', label: 'Ailleurs', text: 'y' }); }));
    expect(out.chatPartenaire.map((c) => c.id)).toEqual(expect.arrayContaining(['chat-ici', 'chat-ailleurs']));
    expect(out.updatedAt).toBe(3000);
  });

  test('aucun changement nulle part : identique à la base', () => {
    const b = base();
    const out = fusionnerAvecBase(b, structuredClone(b), structuredClone(b));
    const { updatedAt: _a, ...x } = out;
    const { updatedAt: _b, ...y } = b;
    expect(x).toEqual(y);
  });
});
