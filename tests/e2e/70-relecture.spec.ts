import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Correctifs issus de la relecture du design fusion (Agent 1, 26/09). Chaque test échouait avant son correctif.
test.describe('Relecture : correctifs', () => {
  test('Message vocal : le raccourci run-mv ne relance pas un MV déjà en cours', async ({ page }) => {
    await page.clock.install();
    const p = await ouvrir(page, { onglet: ONGLET.piste, pageMuette: true });
    await page.getByRole('button', { name: /Message vocal/ }).first().click();
    await expect.poll(async () => (await p.demandes('runMv')).length).toBe(1);
    const reponse = await page.evaluate(() => new Promise((resolve) => {
      (window as any).chrome.runtime.onMessage._emit({ type: 'command', command: 'run-mv' }, {}, resolve);
      setTimeout(() => resolve('pas de réponse'), 1000);
    }));
    expect(reponse).toBe(true);
    await page.clock.fastForward(2_000);
    expect((await p.demandes('runMv')).length).toBe(1);
    // Une fois le premier MV terminé (page muette : délai de 90 s), un nouveau MV repart.
    await page.clock.fastForward(91_000);
    await expect(page.locator('.toast.err')).toContainText('La page ne répond pas');
    await page.getByRole('button', { name: /Message vocal/ }).first().click();
    await expect.poll(async () => (await p.demandes('runMv')).length).toBe(2);
    expect(p.erreurs).toEqual([]);
  });

  test('Réglages reste accessible quand la page Salesforce ne répond pas', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, sansContexte: true });
    await expect(page.getByText('Connexion à la page Salesforce…')).toBeVisible();
    await page.getByRole('button', { name: 'Réglages', exact: true }).first().click();
    await expect(page.getByText('Signature', { exact: true })).toBeVisible();
  });
});
