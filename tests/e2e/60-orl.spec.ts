import { ONGLET, aller, expect, ouvrir, test } from './outils';

const puce = (page: any, nom: RegExp) => page.locator('.chips .chip').filter({ hasText: nom });
const nomsAffiches = async (page: any) => [...new Set((await page.locator('.tpl .t').allInnerTexts()).map((t: string) => t.replace(/^TOP \d+\s*/, '').trim()))];

test.describe('ORL Finder (suite)', () => {
  test('ORL sans téléphone non affiché, avec une note', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 15000 });
    // Dr Paul Orl2 (cabinet 102) n'a pas de numéro sur Doctolib.
    await expect(page.getByText('Dr Paul Orl2')).toHaveCount(0);
    await expect(page.getByText(/1 ORL sans numéro sur Doctolib, non affiché\./)).toBeVisible();
    expect((await p.journal()).some((j) => j.api === 'reseau' && /dr-orl2\.json/.test(j.detail))).toBe(true);
    expect(p.erreurs).toEqual([]);
  });

  test('filtres rapides : compteurs, cumul, « Tout afficher »', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 15000 });
    // 5 ORL avec téléphone ; créneau pour 1, 4, 5 ; « nouveaux patients » indiqué pour 1, 3, 4, 5 ; audiométrie pour tous.
    await expect(puce(page, /Tout afficher/)).toHaveText(/Tout afficher\s*5/);
    await expect(puce(page, /Avec créneau en ligne/)).toHaveText(/3$/);
    await expect(puce(page, /Audiométrie indiquée/)).toHaveText(/5$/);
    await expect(puce(page, /Nouveaux patients acceptés/)).toHaveText(/4$/);
    const reseauAvant = (await p.journal()).filter((j) => j.api === 'reseau').length;

    await puce(page, /Avec créneau en ligne/).click();
    await expect(puce(page, /Avec créneau en ligne/)).toHaveClass(/on/);
    await expect(puce(page, /Tout afficher/)).not.toHaveClass(/on/);
    await expect(page.getByText('3 ORL sur 5 avec ces filtres.')).toBeVisible();
    expect(await nomsAffiches(page)).toEqual(expect.arrayContaining(['Dr Anne Orl1', 'Dr Marie Orl4', 'Dr Nina Orl5']));
    expect(await nomsAffiches(page)).not.toContain('Dr Luc Orl3');
    expect(await nomsAffiches(page)).not.toContain('Dr Hugo Orl6');

    // Cumul : les compteurs tiennent compte des autres filtres allumés.
    await puce(page, /Nouveaux patients acceptés/).click();
    await expect(puce(page, /Nouveaux patients acceptés/)).toHaveText(/3$/);
    await expect(page.getByText('3 ORL sur 5 avec ces filtres.')).toBeVisible();

    await puce(page, /Tout afficher/).click();
    await expect(puce(page, /Tout afficher/)).toHaveClass(/on/);
    await expect(page.getByText(/ORL sur 5 avec ces filtres/)).toHaveCount(0);
    expect(await nomsAffiches(page)).toEqual(expect.arrayContaining(['Dr Luc Orl3', 'Dr Hugo Orl6']));
    // Aucun appel Doctolib pour filtrer.
    expect((await p.journal()).filter((j) => j.api === 'reseau').length).toBe(reseauAvant);
    expect(p.erreurs).toEqual([]);
  });

  test('« Afficher 10 ORL de plus » lit les fiches suivantes et allonge la liste', async ({ page }) => {
    test.setTimeout(90_000);
    const p = await ouvrir(page, { onglet: ONGLET.piste, beaucoupOrl: true });
    await aller(page, 'ORL Finder');
    const plus = page.getByRole('button', { name: /Afficher 10 ORL de plus/ });
    await expect(plus).toBeVisible({ timeout: 40000 });
    await expect(page.getByText(/10 autres pas encore vérifiés/)).toBeVisible();
    const fiches = async () => (await p.journal()).filter((j) => j.api === 'reseau' && /\/profiles\//.test(j.detail)).length;
    expect(await fiches()).toBe(20);
    const reseau = (await p.journal()).filter((j) => j.api === 'reseau').map((j) => j.detail as string);
    expect(reseau.filter((u) => u.includes('/hcp/search')).map((u) => new URL(u).searchParams.get('page'))).toEqual(['0', '1']);
    const avant = (await nomsAffiches(page)).length;
    await plus.click();
    await expect.poll(fiches).toBe(30);
    await expect.poll(async () => (await nomsAffiches(page)).length).toBeGreaterThan(avant);
    await expect(page.getByText(/pas encore vérifié/)).toHaveCount(0);
    expect(await nomsAffiches(page)).toContain('Dr Prenom30 Orl30');
    expect(p.erreurs).toEqual([]);
  });

  test('sans session Doctolib Pro : repli sur le site public et bandeau « Se connecter à Doctolib Pro »', async ({ page }) => {
    test.setTimeout(60_000);
    const p = await ouvrir(page, { onglet: ONGLET.piste, sansDoctolibPro: true });
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/pas connecté à Doctolib Pro/)).toBeVisible();
    await expect(page.getByText(/· Doctolib Pro/)).toHaveCount(0);
    const reseau = (await p.journal()).filter((j) => j.api === 'reseau').map((j) => j.detail as string);
    expect(reseau.some((u) => u.startsWith('https://www.doctolib.fr/') && u.includes('/hcp/search'))).toBe(true);
    expect(reseau.some((u) => u.startsWith('https://pro.doctolib.fr/'))).toBe(false);
    // Une seule tentative d'ouvrir Doctolib Pro (renvoyée vers la connexion), pas une par ORL.
    const crees = (await p.journal()).filter((j) => j.type === 'create').map((j) => j.detail.url as string);
    expect(crees.filter((u) => u.startsWith('https://pro.doctolib.fr/'))).toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Ouvrir sur Doctolib' })).toBeVisible();
    // Le bouton met au premier plan l'onglet de connexion Doctolib Pro déjà ouvert.
    await page.getByRole('button', { name: 'Se connecter à Doctolib Pro' }).click();
    await expect.poll(async () => {
      const maj = (await p.journal()).filter((j) => j.api === 'tabs' && j.type === 'update' && j.detail.active).map((j) => j.detail.id);
      const onglets = await page.evaluate(() => (window as any).__mock.onglets.map((o: any) => ({ id: o.id, url: o.url })));
      return maj.map((id: number) => onglets.find((o: any) => o.id === id)?.url);
    }).toContainEqual(expect.stringContaining('auth.doctolib.fr/pro'));
    expect(p.erreurs).toEqual([]);
  });
});
