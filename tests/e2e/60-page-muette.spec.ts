import { ONGLET, expect, ouvrir, test } from './outils';

// Le script de page répond au ping mais plus à rien d'autre (Salesforce figé) : délais de bridge.ts
// (fiche 20 s, actions 90 s). On avance l'horloge du panneau au lieu d'attendre.
test.describe('Page Salesforce muette', () => {
  test('la fiche finit en « Lecture impossible » au lieu de charger sans fin', async ({ page }) => {
    await page.clock.install();
    const p = await ouvrir(page, { onglet: ONGLET.piste, pageMuette: true });
    await expect.poll(async () => (await p.demandes('readFiche')).length).toBe(1);
    await page.clock.fastForward(21_000);
    await expect(page.getByText(/Lecture impossible/).first()).toBeVisible();
    // Une page muette n'est pas relue trois fois de plus.
    await page.clock.fastForward(5_000);
    expect((await p.demandes('readFiche')).length).toBe(1);
    expect(p.erreurs).toEqual([]);
  });

  test('Message vocal sur une page muette : message d\'erreur, bouton rendu', async ({ page }) => {
    await page.clock.install();
    const p = await ouvrir(page, { onglet: ONGLET.piste, pageMuette: true });
    const mv = page.getByRole('button', { name: /Message vocal/ }).first();
    await mv.click();
    await expect.poll(async () => (await p.demandes('runMv')).length).toBe(1);
    await page.clock.fastForward(91_000);
    await expect(page.locator('.toast.err')).toContainText('La page ne répond pas');
    await expect(mv).toBeEnabled();
    expect(p.erreurs).toEqual([]);
  });
});
