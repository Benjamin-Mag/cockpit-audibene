import { ONGLET, aller, donneesTest, expect, ouvrir, test, toast } from './outils';

const COSI1 = "COSI 1 - évaluation: l'intensité!";
const COSI2 = "COSI 2 - évaluation: l'intensité!";
const intensite = (page: any, situation: string) => page.getByRole('group', { name: `${situation} : intensité COSI de 1 à 5` });

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

  test('intensité en boutons 1 à 5 : un clic choisit, envoyée pour cette situation seulement', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const g = intensite(page, 'Situation 1');
    await expect(g.getByRole('button')).toHaveText(['1', '2', '3', '4', '5']);
    await expect(g.getByRole('button', { pressed: true })).toHaveCount(0);
    await g.getByRole('button', { name: '2', exact: true }).click();
    await g.getByRole('button', { name: '4', exact: true }).click();
    await expect(g.getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(g.getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(intensite(page, 'Situation 2').getByRole('button', { pressed: true })).toHaveCount(0);
    // Toucher seulement l'intensité suffit pour appliquer.
    await expect(page.getByRole('button', { name: /^Appliquer \(1\)/ })).toBeVisible();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.texts).toContainEqual({ label: COSI1, value: '4' });
    expect(d.texts.map((t: any) => t.label)).not.toContain(COSI2);
    expect(p.erreurs).toEqual([]);
  });

  test('second clic sur le chiffre choisi : il est retiré, rien d\'envoyé', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const g = intensite(page, 'Situation 2');
    await g.getByRole('button', { name: '1', exact: true }).click();
    await expect(g.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await g.getByRole('button', { name: '1', exact: true }).click();
    await expect(g.getByRole('button', { pressed: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'Aucune valeur choisie');
    await g.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    expect((await p.demandes('fillAnamnese'))[0].texts).toContainEqual({ label: COSI2, value: '5' });
  });

  test('largeur minimale du panneau : « COSI » et les cinq chiffres tiennent à droite de « Situation N »', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 860 });
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    for (const s of ['Situation 1', 'Situation 2']) {
      const tete = page.locator('.field-head').filter({ has: intensite(page, s) });
      await expect(tete.locator('.cosi-int-lib')).toHaveText('COSI');
      const t = (await tete.boundingBox())!;
      const libelle = (await tete.locator('.label').boundingBox())!;
      const boutons = intensite(page, s).getByRole('button');
      const premier = (await boutons.first().boundingBox())!;
      const dernier = (await boutons.last().boundingBox())!;
      expect(Math.abs(premier.y - dernier.y)).toBeLessThan(1);
      expect(premier.x).toBeGreaterThan(libelle.x + libelle.width);
      expect(dernier.x + dernier.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

// Benjamin (2026-10-08) : « le {{tel_conseiller}} ne remonte pas dans l'anamnèse » — son téléphone était vide
// dans les Réglages de ce navigateur, et la ligne disparaissait sans rien dire.
test.describe('Variables du conseiller vides', () => {
  const sansTel = () => { const d: any = donneesTest(); d.reglages.telephone = ''; for (const k of Object.keys(d.anamnese.textes)) d.anamnese.textes[k] += '\n{{tel_conseiller}}'; return d; };
  const alerte = (page: import('@playwright/test').Page) => page.locator('.vars-vides');

  test('Anamnèse : « Ton téléphone n\'est pas rempli dans Réglages » ; plus rien une fois rempli', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, donnees: sansTel() });
    await aller(page, 'Anamnèse');
    await expect(alerte(page)).toContainText('Ton téléphone n’est pas rempli dans Réglages');
    await aller(page, 'Réglages');
    await page.locator('.field').filter({ hasText: 'Téléphone' }).locator('input').first().fill('06 00 00 00 07');
    await aller(page, 'Anamnèse');
    await expect(page.locator('.preview.editable').first()).toContainText('06 00 00 00 07');
    await expect(alerte(page)).toHaveCount(0);
  });

  test('Chat partenaire et Mails : même avertissement', async ({ page }) => {
    const d = sansTel();
    d.chatPartenaire[0].text += '\n{{tel_conseiller}}';
    d.templates[0].body += '\n{{tel_conseiller}}';
    await ouvrir(page, { onglet: ONGLET.opportunite, donnees: d });
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: 'Merci', exact: true }).click();
    await expect(alerte(page)).toContainText('Ton téléphone');
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
    await expect(alerte(page)).toContainText('Ton téléphone');
  });

  test('téléphone rempli : aucun avertissement', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await expect(page.locator('.preview.editable').first()).toBeVisible();
    await expect(alerte(page)).toHaveCount(0);
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
