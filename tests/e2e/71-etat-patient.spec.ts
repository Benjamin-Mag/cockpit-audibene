import { type Page } from '@playwright/test';
import { ONGLET, expect, ouvrir, test } from './outils';

// Benjamin (2026-10-16) : le rond vert / orange / rouge du nouveau design (v1.1.8), aussi dans la disposition classique :
// à gauche de « Salesforce », il dit si le patient de la fiche est bien lu (nom au survol).
test.describe('Rond d’état du patient (disposition classique)', () => {
  const rond = (page: Page) => page.locator('.brand .dot');

  test('Piste lue : rond vert, nom au survol ; sur Doctolib, rond simple', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await expect(rond(page)).toHaveClass(/\bok\b/);
    await expect(page.locator('.brand [title*="Alice Essai"]')).toHaveCount(1);
    await page.evaluate(() => (window as any).__mock.activer(13));
    await expect(page.locator('.brand')).toContainText('Doctolib');
    await expect(rond(page)).not.toHaveClass(/\b(ok|ko|lecture)\b/);
    expect(p.erreurs).toEqual([]);
  });

  test('patient pas lu : rond rouge ; « Relire la fiche » le relit et il passe au vert', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste, ficheVide: true });
    await expect(rond(page)).toHaveClass(/\bko\b/, { timeout: 10_000 });
    await expect(page.locator('.brand [title*="pas chargé"]')).toHaveCount(1);
    await page.evaluate(() => { (window as unknown as { __SCENARIO: { ficheVide: boolean } }).__SCENARIO.ficheVide = false; });
    await page.getByRole('button', { name: 'Relire la fiche' }).first().click();
    await expect(rond(page)).toHaveClass(/\bok\b/);
    await expect(page.locator('.brand [title*="Alice Essai"]')).toHaveCount(1);
    expect(p.erreurs).toEqual([]);
  });
});
