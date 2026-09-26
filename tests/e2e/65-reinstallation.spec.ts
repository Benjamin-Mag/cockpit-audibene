import { type Page } from '@playwright/test';
import { ONGLET, donneesTest, expect, ouvrir, test } from './outils';

// Réinstallation complète (26/09, Benjamin) : extension neuve, donc rien dans le navigateur ;
// il choisit son dossier habituel, puis le panneau se ferme — Edge retire l'accès au dossier.
// Avant le correctif : au retour, écran « prénom nom » dont le bouton « C'est parti » ne faisait rien.

/** Le dossier habituel de Benjamin, avec un cockpit.json complet, rendu par le sélecteur de dossier. */
async function preparerDossier(page: Page) {
  await page.evaluate(async (contenu) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit', { create: true });
    const f = await dir.getFileHandle('cockpit.json', { create: true });
    const w = await f.createWritable();
    await w.write(contenu);
    await w.close();
    (window as any).showDirectoryPicker = async () => dir;
  }, JSON.stringify(donneesTest()));
}

test.describe('Réinstallation', () => {
  test('dossier choisi, panneau fermé puis rouvert : les données sont là, pas d\'écran bloqué', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste, donnees: null, dossier: { permission: 'prompt' }, localPersistant: true });
    await expect(page.getByRole('button', { name: /Choisir mon dossier/ })).toBeVisible();
    await preparerDossier(page);
    await page.getByRole('button', { name: /Choisir mon dossier/ }).click();
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    // Le panneau se ferme et se rouvre : Edge a retiré l'accès au dossier (autorisation « prompt »).
    await page.reload();
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /C'est parti/ })).toHaveCount(0);
    expect((await p.donnees())?.reglages?.nom).toBe('Benjamin Test');
    expect(p.erreurs).toEqual([]);
  });

  test('ni copie dans le navigateur ni accès au dossier : on repropose le dossier, jamais un bouton mort', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, donnees: null, dossier: { permission: 'prompt' }, localPersistant: true });
    await preparerDossier(page);
    // Poignée du dossier déjà mémorisée (choix fait par une version précédente), mais rien dans le navigateur.
    await page.evaluate(async () => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit');
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('cockpit-audibene', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => {
          const tx = req.result.transaction('handles', 'readwrite');
          tx.objectStore('handles').put(dir, 'dir');
          tx.oncomplete = () => { req.result.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    await page.reload();
    await expect(page.getByRole('button', { name: /Choisir mon dossier/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /C'est parti/ })).toHaveCount(0);
    await preparerDossier(page);
    await page.getByRole('button', { name: /Choisir mon dossier/ }).click();
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
  });
});
