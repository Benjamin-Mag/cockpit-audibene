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

  test('Réglages s\'ouvre avec la roue et se referme sur l\'écran d\'avant', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await aller(page, 'Réglages');
    await expect(page.getByText('Signature', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await expect(page.locator('nav.barre button.on')).toHaveText(/COSI/);
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('nav.barre button.on')).toHaveText(/COSI/);
  });

  test('« Reprendre » seulement pour une vraie saisie, pas pour un simple choix d\'écran', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.opportunite });
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await page.getByRole('button', { name: /Nouveau patient partenaire/ }).click();
    await aller(page, 'Fiche');
    await expect(page.locator('.etape').filter({ hasText: 'Mails' })).not.toContainText('Reprendre');
    await aller(page, 'Mails');
    await page.locator('.preview.editable').last().click();
    await page.keyboard.type(' ajout');
    await aller(page, 'Fiche');
    await expect(page.locator('.etape').filter({ hasText: 'Mails' })).toContainText('Reprendre');
  });

  test('carte réduite : MV et Relire restent là même si la fiche est illisible', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.accueilSf });
    await aller(page, 'COSI');
    await expect(page.getByText('Pas de fiche patient sur cette page.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^MV$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Relire la fiche' })).toBeVisible();
  });

  test('Piste : pas de carte patient dans COSI ni Anamnèse, elle reste sur Fiche', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'COSI');
    await expect(page.locator('.fiche-mini')).toHaveCount(0);
    await aller(page, 'Anamnèse');
    await expect(page.locator('.fiche-mini')).toHaveCount(0);
    await aller(page, 'Fiche');
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Message vocal/ }).first()).toBeVisible();
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

  test('SMS Hearo porte son nom et reste à portée depuis Mails et Chat', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite });
    await expect(page.getByRole('button', { name: /^SMS$/ })).toBeVisible();
    await aller(page, 'Mails');
    await expect(page.getByRole('button', { name: /^SMS$/ })).toBeVisible();
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: /^SMS$/ }).click();
    await expect.poll(async () => (await p.journal()).filter((j) => j.api === 'page').map((j) => j.type)).toContain('openSms');
  });

  test('éditer un texte d\'Anamnèse ou du Chat : plein écran aussi', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.getByRole('button', { name: 'Modifier ce texte' }).click();
    await expect(page.locator('nav.barre')).toBeHidden();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('nav.barre')).toBeVisible();
  });
});
