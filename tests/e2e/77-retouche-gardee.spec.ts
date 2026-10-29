import { type Page, expect, test } from '@playwright/test';
import { fusionnerRetouche } from '../../src/panel/fusion-retouche';
import { ONGLET, type Panneau, aller, ouvrir, toast } from './outils';

// Benjamin (29/10/2026) : « si je modifie à la volée un template et une anamnèse, si j'ai oublié un champ (Monsieur ou
// Madame), le template de base se réaffiche et on perd les modifications ». Le changement du modèle est maintenant
// reporté dans la retouche (fusion mot à mot). Mêmes cas que tests/fusion-retouche.spec.ts de Cockpit Plein Écran.
// Données fictives.

test.describe('Fusion d’une retouche avec le texte généré', () => {
  test('genre choisi après une retouche : les formes s’accordent, la phrase ajoutée reste', () => {
    const avant = 'Bonjour M./Mme Essai,\nle patient(e) est venu(e) au centre.\nCordialement';
    const apres = 'Bonjour Mme Essai,\nla patiente est venue au centre.\nCordialement';
    const retouche = 'Bonjour M./Mme Essai,\nle patient(e) est venu(e) au centre avec sa fille.\nÀ bientôt, cordialement';
    expect(fusionnerRetouche(avant, apres, retouche)).toBe('Bonjour Mme Essai,\nla patiente est venue au centre avec sa fille.\nÀ bientôt, cordialement');
  });

  test('mot changé des deux côtés : celui de l’utilisateur reste ; rien retouché : le nouveau texte', () => {
    expect(fusionnerRetouche('Le patient(e) est satisfait(e).', 'La patiente est satisfaite.', 'Le patient(e) est ravi(e).')).toBe('La patiente est ravi(e).');
    expect(fusionnerRetouche('a b', 'a c', 'a b')).toBe('a c');
    expect(fusionnerRetouche('a b', 'a b', 'a b d')).toBe('a b d');
  });
});

const RDV = { date: '2026-11-12', heure: '14:30', champ: 'Date du rendez-vous' };
const texteCopie = async (p: Panneau) => (await p.presse()).replace(/\r\n/g, '\n');

/** Opportunité dont la fiche porte un rendez-vous (le faux navigateur la lit en passant sur son onglet). */
async function oppAvecRdv(page: Page) {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  await page.evaluate((rdv) => { const m = (window as any).__mock; m.FICHES[12].rdv = rdv; m.activer(12); }, RDV);
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  await aller(page, 'Mails');
  return p;
}

test('Mails : texte retouché, puis date du RDV changée : la date suit, la retouche reste ; « Revenir au modèle » la retire', async ({ page }) => {
  const p = await oppAvecRdv(page);
  await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
  const corps = page.locator('.preview.editable:not(.subj-line)').first();
  await expect(corps).toContainText('confirmé le 12 novembre 2026 à 14h30');
  await corps.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nPS : apportez vos appareils');
  await page.getByLabel('Date du RDV').fill('2026-11-20');
  await expect(corps).toContainText('confirmé le 20 novembre 2026 à 14h30');
  await expect(corps).toContainText('PS : apportez vos appareils');
  await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
  await toast(page, 'Message copié');
  const copie = await texteCopie(p);
  expect(copie).toContain('Votre rendez-vous est confirmé le 20 novembre 2026 à 14h30.');
  expect(copie).toMatch(/PS : apportez vos appareils$/);
  await page.getByRole('button', { name: 'Revenir au modèle' }).click();
  await expect(corps).not.toContainText('PS : apportez vos appareils');
});
