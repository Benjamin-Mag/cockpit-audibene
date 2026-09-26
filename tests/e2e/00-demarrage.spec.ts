import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

test('premier lancement : accueil, sans dossier, nom, c\'est parti', async ({ page }) => {
  const p = await ouvrir(page, { donnees: null });
  await expect(page.getByText('Bienvenue dans Cockpit')).toBeVisible();
  await page.getByRole('button', { name: /Sans dossier/ }).click();
  await page.getByPlaceholder('Prénom et nom').fill('Benjamin Magnier');
  await page.getByRole('button', { name: /C'est parti/ }).click();
  await toast(page, 'Bienvenue Benjamin Magnier');
  await expect.poll(async () => (await p.donnees())?.onboardingDone).toBe(true);
  expect(p.erreurs).toEqual([]);
});

test('Piste : la fiche du patient s\'affiche', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  await expect(page.getByText('06 00 00 00 01').first()).toBeVisible();
  expect(p.erreurs).toEqual([]);
});
