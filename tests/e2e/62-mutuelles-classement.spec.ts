import { ONGLET, aller, expect, glisser, ouvrir, test } from './outils';

// Benjamin (01/10) : les noms de mutuelles enregistrés doivent pouvoir se classer, comme les catégories de mails.
const mutuelles = (p: any) => p.donnees().then((d: any) => d.anamnese.phrases['Nom de la mutuelle'] ?? []);

test.describe('COSI : classer les phrases enregistrées', () => {
  test('mutuelles : réordonnées en glissant, puis triées A→Z', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const champ = page.locator('.field').filter({ hasText: 'Nom de la mutuelle' }).locator('input');
    for (const nom of ['MGEN', 'Harmonie', 'AG2R']) { await champ.fill(nom); await champ.press('Enter'); }
    await expect.poll(() => mutuelles(p)).toEqual(['MGEN', 'Harmonie', 'AG2R']);

    const puce = (nom: string) => page.locator('.drag-wrap').filter({ has: page.getByRole('button', { name: new RegExp('^' + nom) }) });
    await glisser(page, puce('AG2R'), puce('MGEN'));
    await expect.poll(() => mutuelles(p)).toEqual(['AG2R', 'MGEN', 'Harmonie']);

    await page.getByRole('button', { name: 'A→Z' }).click();
    await expect.poll(() => mutuelles(p)).toEqual(['AG2R', 'Harmonie', 'MGEN']);
    // L'ordre se voit à l'écran dans le même sens.
    const noms = await page.locator('.drag-wrap .chip').allInnerTexts();
    expect(noms.map((n) => n.trim())).toEqual(['AG2R', 'Harmonie', 'MGEN']);
    expect(p.erreurs).toEqual([]);
  });
});
