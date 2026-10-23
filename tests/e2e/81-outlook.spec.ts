import { ONGLET, expect, ouvrir, test, toast } from './outils';

// v1.1.14 (2026-10-23, d'abord dans Cockpit Benjamin) : un bouton « Outlook » sur la carte du patient cherche son nom dans Outlook web
// (onglet existant, sinon nouvel onglet) ; le nom est aussi copié, pour l'application de bureau (Ctrl+E puis Ctrl+V).
test.describe('Chercher le patient dans Outlook', () => {
  test('aucun onglet Outlook : il en ouvre un et y lance la recherche ; le nom est copié', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await page.getByRole('button', { name: /Outlook/ }).first().click();
    await toast(page, 'Recherche « Alice Essai » lancée dans Outlook');
    const j = await p.journal();
    expect(j.some((e) => e.api === 'tabs' && e.type === 'create' && /outlook\.cloud\.microsoft/.test((e.detail as { url: string }).url))).toBe(true);
    expect(j.find((e) => e.api === 'outlook')?.detail).toMatchObject({ texte: 'Alice Essai' });
    expect(await p.presse()).toBe('Alice Essai');
    expect(p.erreurs).toEqual([]);
  });

  test('onglet Outlook déjà ouvert : il passe dessus, sans en ouvrir un autre', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, ongletOutlook: true });
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await page.getByRole('button', { name: /Outlook/ }).first().click();
    await toast(page, 'Recherche « Bernard Test » lancée dans Outlook');
    const j = await p.journal();
    expect(j.some((e) => e.api === 'tabs' && e.type === 'create')).toBe(false);
    expect(j.some((e) => e.api === 'tabs' && e.type === 'update' && (e.detail as { id: number; active?: boolean }).id === 18)).toBe(true);
    expect(j.find((e) => e.api === 'outlook')?.detail).toMatchObject({ tabId: 18, texte: 'Bernard Test' });
  });
});
