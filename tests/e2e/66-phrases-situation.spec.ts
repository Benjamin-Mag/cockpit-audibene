import { ONGLET, aller, expect, ouvrir, test } from './outils';

// Benjamin (02/10) : sous une situation choisie, les phrases enregistrées se distinguent des choix de situation.
test('COSI : les phrases enregistrées d\'une situation sont plus foncées que les choix de situation', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await aller(page, 'COSI');
  const bloc = page.locator('.situation').filter({ has: page.locator('.field-head', { hasText: 'Situation 1' }) }).first();
  await bloc.getByRole('button', { name: 'Télévision', exact: true }).click();
  const saisie = bloc.getByPlaceholder(/Nouvelle phrase/);
  await saisie.fill('Le son de la télé trop fort');
  await saisie.press('Enter');
  const phrase = bloc.locator('.sub .chip').filter({ hasText: 'Le son de la télé trop fort' }).first();
  await expect(phrase).toBeVisible();
  await page.mouse.move(0, 0);
  const choix = bloc.getByRole('button', { name: 'Musique', exact: true });
  const fond = (l: typeof phrase) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
  // Plus foncé = luminance plus basse que celle d'un choix de situation non coché.
  const lum = (rgb: string) => { const [r, g, b] = rgb.match(/\d+/g)!.map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  expect(lum(await fond(phrase))).toBeLessThan(lum(await fond(choix)) - 8);
  expect(p.erreurs).toEqual([]);
});
