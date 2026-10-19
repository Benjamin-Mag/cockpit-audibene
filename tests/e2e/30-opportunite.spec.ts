import { ONGLET, aller, ecransVisibles, expect, ouvrir, test, toast } from './outils';

const opp = async (page: any, extra = {}) => {
  const p = await ouvrir(page, { onglet: ONGLET.opportunite, ...extra });
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  return p;
};

test.describe('Opportunité', () => {
  test('écrans proposés sur une Opportunité', async ({ page }) => {
    await opp(page);
    const e = (await ecransVisibles(page)).join('|');
    expect(e).toMatch(/Mails?/);
    expect(e).toMatch(/Chat/);
    expect(e).not.toMatch(/COSI|Anamnèse/);
    // ORL Finder aussi sur une Opportunité (2026-10-19), après Mails et Chat partenaire.
    expect(e).toMatch(/ORL/);
    expect(e.search(/ORL/)).toBeGreaterThan(e.search(/Chat/));
    await expect(page.getByRole('button', { name: /Message vocal/ })).toHaveCount(0);
  });

  test('Mail patient : date, heure, aperçu, insertion côté Client', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
    await page.locator('input[type="date"]').fill('2026-10-02');
    await page.locator('input[type="time"]').fill('14:30');
    await expect(page.locator('.preview').filter({ hasText: 'Monsieur Bernard Test' }).first()).toBeVisible();
    await page.getByRole('button', { name: /Insérer dans Salesforce/ }).click();
    await toast(page, 'OK insertMail');
    const [d] = await p.demandes('insertMail');
    expect(d.recipient).toBe('Client');
    expect(d.subject).toBe('Votre rendez-vous du 2 octobre 2026');
    expect(d.html).toContain('14h30');
    expect(d.html).toContain('Pied de page test');
    expect(p.erreurs).toEqual([]);
  });

  test('Mail patient : SMS accompagnateur copié', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
    await page.getByRole('button', { name: /Copier le SMS/ }).click();
    await toast(page, 'SMS copié');
    expect(await p.presse()).toContain('Benjamin Test');
  });

  test('Mail partenaire : nom du partenaire lu sur la fiche, insertion côté Partenaire', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await page.getByRole('button', { name: /Nouveau patient partenaire/ }).click();
    await expect(page.locator('.preview').filter({ hasText: 'Bonjour Audition Test Marseille' }).first()).toBeVisible();
    await page.getByRole('button', { name: /Insérer dans Salesforce/ }).click();
    await toast(page, 'OK insertMail');
    const [d] = await p.demandes('insertMail');
    expect(d.recipient).toBe('Partenaire');
  });

  test('Mail : filtre par catégorie, changer de modèle', async ({ page }) => {
    await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'CC1', exact: true }).click();
    await expect(page.getByRole('button', { name: /Relance CC1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmation de RDV/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    await page.locator('button[title="Changer de modèle"]').click();
    await expect(page.getByRole('button', { name: /SMS rappel/ })).toBeVisible();
  });

  test('Mail : retouche de l\'aperçu puis « Revenir au modèle »', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    const ap = page.locator('.preview.editable').last();
    await ap.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' AJOUT');
    await expect(page.getByText('Texte retouché à la main')).toBeVisible();
    await page.getByRole('button', { name: /Insérer dans Salesforce/ }).click();
    await toast(page, 'OK insertMail');
    expect((await p.demandes('insertMail'))[0].html).toContain('AJOUT');
    await page.getByRole('button', { name: /Revenir au modèle/ }).click();
    await expect(page.getByText('Texte retouché à la main')).toHaveCount(0);
  });

  test('Mail SMS : copier le SMS', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /SMS rappel/ }).click();
    await page.getByRole('button', { name: /Copier le SMS/ }).click();
    expect(await p.presse()).toContain('Monsieur Bernard Test');
  });

  test('Mail sans genre : verrou M./Mme puis choix', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, ficheSansGenre: true });
    await page.evaluate(() => (window as any).__mock.activer(12));
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await page.evaluate(() => { (window as any).__mock.FICHES[12].genre = null; });
    await page.getByRole('button', { name: 'Relire la fiche' }).first().click();
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await expect(page.locator('.toast.err')).toContainText('Choisis M. ou Mme');
    await page.getByRole('button', { name: 'Mme', exact: true }).click();
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await toast(page, 'Message copié');
  });

  test('Modèles : créer avec variable, modifier, supprimer en deux temps', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await page.getByPlaceholder('Ex. Confirmation de rendez-vous').fill('Modèle test');
    await page.getByPlaceholder('Objet du mail').fill('Objet test');
    const corps = page.locator('textarea').first();
    await corps.click();
    await corps.fill('Bonjour ');
    await page.getByRole('button', { name: 'Nom du patient', exact: true }).click();
    await expect(corps).toHaveValue(/Bonjour \{\{nom\}\}/);
    await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
    await toast(page, 'Modèle enregistré');
    await expect.poll(async () => (await p.donnees()).templates.map((t: any) => t.title)).toContain('Modèle test');
    await page.getByRole('button', { name: 'Modifier ce modèle' }).click();
    await page.getByPlaceholder('Ex. Confirmation de rendez-vous').fill('Modèle test renommé');
    await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
    await expect.poll(async () => (await p.donnees()).templates.map((t: any) => t.title)).toContain('Modèle test renommé');
    await page.getByRole('button', { name: 'Supprimer ce modèle' }).first().click();
    await page.getByRole('button', { name: /Confirmer/ }).click();
    await toast(page, 'supprimé');
    await expect.poll(async () => (await p.donnees()).templates.map((t: any) => t.title)).not.toContain('Modèle test renommé');
    expect(p.erreurs).toEqual([]);
  });

  test('Modèles : titre obligatoire, annuler', async ({ page }) => {
    await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
    await expect(page.locator('.toast.err')).toContainText('Titre et texte obligatoires');
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('button', { name: 'Nouveau modèle' })).toBeVisible();
  });

  test('Catégories : ajouter, renommer, supprimer depuis l\'éditeur', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /Relance CC1/ }).click();
    await page.getByRole('button', { name: 'Modifier ce modèle' }).click();
    await page.getByRole('button', { name: /Ajouter, renommer, supprimer/ }).click();
    await page.getByPlaceholder('Nouvelle catégorie…').fill('CC9');
    await page.getByRole('button', { name: /Ajouter \(et l'attribuer/ }).click();
    await expect.poll(async () => (await p.donnees()).categories.patient.map((c: any) => c.id)).toContain('CC9');
    const champ = page.locator('.drag-wrap input').last();
    await expect(champ).toHaveValue('CC9');
    await champ.fill('CC10');
    await champ.press('Enter');
    await expect.poll(async () => (await p.donnees()).categories.patient.map((c: any) => c.id)).toContain('CC10');
    await page.getByRole('button', { name: 'Supprimer cette catégorie' }).last().click();
    await page.getByRole('button', { name: /Confirmer/ }).click();
    await toast(page, 'Catégorie supprimée');
  });

  test('Chat partenaire : choisir, retoucher, envoyer', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: 'Relance', exact: true }).click();
    await expect(page.locator('.preview').first()).toContainText('notre patient ?');
    await page.getByRole('button', { name: /Envoyer dans Chat Partenaire/ }).click();
    await toast(page, 'OK writeChatPartenaire');
    expect((await p.demandes('writeChatPartenaire'))[0].text).toContain('avez-vous des nouvelles');
    await page.getByRole('button', { name: 'Copier', exact: true }).click();
    await toast(page, 'Texte copié');
  });

  test('Chat partenaire : créer, modifier, supprimer un texte', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: 'Nouveau texte' }).click();
    await page.getByPlaceholder('Titre (ex. Merci)').fill('RDV pris');
    await page.locator('textarea').first().fill('Le RDV est pris, merci.');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await toast(page, 'Texte enregistré');
    await expect.poll(async () => (await p.donnees()).chatPartenaire.map((c: any) => c.label)).toContain('RDV pris');
    await page.getByRole('button', { name: /Modifier, supprimer ou réordonner/ }).click();
    await page.getByRole('button', { name: 'Supprimer ce texte' }).last().click();
    await page.getByRole('button', { name: /Confirmer/ }).click();
    await toast(page, 'Texte « RDV pris » supprimé');
  });

  test('SMS Hearo : cherche le patient', async ({ page }) => {
    const p = await opp(page);
    await page.getByRole('button', { name: /SMS|Hearo/ }).first().click();
    await expect.poll(async () => (await p.journal()).filter((j) => j.api === 'page').map((j) => j.type)).toContain('openSms');
  });
});
