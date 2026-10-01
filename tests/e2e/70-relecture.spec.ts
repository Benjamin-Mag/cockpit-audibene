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

  test('Réglages ne se referme pas quand une page Salesforce sans fiche change d\'adresse', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.accueilSf });
    await expect(page.getByText('Pas de fiche patient sur cette page.')).toBeVisible();
    await aller(page, 'Réglages');
    await expect(page.getByText('Signature', { exact: true })).toBeVisible();
    // Navigation dans Salesforce sans ouvrir de fiche : le script de page pousse un nouveau contexte.
    await page.evaluate(() => {
      const { port } = (window as any).__mock.ports.at(-1);
      port.onMessage._emit({ type: 'contextChanged', context: { page: 'other', recordId: '', url: 'https://audibene.lightning.force.com/lightning/o/Lead/list?filterName=Recent' } });
    });
    await page.waitForTimeout(300);
    await expect(page.getByText('Signature', { exact: true })).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });

  test('sur Doctolib, le collage du patient reste visible même après un clic dans la barre du bas', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.doctolib, recents: [{ recordId: 'x', genre: 'F', prenom: 'Alice', nom: 'Essai', email: '', telephone: '', naissance: '', savedAt: Date.now() }] });
    await expect(page.getByRole('button', { name: /Coller Alice Essai/ })).toBeVisible();
    await aller(page, 'COSI');
    await expect(page.getByRole('button', { name: /Coller Alice Essai/ })).toBeVisible();
  });

  test('le dernier écran gardé n\'est pas compté comme une saisie en cours', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    const lire = () => page.evaluate(() => (window as any).__mock.session._d.cockpitBrouillons?.['lead:PISTETEST0000001A']);
    await expect.poll(async () => (await lire())?.ecran).toBe('commentaire');
    // L'écran gardé n'est pas un champ de saisie (seule la mémoire de la fiche lue, `__fiche`, peut s'y trouver).
    expect(Object.keys((await lire()).champs).filter((n) => n !== '__fiche')).toEqual([]);
    await page.reload();
    await expect(page.locator('nav.barre button.on')).toHaveText(/Anamnèse/);
  });
});
