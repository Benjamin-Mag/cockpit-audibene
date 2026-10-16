import { expect, test } from '@playwright/test';
import { lireLieu } from '../../src/content/salesforce/adresse';
import { ONGLET, ouvrir, toast } from './outils';

// Benjamin (2026-10-16) : certains centres demandent l'adresse du patient sur Doctolib (adresse, code postal, ville) ;
// elle doit venir du champ « Adresse » de la Piste, comme le reste du patient.
test.describe('Adresse du patient', () => {
  test('lecture du champ Adresse : rue, code postal, ville', () => {
    expect(lireLieu('12 rue de l’Essai\n75011 PARIS\nFrance')).toEqual({ rue: '12 rue de l’Essai', codePostal: '75011', ville: 'PARIS' });
    expect(lireLieu('Résidence Test\nBât. B, 3 allée des Tests\n37500 Ville-Test\nRégion\nFrance')).toEqual({ rue: 'Résidence Test, Bât. B, 3 allée des Tests', codePostal: '37500', ville: 'Ville-Test' });
    expect(lireLieu('7 place Test 13002 Ville-Test France')).toEqual({ rue: '7 place Test', codePostal: '13002', ville: 'Ville-Test' });
    expect(lireLieu('33510 VILLE TEST\nRégion\nFrance')).toEqual({ rue: '', codePostal: '33510', ville: 'VILLE TEST' });
    expect(lireLieu('Pas de code postal')).toBeNull();
  });

  test('Piste lue puis Doctolib : la fiche collée porte rue, code postal et ville, affichés sur la carte', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await page.evaluate(() => (window as any).__mock.activer(13));
    await expect(page.locator('.fiche').first()).toContainText('12 rue de l’Essai, 75011 Paris');
    await page.getByRole('button', { name: /Coller Alice Essai sur Doctolib/ }).click();
    await toast(page, 'OK pastePatient');
    const [d] = await p.demandes('pastePatient');
    expect(d.data).toMatchObject({ rue: '12 rue de l’Essai', codePostal: '75011', ville: 'Paris' });
    expect(d.data).not.toHaveProperty('adresse');
    expect(p.erreurs).toEqual([]);
  });
});
