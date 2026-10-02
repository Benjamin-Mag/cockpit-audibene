import type { Page } from '@playwright/test';
import { ONGLET, aller, donneesTest, expect, ouvrir, test } from './outils';

// Benjamin (01/10) : les modèles doivent signer du nom de chaque collègue → variables, jamais le nom en dur.
const SIG_EN_DUR = 'Bien cordialement,\nBenjamin Test\nVotre conseiller Audibene\n06 00 00 00 00';
const SIG_VARIABLES = 'Bien cordialement,\n{{nom_conseiller}}\nVotre conseiller Audibene\n{{tel_conseiller}}';

function donneesAvecSignature(sig: string, reglages: Record<string, string> = {}) {
  const d: any = donneesTest();
  d.reglages = { ...d.reglages, ...reglages, sigPatientMail: sig, sigPartenaireMail: sig, sigPatientSMS: sig };
  return d;
}

// Benjamin (02/10) : la signature en dur ne reprend pas toujours les Réglages mot pour mot
// (Réglages « Benjamin Test » / « 📞 06 00 00 00 00 », signature « Test Benjamin » / « 06.00.00.00.00 »).
const SIG_CONVERTIE = '\nBien cordialement,\n{{nom_conseiller}}\nVotre conseiller Audibene\n{{tel_conseiller}}';
const SIGNATURES_TOLERANTES: [string, string][] = [
  ['nom inversé, emoji devant le téléphone des Réglages', 'Bien cordialement,\nTest Benjamin\nVotre conseiller Audibene\n06 00 00 00 00'],
  ['nom en majuscules et espaces doublés, numéro à points', 'Bien cordialement,\nTEST   Benjamin\nVotre conseiller Audibene\n06.00.00.00.00'],
  ['numéro au format international', 'Bien cordialement,\nTest Benjamin\nVotre conseiller Audibene\n+33 6 00 00 00 00'],
];

/** Ouvre un nouveau modèle de mail patient ; son corps est prérempli avec la signature des Réglages. */
async function nouveauModele(page: Page) {
  await aller(page, 'Mails');
  await page.getByRole('button', { name: 'Nouveau modèle' }).click();
  return page.locator('textarea').first();
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

  for (const [cas, sig] of SIGNATURES_TOLERANTES) {
    test(`signature en dur différente des Réglages (${cas}) : passée en variables`, async ({ page }) => {
      const p = await ouvrir(page, { onglet: ONGLET.opportunite, donnees: donneesAvecSignature(sig, { telephone: '📞 06 00 00 00 00' }) });
      const corps = await nouveauModele(page);
      await expect(corps).toHaveValue(SIG_CONVERTIE);
      await expect(corps).not.toHaveValue(/Benjamin|Test|00/i);
      expect(p.erreurs).toEqual([]);
    });
  }

  test('signature : un mot qui contient le nom ou un numéro plus long restent tels quels', async ({ page }) => {
    const sig = 'Bien cordialement,\nTest Benjamin\nBenjamin Testeur, stagiaire\n06 00 00 00 00\nN° client 0600000000123';
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, donnees: donneesAvecSignature(sig) });
    const corps = await nouveauModele(page);
    await expect(corps).toHaveValue('\nBien cordialement,\n{{nom_conseiller}}\nBenjamin Testeur, stagiaire\n{{tel_conseiller}}\nN° client 0600000000123');
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

  test('modèles et textes du Chat partenaire : nom et téléphone en dur passés en variables au chargement', async ({ page }) => {
    const d: any = donneesTest();
    d.reglages = { ...d.reglages, nom: 'Benjamin Test', telephone: '📞 06 00 00 00 00' };
    d.templates = [...d.templates, { id: 'tpl-signe', title: 'Avec signature', audience: 'partenaire', type: 'email', partnerCategory: 'CC1', subject: 'Objet', body: 'Bonjour {{nom partenaire}},\n\nBien cordialement,\nTest Benjamin\n06.00.00.00.00' }];
    d.chatPartenaire = [...d.chatPartenaire, { id: 'chat-signe', label: 'Signé', text: 'Merci, Benjamin Test (06 00 00 00 00)' }];
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, donnees: d });
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await page.getByRole('button', { name: /Avec signature/ }).click();
    await page.getByRole('button', { name: 'Modifier ce modèle' }).click();
    const corps = page.locator('textarea').first();
    await expect(corps).toHaveValue(/\{\{nom_conseiller\}\}/);
    await expect(corps).toHaveValue(/\{\{tel_conseiller\}\}/);
    await expect(corps).not.toHaveValue(/Test Benjamin|06\.00/);
    await page.getByRole('button', { name: 'Annuler' }).click();
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: 'Signé', exact: true }).click();
    // Le texte affiché garde le vrai nom (la variable est remplie), sans doublon d'emoji.
    await expect(page.locator('.preview.editable').first()).toContainText('Benjamin Test');
    await expect(page.locator('.preview.editable').first()).not.toContainText('📞 📞');
    expect(p.erreurs).toEqual([]);
  });
});
