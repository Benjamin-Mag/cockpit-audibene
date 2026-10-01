import { ONGLET, aller, expect, ouvrir, test } from './outils';

// Benjamin (01/10) : la croix de suppression apparaît dans la puce, sans en changer la taille.
test('puce avec croix : même taille avant et pendant le survol, suppression toujours possible', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await aller(page, 'COSI');
  const champ = page.locator('.field').filter({ hasText: 'Nom de la mutuelle' }).locator('input');
  await champ.fill('Mutuelle Essai au nom assez long');
  await champ.press('Enter');
  const puce = page.locator('.chip').filter({ hasText: 'Mutuelle Essai au nom assez long' }).first();
  await expect(puce).toBeVisible();
  await page.mouse.move(0, 0);
  // Largeur de mise en page (offsetWidth) : la petite animation « pop » d'une puce cochée joue sur transform, pas sur la taille.
  const taille = () => puce.evaluate((e) => ({ l: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight }));
  const avant = await taille();
  await puce.hover();
  const croix = puce.locator('.x');
  await expect(croix).toHaveCSS('opacity', '1');
  const pendant = await taille();
  expect(pendant).toEqual(avant);
  const boite = await puce.boundingBox();
  // La croix est bien à l'intérieur de la puce.
  const bx = await croix.boundingBox();
  expect(bx!.x + bx!.width).toBeLessThanOrEqual(boite!.x + boite!.width + 0.5);
  await croix.click();
  await expect.poll(async () => (await p.donnees()).anamnese.phrases['Nom de la mutuelle'] ?? []).not.toContain('Mutuelle Essai au nom assez long');
  expect(p.erreurs).toEqual([]);
});
