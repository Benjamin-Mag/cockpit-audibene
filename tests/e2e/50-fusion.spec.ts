import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Propre au design « fusion » (barre du bas + écran Fiche).
test.describe('Design fusion', () => {
  test('l\'écran Fiche liste le parcours et signale une saisie en cours', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.locator('.etape')).toHaveCount(4);
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await expect(page.locator('nav.barre .marque')).toHaveCount(0);
    await aller(page, 'Fiche');
    await expect(page.locator('.etape').filter({ hasText: 'COSI' })).toContainText('Reprendre');
    await expect(page.locator('nav.barre button').filter({ hasText: 'COSI' }).locator('.marque')).toHaveCount(1);
    await page.locator('.etape').filter({ hasText: 'COSI' }).click();
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).toHaveClass(/on/);
  });

  test('Message vocal accessible depuis n\'importe quel écran de la Piste', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'ORL Finder');
    await page.getByRole('button', { name: /^MV$/ }).click();
    await toast(page, 'OK runMv');
    expect((await p.demandes('runMv')).length).toBe(1);
  });

  test('le dernier écran est retrouvé quand le navigateur recharge le panneau', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator('nav.barre button.on')).toHaveText(/Anamnèse/);
  });

  test('en éditant un modèle, la barre du bas laisse la place ; elle revient après Annuler', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.opportunite });
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await expect(page.locator('nav.barre')).toBeHidden();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('nav.barre')).toBeVisible();
  });

  test('Réglages s\'ouvre et se referme avec la roue', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Réglages');
    await expect(page.getByText('Signature', { exact: true })).toBeVisible();
    await aller(page, 'Réglages');
    await expect(page.locator('.etape').first()).toBeVisible();
  });

  test('le message court ne recouvre ni Appliquer ni la barre du bas', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: /Appliquer/ }).click();
    const t = await page.locator('.toast').boundingBox();
    const f = await page.locator('.footer').boundingBox();
    const b = await page.locator('nav.barre').boundingBox();
    expect(t!.y + t!.height).toBeLessThanOrEqual(f!.y + 1);
    expect(t!.y + t!.height).toBeLessThanOrEqual(b!.y + 1);
  });

  test('sur Doctolib : pas de parcours inutile, le collage reste en tête', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.doctolib, recents: [{ recordId: 'x', genre: 'F', prenom: 'Alice', nom: 'Essai', email: '', telephone: '', naissance: '', savedAt: Date.now() }] });
    await expect(page.getByRole('button', { name: /Coller Alice Essai/ })).toBeVisible();
    await expect(page.locator('.etape')).toHaveCount(0);
  });

  test('SMS Hearo et Chat partenaire ne se ressemblent plus', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.opportunite });
    await expect(page.getByRole('button', { name: /^SMS$/ })).toBeVisible();
  });
});
