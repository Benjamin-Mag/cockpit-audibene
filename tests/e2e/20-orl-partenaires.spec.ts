import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

test.describe('ORL Finder', () => {
  test('liste, TOP 3, créneaux, téléphone, pas d\'appel avec virgules', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Prochain RDV :/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /01 23 45 67/ }).first()).toBeVisible();
    const reseau = (await p.journal()).filter((j) => j.api === 'reseau').map((j) => j.detail as string);
    expect(reseau.some((u) => u.includes('/hcp/search'))).toBe(true);
    expect(reseau.filter((u) => u.includes('availabilities')).every((u) => !/agenda_ids=/.test(u))).toBe(true);
    expect(reseau.some((u) => /Essai|Alice/.test(u))).toBe(false);
    expect(p.erreurs).toEqual([]);
  });

  test('tri, filtres, recherche par ville, message type, itinéraire, prendre RDV', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Plus proche', exact: true }).click();
    await page.getByPlaceholder('Chercher un ORL ou une ville').fill('begles');
    await expect(page.getByText('Dr Marie Orl4').first()).toBeVisible();
    await expect(page.getByText('Dr Anne Orl1')).toHaveCount(0);
    await page.getByRole('button', { name: 'Effacer la recherche' }).click();
    await page.getByRole('button', { name: /^Message type$/ }).click();
    await toast(page, 'Message type copié');
    expect(await p.presse()).toContain('audiométrie tonale et vocale');
    await page.getByRole('button', { name: /Itinéraire/ }).first().click();
    await page.getByRole('button', { name: /Prendre RDV/ }).first().click();
    const crees = (await p.journal()).filter((j) => j.type === 'create').map((j) => j.detail.url as string);
    expect(crees.some((u) => u.includes('google.com/maps'))).toBe(true);
    expect(crees.some((u) => u.includes('doctolib.fr'))).toBe(true);
  });

  test('Doctolib bloque : message clair et bouton « Voir l\'onglet Doctolib »', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, doctolibBloque: true });
    await aller(page, 'ORL Finder');
    await expect(page.getByRole('button', { name: /Voir l'onglet Doctolib/ }).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Partenaires', () => {
  test('lecture de Partner Search, créneaux Doctolib et Acuitis, agenda Pro, appeler', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Partenaires');
    await expect(page.getByText('Centre partenaire Doctolib')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Test auditif').first()).toBeVisible();
    await expect(page.getByText('Bilan auditif').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Agenda Doctolib Pro/ })).toBeVisible();
    await expect(page.getByText(/appeler le partenaire/)).toBeVisible();
    await page.getByRole('button', { name: /^Réserver$/ }).first().click();
    expect((await p.journal()).some((j) => j.type === 'create')).toBe(true);
    const reseau = (await p.journal()).filter((j) => j.api === 'reseau').map((j) => j.detail as string);
    expect(reseau.some((u) => u.includes('timeslots/list/TEST1'))).toBe(true);
    expect(reseau.filter((u) => u.includes('availabilities')).every((u) => !/agenda_ids=/.test(u))).toBe(true);
    expect(p.erreurs).toEqual([]);
  });

  test('créneaux en double (centre à plusieurs agendas) : pas de doublon affiché', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste, creneauxEnDouble: true });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Partenaires');
    await expect(page.getByText('Test auditif').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    expect(p.erreurs.filter((e) => /same key/.test(e))).toEqual([]);
  });

  test('Partner Search vide', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, partnerSearchVide: true });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'Partenaires');
    await expect(page.getByText(/Aucun partenaire/)).toBeVisible({ timeout: 15000 });
  });
});
