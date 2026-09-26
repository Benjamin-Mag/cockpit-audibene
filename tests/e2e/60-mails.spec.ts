import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

const opp = async (page: any, extra = {}) => {
  const p = await ouvrir(page, { onglet: ONGLET.opportunite, ...extra });
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  return p;
};
const champ = (page: any, label: string) => page.locator('.field').filter({ has: page.locator('.field-head', { hasText: label }) });

test.describe('Mails (suite)', () => {
  test('partenaire et adresse absents de la fiche : lus à la demande, puis dans l\'aperçu', async ({ page }) => {
    const p = await opp(page, { partenaireALaDemande: true });
    expect((await p.demandes('readFiche')).every((d) => !d.withPartner)).toBe(true);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await page.getByRole('button', { name: /Nouveau patient partenaire/ }).click();
    await expect.poll(async () => (await p.demandes('readFiche')).some((d) => d.withPartner === true)).toBe(true);
    await expect(champ(page, 'Nom du partenaire').locator('input')).toHaveValue('Audition Test Marseille');
    await expect(champ(page, 'Adresse du partenaire').locator('textarea')).toHaveValue(/12 rue de la République/);
    await expect(page.locator('.preview').filter({ hasText: 'Bonjour Audition Test Marseille' }).first()).toBeVisible();
    await expect(page.locator('.preview').filter({ hasText: '13002 Marseille' }).first()).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });

  test('champs modifiables à la main : la saisie remplace la valeur lue et part dans le mail', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await page.getByRole('button', { name: /Nouveau patient partenaire/ }).click();
    const nom = champ(page, 'Nom du partenaire');
    await expect(nom.getByText('depuis la fiche')).toBeVisible();
    await nom.locator('input').fill('Centre Manuel');
    await expect(nom.getByText('depuis la fiche')).toHaveCount(0);
    await champ(page, 'Adresse du partenaire').locator('textarea').fill('1 place Test\n30000 Nîmes');
    await champ(page, 'Nom du patient').locator('input').fill('Bernard-Pierre Test');
    await expect(page.locator('.preview').filter({ hasText: 'Bonjour Centre Manuel' }).first()).toBeVisible();
    await page.getByRole('button', { name: /Insérer dans Salesforce/ }).click();
    await toast(page, 'OK insertMail');
    const [d] = await p.demandes('insertMail');
    expect(d.subject).toBe('Patient pour Centre Manuel');
    expect(d.html).toContain('Monsieur Bernard-Pierre Test');
    expect(d.html).toContain('30000 Nîmes');
    expect(d.html).not.toContain('Audition Test Marseille');
    expect(p.erreurs).toEqual([]);
  });

  test('passer de Patient à Partenaire remet la catégorie à « Tous »', async ({ page }) => {
    await opp(page);
    await aller(page, 'Mails');
    const tous = page.getByRole('button', { name: 'Tous', exact: true });
    await page.getByRole('button', { name: 'CC1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'CC1', exact: true })).toHaveClass(/on/);
    await expect(tous).not.toHaveClass(/on/);
    await page.getByRole('button', { name: 'Partenaire', exact: true }).click();
    await expect(tous).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: 'CC1', exact: true })).not.toHaveClass(/on/);
    await expect(page.getByRole('button', { name: /Nouveau patient partenaire/ })).toBeVisible();
    await page.getByRole('button', { name: 'CC2', exact: true }).click();
    await expect(page.getByRole('button', { name: /Nouveau patient partenaire/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Patient', exact: true }).click();
    await expect(tous).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: /Confirmation de RDV/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Relance CC1/ })).toBeVisible();
  });

  test('modèle SMS : pas d\'objet, pas d\'insertion, copie du texte seul', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: /SMS rappel/ }).click();
    await expect(page.locator('.preview.subj-line')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Insérer dans Salesforce/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Copier le SMS/ }).click();
    await toast(page, 'SMS copié');
    expect(await p.presse()).toBe('Bonjour Monsieur Bernard Test, pensez à votre RDV. Benjamin Test');
  });

  test('éditeur : un modèle SMS n\'a ni objet ni SMS accompagnateur', async ({ page }) => {
    const p = await opp(page);
    await aller(page, 'Mails');
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await expect(page.getByPlaceholder('Objet du mail')).toBeVisible();
    await expect(page.getByText('SMS accompagnateur (optionnel)')).toBeVisible();
    await page.locator('.view').getByRole('button', { name: 'SMS', exact: true }).click();
    await expect(page.getByPlaceholder('Objet du mail')).toHaveCount(0);
    await expect(page.getByText('SMS accompagnateur (optionnel)')).toHaveCount(0);
    await expect(page.getByText('Texte du SMS')).toBeVisible();
    await page.getByPlaceholder('Ex. Confirmation de rendez-vous').fill('SMS test');
    await page.locator('textarea').first().fill('Bonjour {{nom}}');
    await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
    await toast(page, 'Modèle enregistré');
    await expect.poll(async () => (await p.donnees()).templates.find((t: any) => t.title === 'SMS test')?.type).toBe('sms');
    await expect(page.locator('.preview.subj-line')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Copier le SMS/ })).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });
});
