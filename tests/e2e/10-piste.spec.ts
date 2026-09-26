import { ONGLET, aller, ecransVisibles, expect, ouvrir, test, toast } from './outils';

test.describe('Piste', () => {
  test('écrans proposés sur une Piste', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    const e = (await ecransVisibles(page)).join('|');
    for (const n of ['COSI', 'Anamnèse', 'ORL', 'Partenaires']) expect(e).toContain(n);
    expect(e).not.toMatch(/Mails|Chat/);
    expect(p.erreurs).toEqual([]);
  });

  test('Message vocal → commentaire MV + non joignable', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await page.getByRole('button', { name: /Message vocal/ }).first().click();
    await toast(page, 'OK runMv');
    expect(await p.demandes('runMv')).toEqual([{ type: 'runMv', comment: 'MV' }]);
    expect(p.erreurs).toEqual([]);
  });

  test('Message vocal en échec : message d\'erreur visible', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, echecs: ['runMv'] });
    await page.getByRole('button', { name: /Message vocal/ }).first().click();
    await expect(page.locator('.toast.err')).toContainText('Échec simulé runMv');
  });

  test('Relire la fiche relance une lecture', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    const avant = (await p.demandes('readFiche')).length;
    await page.getByRole('button', { name: 'Relire la fiche' }).first().click();
    await expect.poll(async () => (await p.demandes('readFiche')).length).toBeGreaterThan(avant);
  });

  test('COSI : puces, case, intensité, Appliquer envoie tout', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: 'Retraité/e', exact: true }).click();
    await page.getByRole('button', { name: 'Binaurale', exact: true }).click();
    await page.getByRole('button', { name: 'Appliquer', exact: false }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    const pl = Object.fromEntries(d.picklists.map((x: any) => [x.label, x.value]));
    expect(pl["Type d'appareillage"]).toBe('Premier appareillage');
    expect(pl['Statut professionnel']).toBe('Retraité/e');
    expect(pl['Perte auditive']).toBe('Binaurale');
    expect(pl['Otite']).toBe('Non');
    expect(p.erreurs).toEqual([]);
  });

  test('COSI : un second clic sur une puce la retire, « Tout effacer » vide', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    const b = page.getByRole('button', { name: 'Binaurale', exact: true });
    await b.click();
    await expect(b).toHaveClass(/on/);
    await b.click();
    await expect(b).not.toHaveClass(/on/);
    await b.click();
    await page.getByRole('button', { name: 'Tout effacer' }).click();
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).not.toHaveClass(/on/);
    await expect(b).toHaveCount(0);
  });

  test('COSI : texte libre gardé en puce réutilisable', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const champ = page.getByPlaceholder('Texte du moment…').first();
    await champ.fill('Chorale le mardi');
    await champ.press('Enter');
    await expect(page.getByRole('button', { name: /Chorale le mardi/ }).first()).toBeVisible();
    await expect.poll(async () => JSON.stringify((await p.donnees()).anamnese.phrases)).toContain('Chorale le mardi');
  });

  test('COSI : la saisie survit au passage sur un autre site (onglet en arrière-plan)', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: 'Binaurale', exact: true }).click();
    await page.evaluate(() => (window as any).__mock.activer(14));
    await expect(page.getByText(/arrière-plan/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Binaurale', exact: true })).toHaveClass(/on/);
    await page.getByRole('button', { name: /Revenir/ }).first().click();
    expect((await p.journal()).some((j) => j.api === 'tabs' && j.type === 'update' && j.detail.id === 11 && j.detail.active)).toBe(true);
  });

  test('COSI : la saisie est retrouvée après rechargement du panneau', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: 'Binaurale', exact: true }).click();
    await page.waitForTimeout(600);
    await page.reload();
    await aller(page, 'COSI');
    await expect(page.getByRole('button', { name: 'Binaurale', exact: true })).toHaveClass(/on/);
  });

  test('Anamnèse : situation, résumé collé, écrire dans la fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.getByRole('button', { name: '1er RDV', exact: true }).click();
    await page.evaluate(() => navigator.clipboard.writeText('Patiente gêne en groupe, ordonnance ORL récente.'));
    await page.getByRole('button', { name: /Coller le résumé/ }).click();
    await toast(page, 'Résumé repris');
    await page.getByRole('button', { name: /Écrire dans la fiche/ }).click();
    await toast(page, 'OK writeComment');
    const [d] = await p.demandes('writeComment');
    expect(d.text).toContain('Premier RDV pour notre patiente');
    expect(d.text).toContain('Patiente gêne en groupe');
    expect(d.text).toContain('Benjamin Test');
    expect(d.save).toBe(true);
    expect(p.erreurs).toEqual([]);
  });

  test('Anamnèse : presse-papier inutilisable refusé', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.evaluate(() => navigator.clipboard.writeText('06 00 00 00 01'));
    await page.getByRole('button', { name: /Coller le résumé/ }).click();
    await expect(page.locator('.toast.err')).toContainText('numéro');
  });

  test('Anamnèse : copier, modifier le texte, gérer les situations', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.getByRole('button', { name: 'Copier le texte' }).click();
    await toast(page, 'Anamnèse copiée');
    expect(await p.presse()).toContain('dépistage');
    await page.getByRole('button', { name: 'Modifier ce texte' }).click();
    await page.locator('textarea').first().fill('Texte refait {{resume}} {{nom_conseiller}}');
    await page.getByRole('button', { name: 'Enregistrer le texte' }).click();
    await toast(page, 'Texte enregistré');
    await page.getByRole('button', { name: 'Gérer les situations' }).click();
    await page.getByPlaceholder('Nouvelle situation…').fill('Suivi');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Suivi', exact: true })).toBeVisible();
    await expect.poll(async () => (await p.donnees()).anamnese.situations.map((s: any) => s.label)).toContain('Suivi');
    const del = page.getByRole('button', { name: 'Supprimer cette situation et son texte' }).last();
    await del.click();
    await page.getByRole('button', { name: /Confirmer/ }).click();
    await toast(page, 'Situation « Suivi » supprimée');
  });

  test('Anamnèse sans genre : verrou M./Mme', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, ficheSansGenre: true });
    await aller(page, 'Anamnèse');
    await page.getByRole('button', { name: /Écrire sans résumé/ }).click();
    await expect(page.locator('.toast.err')).toContainText('Choisis M. ou Mme');
  });

  test('Anamnèse : la case « Enregistrer automatiquement » est gardée', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'Anamnèse');
    await page.getByRole('checkbox').last().uncheck();
    await expect.poll(async () => (await p.donnees()).reglages.autoSaveComment).toBe(false);
  });
});
