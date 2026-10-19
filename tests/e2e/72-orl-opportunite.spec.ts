import { ONGLET, aller, expect, ouvrir, test } from './outils';

// Benjamin (2026-10-19) : l'ORL Finder aussi sur une Opportunité. Le code postal du patient vient du titre de
// l'Opportunité ; l'écran arrive après Mails et Chat partenaire, et ne lance aucune recherche tant qu'on ne l'ouvre pas.
test.describe('ORL Finder sur une Opportunité', () => {
  test('ouvrir l\'Opportunité ne cherche rien ; ORL Finder liste les ORL du code postal du patient', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite });
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await page.waitForTimeout(800);
    const avant = (await p.journal()).filter((j) => j.api === 'reseau' && String(j.detail).includes('/hcp/search'));
    expect(avant).toHaveLength(0);
    await aller(page, 'ORL Finder');
    await expect(page.getByText(/TOP 3/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/13002/).first()).toBeVisible();
    const reseau = (await p.journal()).filter((j) => j.api === 'reseau').map((j) => j.detail as string);
    expect(reseau.some((u) => u.includes('/hcp/search'))).toBe(true);
    expect(reseau.some((u) => /Bernard|Test%20|Bernard%20/.test(u))).toBe(false);
    expect(p.erreurs).toEqual([]);
  });
});
