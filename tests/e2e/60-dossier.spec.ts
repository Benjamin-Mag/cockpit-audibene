import { type Page } from '@playwright/test';
import { ONGLET, aller, expect, ouvrir, test, toast, type Scenario } from './outils';

// Dossier synchronisé simulé : un répertoire « Cockpit » du stockage privé du navigateur (OPFS),
// rangé dans IndexedDB comme le ferait le sélecteur de dossier ; l'autorisation est jouée par le
// faux navigateur (voir `dossier` dans faux-navigateur.js).
async function avecDossier(page: Page, dossier: Scenario['dossier'] = {}, autres: Partial<Scenario> = {}) {
  const p = await ouvrir(page, { onglet: ONGLET.piste, dossier: { permission: 'prompt', ...dossier }, ...autres });
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

  // Non-régression : save() date les données en place ; sans nouveau rendu, le bandeau n'apparaissait
  // qu'au clic suivant et Réglages affichait encore « La copie du dossier est à jour ».
  test('un seul changement fait apparaître le bandeau sans autre action', async ({ page }) => {
    await avecDossier(page);
    await aller(page, 'Réglages');
    await page.locator('.field').filter({ hasText: 'Prénom et nom' }).locator('input').fill('Benjamin Dossier');
    await expect(bandeau(page)).toBeVisible();
    await expect(page.getByText(/Des changements attendent d’être copiés/)).toBeVisible();
  });
});

// Benjamin (2026-10-06) : il cliquait « Autoriser » sans cesse et son cockpit.json restait au 17/09.
// Le fichier était en lecture seule : l'écriture échouait en silence et le panneau annonçait « synchronisé ».
test.describe('cockpit.json en lecture seule', () => {
  const bloque = (page: Page) => page.locator('.banner').filter({ hasText: /n’arrive pas à écrire/ });
  const leverLectureSeule = (page: Page) => page.evaluate(() => { (window as unknown as { __SCENARIO: { dossier: { lectureSeule: boolean } } }).__SCENARIO.dossier.lectureSeule = false; });

  test('« Autoriser » ne dit plus « synchronisé » : message clair, puis « Réessayer » une fois le fichier débloqué', async ({ page }) => {
    const p = await avecDossier(page, { lectureSeule: true });
    await changerNom(page, 'Benjamin Dossier');
    await bandeau(page).getByRole('button', { name: 'Autoriser' }).click();
    await expect(page.locator('.toast.err')).toContainText('n’arrive pas à écrire');
    await expect(page.locator('.toast').filter({ hasText: 'synchronisé' })).toHaveCount(0);
    await expect(bloque(page)).toBeVisible();
    await expect(bandeau(page)).toHaveCount(0);
    expect(await fichierDossier(page)).toBeNull();
    await expect.poll(async () => (await p.donnees()).reglages.nom).toBe('Benjamin Dossier');
    await aller(page, 'Réglages');
    await expect(page.getByText(/cockpit\.json — écriture refusée/)).toBeVisible();

    await leverLectureSeule(page);
    await bloque(page).getByRole('button', { name: 'Réessayer' }).click();
    await toast(page, 'Dossier Cockpit synchronisé');
    await expect(bloque(page)).toHaveCount(0);
    expect((await fichierDossier(page))?.reglages?.nom).toBe('Benjamin Dossier');
    await expect(page.getByText(/cockpit\.json — synchronisé/)).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });

  test('visible même avec « Ne plus demander », et le fichier se remet à jour seul dès qu’il est débloqué', async ({ page }) => {
    const p = await avecDossier(page, { permission: 'granted', lectureSeule: true });
    await page.evaluate(() => localStorage.setItem('cockpit-dossier-silence', '1'));
    await page.reload();
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await expect(bloque(page)).toBeVisible();
    await expect(bloque(page)).toContainText('Cockpit');
    await changerNom(page, 'Benjamin Dossier');
    await expect.poll(async () => (await p.donnees()).reglages.nom).toBe('Benjamin Dossier');
    expect(await fichierDossier(page)).toBeNull();

    await leverLectureSeule(page);
    await changerNom(page, 'Benjamin Suite');
    await expect.poll(async () => (await fichierDossier(page))?.reglages?.nom).toBe('Benjamin Suite');
    await expect(bloque(page)).toHaveCount(0);
    expect(p.erreurs).toEqual([]);
  });
});

// Benjamin (2026-10-06) : « j'ai peur qu'ils perdent leurs données ». Avec « Ne plus demander », le
// cockpit.json d'un collègue pouvait rester des semaines en retard sans que rien ne le signale.
test.describe('Rappel de sauvegarde en retard', () => {
  const rappel = (page: Page) => page.locator('.banner').filter({ hasText: /Ta dernière sauvegarde/ });
  const JOUR = 86_400_000;
  const vieillir = async (page: Page, jours: number) => {
    await page.evaluate((t) => { localStorage.setItem('cockpit-dossier-silence', '1'); localStorage.setItem('cockpit-dossier-ecrit', String(t)); }, Date.now() - jours * JOUR);
    await page.reload();
    // Le panneau rouvre sur le dernier écran (COSI, sans carte patient) : on attend la roue des Réglages.
    await expect(page.getByRole('button', { name: 'Réglages', exact: true }).first()).toBeVisible();
  };

  test('plus de 7 jours : rappel même avec « Ne plus demander », « Mettre à jour » remet le fichier à jour', async ({ page }) => {
    const p = await avecDossier(page);
    await vieillir(page, 10);
    await page.waitForTimeout(500);
    await expect(rappel(page)).toHaveCount(0);
    await changerNom(page, 'Benjamin Rappel');
    await expect(rappel(page)).toBeVisible();
    await expect(rappel(page)).toContainText('il y a 10 jours');
    await expect(bandeau(page)).toHaveCount(0);
    await aller(page, 'Réglages');
    await expect(page.getByText(/Dernière sauvegarde dans le dossier : .*il y a 10 jours/)).toBeVisible();
    await rappel(page).getByRole('button', { name: 'Mettre à jour' }).click();
    await toast(page, 'Dossier Cockpit synchronisé');
    await expect(rappel(page)).toHaveCount(0);
    expect((await fichierDossier(page))?.reglages?.nom).toBe('Benjamin Rappel');
    expect(p.erreurs).toEqual([]);
  });

  test('moins de 7 jours : pas de rappel ; « Plus tard » le masque jusqu’au lendemain, même après rechargement', async ({ page }) => {
    await avecDossier(page);
    await vieillir(page, 3);
    await changerNom(page, 'Benjamin Récent');
    await page.waitForTimeout(500);
    await expect(rappel(page)).toHaveCount(0);

    await vieillir(page, 8);
    await changerNom(page, 'Benjamin Ancien');
    await expect(rappel(page)).toBeVisible();
    await rappel(page).getByRole('button', { name: 'Plus tard' }).click();
    await expect(rappel(page)).toHaveCount(0);
    const jusqua = await page.evaluate(() => Number(localStorage.getItem('cockpit-rappel-reporte')));
    expect(jusqua).toBeGreaterThan(Date.now() + 23 * JOUR / 24);
    await page.reload();
    await changerNom(page, 'Benjamin Encore');
    await page.waitForTimeout(500);
    await expect(rappel(page)).toHaveCount(0);
  });
});

// Benjamin (2026-10-15) : quatre Cockpit partagent un même cockpit.json. Une suppression faite dans l'un doit
// s'appliquer aux autres (fusion à trois avec le dernier état commun), sans qu'une vieille copie efface quoi que ce soit.
test.describe('Fichier partagé entre plusieurs Cockpit', () => {
  /** Ce que ferait un autre Cockpit : réécrire cockpit.json dans le dossier. */
  const reecrireFichier = (page: Page, code: string) => page.evaluate(async (c) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit');
    const fh = await dir.getFileHandle('cockpit.json');
    const d = JSON.parse(await (await fh.getFile()).text());
    new Function('d', c)(d);
    const w = await fh.createWritable();
    await w.write(JSON.stringify(d, null, 2));
    await w.close();
  }, code);
  const recharger = async (page: Page) => {
    await page.reload();
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
  };

  test('modèle supprimé par un autre Cockpit : supprimé ici au chargement suivant', async ({ page }) => {
    const p = await avecDossier(page, { permission: 'granted' }, { localPersistant: true });
    await expect.poll(async () => (await fichierDossier(page))?.templates?.length ?? 0).toBeGreaterThan(1);
    const avant = (await p.donnees()).templates.length;
    const supprime = (await fichierDossier(page)).templates[1].id;
    await reecrireFichier(page, 'd.templates.splice(1, 1); d.updatedAt = Date.now() + 60000;');
    await recharger(page);
    await expect.poll(async () => (await p.donnees()).templates.length).toBe(avant - 1);
    expect((await p.donnees()).templates.some((t: any) => t.id === supprime)).toBe(false);
    expect((await fichierDossier(page)).templates.some((t: any) => t.id === supprime)).toBe(false);
    expect(p.erreurs).toEqual([]);
  });

  test('vieille copie remise à la main dans le dossier : rien n\'est effacé', async ({ page }) => {
    const p = await avecDossier(page, { permission: 'granted' }, { localPersistant: true });
    await expect.poll(async () => (await fichierDossier(page))?.templates?.length ?? 0).toBeGreaterThan(1);
    const avant = (await p.donnees()).templates.length;
    await reecrireFichier(page, 'd.templates = d.templates.slice(0, 1); d.updatedAt = 1;');
    await recharger(page);
    await page.waitForTimeout(800);
    expect((await p.donnees()).templates.length).toBe(avant);
    await expect.poll(async () => (await fichierDossier(page)).templates.length).toBe(avant);
  });
});
