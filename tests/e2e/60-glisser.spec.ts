import { ONGLET, aller, expect, glisser, ouvrir, test } from './outils';

const opp = async (page: any) => {
  const p = await ouvrir(page, { onglet: ONGLET.opportunite });
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  return p;
};

test.describe('Glisser-déposer pour réordonner', () => {
  test('Mails : catégories patient réordonnées depuis l\'éditeur (lignes de gestion)', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    await page.getByRole('button', { name: 'Modifier ce modèle' }).click();
    await page.getByRole('button', { name: /Ajouter, renommer, supprimer ou réordonner les catégories/ }).click();
    // Le nom d'une catégorie est dans un champ (valeur, pas texte) : on retrouve la ligne par cette valeur.
    const lignes = page.locator('.card .row.drag-wrap');
    await expect(lignes).toHaveCount(2);
    const ligne = async (nom: string) => {
      for (let i = 0; i < (await lignes.count()); i++) if ((await lignes.nth(i).locator('input').inputValue()) === nom) return lignes.nth(i);
      throw new Error(`Catégorie ${nom} introuvable`);
    };
    await glisser(page, await ligne('CC1'), await ligne('Reconfirmation'));
    await expect.poll(async () => (await p.donnees()).categories.patient.map((c: any) => c.id)).toEqual(['CC1', 'Reconfirmation']);
    // Les catégories partenaire ne bougent pas.
    expect((await p.donnees()).categories.partenaire.map((c: any) => c.id)).toEqual(['CC1', 'CC2']);
    // L'ordre suit dans les puces de l'éditeur.
    const puces = await page.locator('.field').filter({ hasText: 'Catégorie' }).locator('.chips .chip').allInnerTexts();
    expect(puces.map((t) => t.trim())).toEqual(['Toutes', 'CC1', 'Reconfirmation']);
    expect(p.erreurs).toEqual([]);
  });

  test('Mails : catégories réordonnées en glissant les puces de la liste', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    const puce = (nom: string) => page.locator('.drag-wrap').filter({ has: page.getByRole('button', { name: nom, exact: true }) });
    await glisser(page, puce('CC2'), puce('CC1'));
    await expect.poll(async () => (await p.donnees()).categories.partenaire.map((c: any) => c.id)).toEqual(['CC2', 'CC1']);
    expect((await p.donnees()).categories.patient.map((c: any) => c.id)).toEqual(['Reconfirmation', 'CC1']);
    expect(p.erreurs).toEqual([]);
  });

  test('Chat partenaire : textes réordonnés (liste de gestion puis puces)', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: /Modifier, supprimer ou réordonner les textes/ }).click();
    const ligne = (nom: string) => page.locator('.card .row.drag-wrap').filter({ hasText: nom });
    await glisser(page, ligne('Relance'), ligne('Merci'));
    await expect.poll(async () => (await p.donnees()).chatPartenaire.map((c: any) => c.label)).toEqual(['Relance', 'Merci']);
    const puce = (nom: string) => page.locator('.chips .drag-wrap').filter({ has: page.getByRole('button', { name: nom, exact: true }) });
    await glisser(page, puce('Merci'), puce('Relance'));
    await expect.poll(async () => (await p.donnees()).chatPartenaire.map((c: any) => c.label)).toEqual(['Merci', 'Relance']);
    expect(p.erreurs).toEqual([]);
  });

  test('lâcher un élément sur lui-même ne change rien', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Chat partenaire');
    const puce = page.locator('.chips .drag-wrap').filter({ has: page.getByRole('button', { name: 'Merci', exact: true }) });
    await glisser(page, puce, puce);
    await page.waitForTimeout(600);
    expect((await p.donnees()).chatPartenaire.map((c: any) => c.label)).toEqual(['Merci', 'Relance']);
  });
});
