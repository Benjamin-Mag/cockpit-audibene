import { ONGLET, aller, donneesTest, expect, ouvrir, test, toast } from './outils';

const RECENT = { recordId: 'PISTETEST0000001A', genre: 'F', prenom: 'Alice', nom: 'Essai', email: 'alice.essai@example.com', telephone: '06 00 00 00 01', naissance: '12/03/1951', savedAt: Date.now() - 120000 };
const RECENT2 = { ...RECENT, recordId: 'PISTETEST0000002A', prenom: 'Paul', nom: 'Exemple', genre: 'M' };

test.describe('Doctolib / Acuitis', () => {
  test('Doctolib : coller la dernière fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.doctolib, recents: [RECENT, RECENT2] });
    await page.getByRole('button', { name: /Coller Alice Essai sur Doctolib/ }).click();
    await toast(page, 'OK pastePatient');
    const [d] = await p.demandes('pastePatient');
    expect(d.data.nom).toBe('Essai');
    expect(d.data).not.toHaveProperty('recordId');
    await page.getByRole('button', { name: /Paul Exemple/ }).click();
    await expect.poll(async () => (await p.demandes('pastePatient')).length).toBe(2);
    expect(p.erreurs).toEqual([]);
  });

  test('Acuitis : coller la dernière fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.acuitis, recents: [RECENT] });
    await page.getByRole('button', { name: /Coller Alice Essai sur Acuitis/ }).click();
    await toast(page, 'OK pastePatient');
    expect((await p.demandes('pastePatient')).length).toBe(1);
  });

  // Benjamin (2026-10-08) : même collage pour les formulaires de RDV de Grand Audition.
  test('Grand Audition : coller la dernière fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.grandAudition, recents: [RECENT, RECENT2] });
    await expect(page.locator('.brand')).toContainText('Grand Audition');
    await page.getByRole('button', { name: /Coller Alice Essai sur Grand Audition/ }).click();
    await toast(page, 'OK pastePatient');
    const [d] = await p.demandes('pastePatient');
    expect(d.data).toMatchObject({ genre: 'F', prenom: 'Alice', nom: 'Essai', naissance: '12/03/1951' });
    // Nouveau design : pas de parcours de fiche sous la carte « Coller », comme sur Doctolib et Acuitis.
    await expect(page.locator('.etapes')).toHaveCount(0);
    expect(p.erreurs).toEqual([]);
  });

  test('Doctolib sans fiche récente : explication', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.doctolib });
    await expect(page.getByText(/Aucune fiche mémorisée/)).toBeVisible();
  });
});

test.describe('Sans fiche', () => {
  test('site quelconque sans Salesforce : consigne, mails utilisables en copie', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.google });
    await expect(page.getByText(/Ouvre une fiche Salesforce/).first()).toBeVisible();
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    await page.getByRole('button', { name: 'M.', exact: true }).click();
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await toast(page, 'Message copié');
    await expect(page.getByRole('button', { name: /Insérer dans Salesforce/ })).toBeDisabled();
    expect(p.erreurs).toEqual([]);
  });

  test('accueil Salesforce (pas une fiche)', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.accueilSf });
    await expect(page.getByText(/Pas de fiche patient sur cette page/)).toBeVisible();
  });
});

test.describe('Réglages', () => {
  test('signature, MV, pied de page, gardés et utilisés', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Réglages');
    await page.locator('.field').filter({ hasText: 'Prénom et nom' }).locator('input').fill('Benjamin Magnier');
    await page.locator('.field').filter({ hasText: 'Commentaire écrit avant' }).locator('input').fill('MV 2');
    await page.getByRole('button', { name: 'Conseillère', exact: true }).click();
    await expect.poll(async () => (await p.donnees()).reglages).toMatchObject({ nom: 'Benjamin Magnier', mvComment: 'MV 2', genre: 'F' });
    await aller(page, 'Fiche');
    await page.getByRole('button', { name: /Message vocal/ }).first().click();
    await expect.poll(async () => (await p.demandes('runMv'))[0]?.comment).toBe('MV 2');
  });

  test('exporter, partager, data.json', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Réglages');
    for (const [bouton, fichier] of [[/Exporter cockpit.json/, 'cockpit.json'], [/Partager mes modèles/, 'cockpit-modeles.json'], [/Mettre à jour data.json/, 'data.json']] as const) {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: bouton }).click()]);
      expect(dl.suggestedFilename()).toBe(fichier);
    }
  });

  test('importer un fichier de modèles d\'un collègue (fusion sans perte)', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Réglages');
    const collegue = donneesTest({ templates: [{ id: 'tpl-col', title: 'Modèle collègue', audience: 'patient', type: 'email', patientCategory: 'all', subject: 's', body: 'Bonjour, Claire Collègue' }] });
    (collegue.reglages as any).nom = 'Claire Collègue';
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Importer un fichier/ }).click()]);
    await fc.setFiles({ name: 'cockpit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(collegue)) });
    await toast(page, 'Données réunies');
    await expect.poll(async () => (await p.donnees()).templates.length).toBe(5);
    const d = await p.donnees();
    expect(d.templates.map((t: any) => t.title)).toEqual(expect.arrayContaining(['Modèle collègue', 'Confirmation de RDV']));
    expect(d.templates.find((t: any) => t.id === 'tpl-col').body).toContain('{{nom_conseiller}}');
    expect(d.reglages.nom).toBe('Benjamin Test');
    expect(d.ventes.sales['2026-09']).toHaveLength(1);
  });
});

test.describe('Robustesse', () => {
  const SCENARIOS = [
    ['Piste', ONGLET.piste], ['Opportunité', ONGLET.opportunite], ['Doctolib', ONGLET.doctolib], ['Google', ONGLET.google], ['Accueil Salesforce', ONGLET.accueilSf],
  ] as const;
  for (const [nom, onglet] of SCENARIOS) {
    test(`clic sur chaque bouton de chaque écran — ${nom}`, async ({ page }) => {
      test.setTimeout(120_000);
      const p = await ouvrir(page, { onglet, recents: [RECENT] });
      await page.waitForTimeout(400);
      const ecrans = (await page.locator('nav button:visible, .pages button:visible').allInnerTexts()).map((t) => t.trim());
      const cibles = ['', ...ecrans.filter(Boolean)];
      let clics = 0;
      for (const ecran of cibles) {
        await aller(page, 'Fiche');
        if (ecran) await page.locator('nav button:visible, .pages button:visible').filter({ hasText: new RegExp(`^\\s*${ecran}\\s*$`) }).first().click();
        await page.waitForTimeout(300);
        const n = await page.locator('main button:visible, .top button:visible, .footer button:visible, .accueil button:visible').count();
        for (let i = 0; i < n; i++) {
          const b = page.locator('main button:visible, .top button:visible, .footer button:visible, .accueil button:visible').nth(i);
          if (!(await b.isVisible().catch(() => false)) || !(await b.isEnabled().catch(() => false))) continue;
          const t = ((await b.innerText().catch(() => '')) + (await b.getAttribute('title').catch(() => ''))).toLowerCase();
          if (/confirmer|supprimer|choisir mon dossier|choisir un dossier|changer de dossier|importer/.test(t)) continue;
          await b.click({ timeout: 2000 }).catch(() => {});
          clics++;
          if (await page.locator('.view textarea, .view input[placeholder^="Ex."]').first().isVisible().catch(() => false)) {
            const annuler = page.getByRole('button', { name: /^Annuler$/ });
            if (await annuler.count()) await annuler.first().click().catch(() => {});
          }
        }
      }
      expect(clics).toBeGreaterThan(3);
      expect(p.erreurs).toEqual([]);
      await expect(page.locator('#app')).not.toBeEmpty();
    });
  }
});
