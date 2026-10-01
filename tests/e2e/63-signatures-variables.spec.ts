import { ONGLET, aller, donneesTest, expect, ouvrir, test } from './outils';

// Benjamin (01/10) : les modèles doivent signer du nom de chaque collègue → variables, jamais le nom en dur.
const SIG_EN_DUR = 'Bien cordialement,\nBenjamin Test\nVotre conseiller Audibene\n06 00 00 00 00';
const SIG_VARIABLES = 'Bien cordialement,\n{{nom_conseiller}}\nVotre conseiller Audibene\n{{tel_conseiller}}';

function donneesAvecSignature(sig: string) {
  const d: any = donneesTest();
  d.reglages = { ...d.reglages, sigPatientMail: sig, sigPartenaireMail: sig, sigPatientSMS: sig };
  return d;
}

test.describe('Signatures et variables', () => {
  test('nouveau modèle : la signature garde ses variables, le nom n\'est pas figé', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.opportunite, donnees: donneesAvecSignature(SIG_VARIABLES) });
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    const corps = page.locator('textarea').first();
    await expect(corps).toHaveValue(/\{\{nom_conseiller\}\}/);
    await expect(corps).toHaveValue(/\{\{tel_conseiller\}\}/);
    await expect(corps).not.toHaveValue(/Benjamin Test/);
  });

  test('signature écrite en dur dans les Réglages : passée en variables au chargement', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, donnees: donneesAvecSignature(SIG_EN_DUR) });
    // La signature chargée en dur ressort en variables dans un nouveau modèle : preuve de la conversion au chargement.
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await expect(page.locator('textarea').first()).toHaveValue(/\{\{nom_conseiller\}\}/);
    expect(p.erreurs).toEqual([]);
  });

  test('Chat partenaire : plus de choix M./Mme, le genre vient de la fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite });
    await aller(page, 'Chat partenaire');
    await expect(page.getByRole('button', { name: 'M.', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mme', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Relance', exact: true }).click();
    // Le texte « notre patient(e) » est accordé sans rien demander.
    await expect(page.locator('.preview.editable').first()).toContainText(/notre patiente? \?/);
    await expect(page.locator('.preview.editable').first()).not.toContainText('patient(e)');
    expect(p.erreurs).toEqual([]);
  });
});
