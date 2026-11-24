import { ONGLET, expect, ouvrir, test } from './outils';

// Le dossier de cockpit.json peut ne jamais répondre (OneDrive, dossier déplacé, droits) : le panneau restait
// sur son squelette de chargement. Au bout de 8 s, il s'ouvre avec la copie du navigateur.
test('cockpit.json ne répond plus : le panneau s’ouvre quand même avec la copie du navigateur', async ({ page }) => {
  const p = await ouvrir(page, { onglet: ONGLET.piste, dossier: { permission: 'granted', muet: true } });
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  // Dossier mémorisé, comme après un « Choisir le dossier » ; il ne répondra plus à la lecture suivante.
  await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cockpit', { create: true });
    const fh = await dir.getFileHandle('cockpit.json', { create: true });
    const w = await fh.createWritable();
    await w.write('{}');
    await w.close();
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
  await expect.poll(async () => (await p.journal()).some((j) => j.api === 'dossier' && j.type === 'lectureMuette')).toBe(true);
  await expect(page.getByText('Alice Essai').first()).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole('button', { name: /COSI/ }).first()).toBeVisible();
  expect(p.erreurs.filter((e) => !/\[Cockpit\] dossier injoignable/.test(e))).toEqual([]);
  expect(p.erreurs.some((e) => /délai de 8 s dépassé/.test(e))).toBe(true);
});
