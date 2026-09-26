import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

const COSI1 = "COSI 1 - évaluation: l'intensité!";
const COSI2 = "COSI 2 - évaluation: l'intensité!";
const stepper = (page: any, situation: string, sens: 'plus' | 'moins') =>
  page.locator('.field-head').filter({ hasText: situation }).getByRole('button', { name: `COSI ${sens}` });

test.describe('COSI (suite)', () => {
  test('intensité non touchée : rien d\'envoyé pour les COSI', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.texts.map((t: any) => t.label)).not.toContain(COSI1);
    expect(d.texts.map((t: any) => t.label)).not.toContain(COSI2);
  });

  test('intensité touchée (+/−, bornée 1 à 5) : envoyée pour cette situation seulement', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const plus = stepper(page, 'Situation 1', 'plus');
    for (let i = 0; i < 6; i++) await plus.click();
    await stepper(page, 'Situation 1', 'moins').click();
    await expect(page.locator('.field-head').filter({ hasText: 'Situation 1' }).locator('.stepper b')).toHaveText('4');
    // Toucher seulement l'intensité suffit pour appliquer.
    await expect(page.getByRole('button', { name: /^Appliquer \(1\)/ })).toBeVisible();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.texts).toContainEqual({ label: COSI1, value: '4' });
    expect(d.texts.map((t: any) => t.label)).not.toContain(COSI2);
    expect(p.erreurs).toEqual([]);
  });

  test('intensité descendue sous 1 : reste à 1 mais compte comme touchée', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await stepper(page, 'Situation 2', 'moins').click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    expect((await p.demandes('fillAnamnese'))[0].texts).toContainEqual({ label: COSI2, value: '1' });
  });

  test('Appliquer sans rien choisir : « Aucune valeur choisie », rien envoyé', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'COSI');
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'Aucune valeur choisie');
    expect(await p.demandes('fillAnamnese')).toEqual([]);
  });

  test('échec de l\'écriture : les choix restent (écran et brouillon après rechargement)', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste, echecs: ['fillAnamnese'] });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: 'Binaurale', exact: true }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await expect(page.locator('.toast.err')).toContainText('Échec simulé fillAnamnese');
    expect((await p.demandes('fillAnamnese')).length).toBe(1);
    await expect(page.getByRole('button', { name: 'Binaurale', exact: true })).toHaveClass(/on/);
    await page.waitForTimeout(600);
    await page.reload();
    await aller(page, 'COSI');
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: 'Binaurale', exact: true })).toHaveClass(/on/);
  });

  test('écriture réussie : le brouillon est effacé (plus rien après rechargement)', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    await page.waitForTimeout(600);
    await page.reload();
    await aller(page, 'COSI');
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).not.toHaveClass(/on/);
  });
});

test.describe('Anamnèse (suite)', () => {
  test('retouche de l\'aperçu : c\'est le texte retouché qui est écrit', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Anamnèse');
    const ap = page.locator('.preview.editable').first();
    await expect(ap).toContainText('notre patiente');
    await ap.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' RETOUCHE');
    await page.getByRole('button', { name: /Écrire sans résumé/ }).click();
    await toast(page, 'OK writeComment');
    const [d] = await p.demandes('writeComment');
    expect(d.text).toContain('RETOUCHE');
    expect(d.text).toContain('notre patiente');
    expect(d.text).not.toContain('résumé Salesforce — copie-le');
    expect(p.erreurs).toEqual([]);
  });

  test('changer le genre remet la retouche à zéro (texte régénéré au masculin)', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Anamnèse');
    const ap = page.locator('.preview.editable').first();
    await ap.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' RETOUCHE');
    await page.getByRole('button', { name: 'M.', exact: true }).click();
    await expect(ap).not.toContainText('RETOUCHE');
    await expect(ap).toContainText('notre patient pour');
    await page.getByRole('button', { name: /Écrire sans résumé/ }).click();
    await toast(page, 'OK writeComment');
    const [d] = await p.demandes('writeComment');
    expect(d.text).not.toContain('RETOUCHE');
    expect(d.text).toContain('notre patient pour un dépistage');
  });
});
