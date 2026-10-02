import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Benjamin (02/10) : pouvoir écrire un nouveau modèle en partant d'un modèle existant.
test('Mails : dupliquer un modèle crée une copie modifiable, l\'original ne bouge pas', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.opportunite });
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  await aller(page, 'Mails');
  await page.getByRole('button', { name: /Relance CC1/ }).click();
  const original = (await p.donnees()).templates.find((t: any) => t.id === 'tpl-cc1');
  await page.getByRole('button', { name: /Dupliquer ce modèle/ }).click();
  await expect(page.getByText('Nouveau modèle')).toBeVisible();
  const titre = page.getByPlaceholder('Ex. Confirmation de rendez-vous');
  await expect(titre).toHaveValue('Relance CC1 (copie)');
  const corps = page.locator('textarea').first();
  await expect(corps).toHaveValue(original.body);
  await titre.fill('Relance CC1 courte');
  await corps.fill('Bonjour {{nom}}, petite relance.');
  await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
  await toast(page, 'Modèle enregistré');
  await expect.poll(async () => (await p.donnees()).templates.map((t: any) => t.title)).toContain('Relance CC1 courte');
  const apres = (await p.donnees()).templates;
  expect(apres.find((t: any) => t.id === 'tpl-cc1')).toEqual(original);
  const copie = apres.find((t: any) => t.title === 'Relance CC1 courte');
  expect(copie.id).not.toBe('tpl-cc1');
  expect(copie.audience).toBe(original.audience);
  expect(copie.patientCategory).toBe(original.patientCategory);
  expect(p.erreurs).toEqual([]);
});
