import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Benjamin (01/10) : la même situation pour Situation 1 et Situation 2, avec des commentaires différents.
const bloc = (page: any, situation: string) => page.locator('.stack').filter({ has: page.locator('.field-head', { hasText: situation }) }).first();

test.describe('COSI : même situation deux fois', () => {
  test('Musique en 1 et en 2, phrases différentes → deux champs commentaires distincts', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await bloc(page, 'Situation 1').getByRole('button', { name: 'Musique', exact: true }).click();
    await bloc(page, 'Situation 2').getByRole('button', { name: 'Musique', exact: true }).click();
    // Une phrase saisie sous la situation 1, une autre sous la situation 2.
    const saisie1 = bloc(page, 'Situation 1').getByPlaceholder(/Nouvelle phrase/);
    await saisie1.fill('Chorale le mardi');
    await saisie1.press('Enter');
    const saisie2 = bloc(page, 'Situation 2').getByPlaceholder(/Nouvelle phrase/);
    await expect(saisie2).toHaveValue('');
    await saisie2.fill('Concerts');
    // Pendant la saisie sous la situation 2, le champ de la situation 1 ne doit pas se remplir en miroir.
    await expect(saisie1).toHaveValue('');
    await saisie2.press('Enter');
    await expect(saisie1).toHaveValue('');
    // On coche Chorale pour la 1, Concerts pour la 2.
    await bloc(page, 'Situation 1').getByRole('button', { name: /^Chorale le mardi/ }).click();
    await bloc(page, 'Situation 2').getByRole('button', { name: /^Concerts/ }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.picklists).toContainEqual({ label: 'Situation très importante 1', value: 'Musique' });
    expect(d.picklists).toContainEqual({ label: 'Situation très importante 2', value: 'Musique' });
    expect(d.texts).toContainEqual({ label: 'Situation 1 - commentaires', value: 'Chorale le mardi' });
    expect(d.texts).toContainEqual({ label: 'Situation 2 - commentaires', value: 'Concerts' });
    expect(p.erreurs).toEqual([]);
  });
});
