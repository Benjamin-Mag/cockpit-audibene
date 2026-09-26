import { type Page } from '@playwright/test';
import { ONGLET, aller, expect, ouvrir, test, toast, type Scenario } from './outils';

// Dossier synchronisé simulé : un répertoire « Cockpit » du stockage privé du navigateur (OPFS),
// rangé dans IndexedDB comme le ferait le sélecteur de dossier ; l'autorisation est jouée par le
// faux navigateur (voir `dossier` dans faux-navigateur.js).
async function avecDossier(page: Page, dossier: Scenario['dossier'] = {}) {
  const p = await ouvrir(page, { onglet: ONGLET.piste, dossier: { permission: 'prompt', ...dossier } });
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit', { create: true });
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
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  return p;
}
const fichierDossier = (page: Page) => page.evaluate(async () => {
  try {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit');
    return JSON.parse(await (await (await dir.getFileHandle('cockpit.json')).getFile()).text());
  } catch { return null; }
});
const bandeau = (page: Page) => page.locator('.banner').filter({ hasText: /attend ton accord/ });
const changerNom = async (page: Page, nom: string) => {
  await aller(page, 'Réglages');
  await page.locator('.field').filter({ hasText: 'Prénom et nom' }).locator('input').fill(nom);
  // Voir le défaut noté plus bas : le bandeau n'est recalculé qu'au rendu suivant l'enregistrement.
  await page.waitForTimeout(700);
  await aller(page, 'COSI');
};

test.describe('Dossier synchronisé en pause', () => {
  test('rien à copier : pas de bandeau ; un changement le fait apparaître', async ({ page }) => {
    const p = await avecDossier(page);
    await aller(page, 'Réglages');
    await expect(page.getByText(/cockpit\.json — en pause/)).toBeVisible();
    await expect(page.getByText('La copie du dossier est à jour.', { exact: false })).toBeVisible();
    await expect(bandeau(page)).toHaveCount(0);
    await changerNom(page, 'Benjamin Dossier');
    await expect(bandeau(page)).toBeVisible();
    await expect(bandeau(page)).toContainText('Cockpit');
    // Les données sont quand même écrites dans le navigateur.
    await expect.poll(async () => (await p.donnees()).reglages.nom).toBe('Benjamin Dossier');
    expect(await fichierDossier(page)).toBeNull();
    expect(p.erreurs).toEqual([]);
  });

  test('« Autoriser » : le dossier reçoit cockpit.json et le bandeau disparaît', async ({ page }) => {
    const p = await avecDossier(page);
    await changerNom(page, 'Benjamin Dossier');
    await expect(bandeau(page)).toBeVisible();
    await bandeau(page).getByRole('button', { name: 'Autoriser' }).click();
    await toast(page, 'Dossier Cockpit synchronisé');
    await expect(bandeau(page)).toHaveCount(0);
    expect((await p.journal()).some((j) => j.api === 'dossier' && j.type === 'requestPermission')).toBe(true);
    expect((await fichierDossier(page))?.reglages?.nom).toBe('Benjamin Dossier');
    await aller(page, 'Réglages');
    await expect(page.getByText(/cockpit\.json — synchronisé/)).toBeVisible();
    // Les changements suivants vont directement dans le dossier.
    await changerNom(page, 'Benjamin Suite');
    await expect.poll(async () => (await fichierDossier(page))?.reglages?.nom).toBe('Benjamin Suite');
    await expect(bandeau(page)).toHaveCount(0);
    expect(p.erreurs).toEqual([]);
  });

  test('« Autoriser » refusé : message clair, le bandeau reste', async ({ page }) => {
    await avecDossier(page, { refus: true });
    await changerNom(page, 'Benjamin Dossier');
    await bandeau(page).getByRole('button', { name: 'Autoriser' }).click();
    await expect(page.locator('.toast.err')).toContainText('Accès refusé');
    await expect(bandeau(page)).toBeVisible();
    expect(await fichierDossier(page)).toBeNull();
  });

  test('« Ne plus demander » : bandeau masqué, même après rechargement ; « Redemander » dans Réglages', async ({ page }) => {
    await avecDossier(page);
    await changerNom(page, 'Benjamin Dossier');
    await bandeau(page).getByRole('button', { name: 'Ne plus demander' }).click();
    await toast(page, 'Demande masquée');
    await expect(bandeau(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cockpit-dossier-silence'))).toBe('1');
    await page.reload();
    await changerNom(page, 'Benjamin Encore');
    await page.waitForTimeout(800);
    await expect(bandeau(page)).toHaveCount(0);
    await aller(page, 'Réglages');
    await expect(page.getByText(/demande masquée\./)).toBeVisible();
    await page.getByRole('button', { name: 'Redemander' }).click();
    await expect(bandeau(page)).toBeVisible();
  });

  // DÉFAUT (src/panel/app.tsx:71-72 + src/panel/storage/data.ts:150) : save() change data.updatedAt
  // directement dans l'objet de l'état, sans nouveau rendu (setStorage garde le même état quand la synchro
  // reste « paused »). Le bandeau (aCopier, app.tsx:325) et la phrase de Réglages ne sont donc recalculés
  // qu'au rendu suivant : après le dernier changement (une case cochée, un nom tapé, un glisser-déposer),
  // le bandeau n'apparaît pas tant que Benjamin ne clique pas ailleurs, et Réglages affiche encore
  // « La copie du dossier est à jour ».
  test.fixme('un seul changement fait apparaître le bandeau sans autre action', async ({ page }) => {
    await avecDossier(page);
    await aller(page, 'Réglages');
    await page.locator('.field').filter({ hasText: 'Prénom et nom' }).locator('input').fill('Benjamin Dossier');
    await expect(bandeau(page)).toBeVisible();
    await expect(page.getByText(/Des changements attendent d’être copiés/)).toBeVisible();
  });
});
