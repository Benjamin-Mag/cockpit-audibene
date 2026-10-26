import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Benjamin (26/10) : la croix dans la puce se cliquait par erreur. Plus de croix : clic gauche = cocher,
// clic droit (ou touche Menu, ou Maj+F10) = menu « Supprimer cette phrase », puis « Confirmer ? ».
test('phrase enregistrée : pas de croix ; clic gauche coche ; clic droit → Supprimer → Confirmer ? → supprimée', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await aller(page, 'COSI');
  const champ = page.locator('.field').filter({ hasText: 'Nom de la mutuelle' }).locator('input');
  await champ.fill('Mutuelle Essai au nom assez long');
  await champ.press('Enter');
  const puce = page.locator('.chip').filter({ hasText: 'Mutuelle Essai au nom assez long' }).first();
  await expect(puce).toBeVisible();
  await expect(page.locator('.chip .x')).toHaveCount(0);
  await expect(puce).toHaveAttribute('title', 'Clic droit pour supprimer');
  const menu = page.getByRole('menu');

  // Clic gauche : coche / décoche, aucun menu.
  const coche = () => puce.evaluate((e) => e.classList.contains('on'));
  const avant = await coche();
  await puce.click();
  await expect.poll(coche).toBe(!avant);
  await puce.click();
  await expect.poll(coche).toBe(avant);
  await expect(menu).toHaveCount(0);

  // Puce sans suppression (choix d'une liste) : pas de menu.
  const choix = page.locator('.field').filter({ hasText: 'Civilité' }).locator('.chip').first();
  await choix.click({ button: 'right' });
  await expect(menu).toHaveCount(0);
  await expect(choix).not.toHaveAttribute('aria-haspopup', 'menu');

  // Échap ferme le menu et rend le focus à la puce ; un clic ailleurs le ferme aussi.
  await puce.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Supprimer cette phrase' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(puce).toBeFocused();
  await puce.click({ button: 'right' });
  await page.mouse.click(2, 2);
  await expect(menu).toHaveCount(0);

  // Au clavier : Maj+F10 ou la touche Menu sur la puce focalisée.
  await puce.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ContextMenu');
  await expect(menu).toBeVisible();

  // Deux temps ; un double-clic ne supprime rien.
  await page.getByRole('menuitem', { name: 'Supprimer cette phrase' }).dblclick();
  await expect(page.getByRole('menuitem', { name: 'Confirmer ?' })).toBeVisible();
  expect((await p.donnees()).anamnese.phrases['Nom de la mutuelle'] ?? []).toContain('Mutuelle Essai au nom assez long');
  await page.waitForTimeout(450);
  await page.getByRole('menuitem', { name: 'Confirmer ?' }).click();
  await expect(menu).toHaveCount(0);
  await expect(puce).toHaveCount(0);
  await toast(page, 'Phrase supprimée');
  await expect.poll(async () => (await p.donnees()).anamnese.phrases['Nom de la mutuelle'] ?? []).not.toContain('Mutuelle Essai au nom assez long');
  expect(p.erreurs).toEqual([]);
});
