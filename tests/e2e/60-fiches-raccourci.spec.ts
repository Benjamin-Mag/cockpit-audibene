import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

const PISTE = 'lead:PISTETEST0000001A';
const OPP = 'opportunity:OPPORTEST000001AA';

test.describe('Raccourci clavier', () => {
  test('« run-mv » relayé par le service worker : Message vocal envoyé avec le commentaire des réglages', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    const reponse = await page.evaluate(() => new Promise((resolve) => {
      (window as any).chrome.runtime.onMessage._emit({ type: 'command', command: 'run-mv' }, {}, resolve);
      setTimeout(() => resolve('pas de réponse'), 1000);
    }));
    // Le panneau répond « true » : le service worker ne refait pas MV lui-même.
    expect(reponse).toBe(true);
    await toast(page, 'OK runMv');
    expect(await p.demandes('runMv')).toEqual([{ type: 'runMv', comment: 'MV' }]);
    expect(p.erreurs).toEqual([]);
  });

  test('un autre message du service worker est ignoré', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await page.evaluate(() => (window as any).chrome.runtime.onMessage._emit({ type: 'autre' }, {}, () => {}));
    await page.waitForTimeout(500);
    expect(await p.demandes('runMv')).toEqual([]);
  });
});

test.describe('Changement de fiche', () => {
  test('Piste → Opportunité → Piste : chaque brouillon reste attaché à sa fiche', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();

    // Piste : COSI et Anamnèse.
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: 'Binaurale', exact: true }).click();
    await aller(page, 'Anamnèse');
    await page.getByRole('button', { name: '1er RDV', exact: true }).click();

    // Opportunité : mail et Chat partenaire.
    await page.evaluate(() => (window as any).__mock.activer(12));
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await aller(page, 'Mails');
    await expect(page.getByRole('button', { name: /Relance CC1/ })).toBeVisible();
    await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
    await page.locator('input[type="date"]').fill('2026-10-02');
    await aller(page, 'Chat partenaire');
    await page.getByRole('button', { name: 'Relance', exact: true }).click();

    // Retour sur la Piste : ses choix sont là, rien de l'Opportunité.
    await page.evaluate(() => (window as any).__mock.activer(11));
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'COSI');
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: 'Binaurale', exact: true })).toHaveClass(/on/);
    await aller(page, 'Anamnèse');
    await expect(page.getByRole('button', { name: '1er RDV', exact: true })).toHaveClass(/on/);
    await expect(page.locator('.preview.editable').first()).toContainText('Premier RDV pour notre patiente');

    // Retour sur l'Opportunité : le mail et le texte choisis y sont toujours.
    await page.evaluate(() => (window as any).__mock.activer(12));
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await aller(page, 'Mails');
    await expect(page.getByRole('button', { name: /Confirmation de RDV/ })).toHaveAttribute('title', 'Changer de modèle');
    await expect(page.locator('input[type="date"]')).toHaveValue('2026-10-02');
    await aller(page, 'Chat partenaire');
    await expect(page.getByRole('button', { name: 'Relance', exact: true })).toHaveClass(/on/);

    // En mémoire de session, chaque saisie est rangée sous sa fiche.
    await page.waitForTimeout(500);
    const b = await page.evaluate(() => (window as any).__mock.session._d.cockpitBrouillons);
    const champs = (k: string) => Object.keys(b[k]?.champs ?? {});
    expect(champs(PISTE)).toEqual(expect.arrayContaining(['cosi.choix', 'anamnese.situation']));
    expect(champs(PISTE).some((c) => /^(mail|chat)\./.test(c))).toBe(false);
    expect(champs(OPP)).toEqual(expect.arrayContaining(['mail.modele', 'mail.champs', 'chat.texte']));
    expect(champs(OPP).some((c) => /^(cosi|anamnese)\./.test(c))).toBe(false);
    expect(p.erreurs).toEqual([]);
  });
});
