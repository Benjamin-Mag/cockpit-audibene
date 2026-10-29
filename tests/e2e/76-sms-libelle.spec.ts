import { type Page, expect, test } from '@playwright/test';

// L'ouverture des SMS (src/content/salesforce/actions.ts, openSmsPanel) exécutée dans une vraie page, sur une fausse
// barre d'utilitaires de Salesforce : Vite sert src/, le module est importé tel quel. Données fictives.
//
// Signalé par Benjamin le 29/10/2026 : chez certains collègues, l'utilitaire Hearo s'appelle « Client marqué » (Hearo
// change son libellé selon ses alertes), et le bouton SMS ne le trouvait plus.

/** Fausse page : barre du bas (libellés donnés), un panneau qui s'ouvre au clic, et un filtre du Kanban hors de la barre. */
async function fausePage(page: Page, libelles: string[], filtreKanban = true) {
  await page.goto('/content/salesforce/actions.ts');
  await page.evaluate(({ libelles, filtreKanban }) => {
    const w = window as unknown as { __clics: string[] };
    w.__clics = [];
    document.documentElement.innerHTML = '<head></head><body></body>';
    if (filtreKanban) {
      const menu = document.createElement('div');
      menu.innerHTML = '<button type="button" class="slds-dropdown__item">Clients marqués ce mois-ci</button>';
      menu.querySelector('button')!.addEventListener('click', () => w.__clics.push('filtre du Kanban'));
      document.body.append(menu);
    }
    const barre = document.createElement('footer');
    barre.className = 'slds-utility-bar_container';
    barre.innerHTML = `<ul class="slds-utility-bar">${libelles.map((l) => `<li class="slds-utility-bar__item"><button type="button" class="slds-utility-bar__action"><span class="slds-utility-bar__text">${l}</span></button></li>`).join('')}</ul>`;
    barre.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const l = b.textContent ?? '';
      w.__clics.push(l);
      if (l === 'Téléphone') return;
      const panneau = document.createElement('div');
      panneau.className = 'slds-utility-panel';
      panneau.style.cssText = 'width:300px;height:300px';
      panneau.innerHTML = `<h2>${l}</h2><iframe src="about:blank#sms-essai" title="Application Canvas"></iframe>`;
      document.body.append(panneau);
    }));
    document.body.append(barre);
  }, { libelles, filtreKanban });
}

const ouvrir = (page: Page) => page.evaluate(async () => {
  const m = await import('/content/salesforce/actions.ts' as string) as { openSmsPanel: () => Promise<{ ok: boolean; msg: string; steps?: { msg: string }[] }> };
  const r = await m.openSmsPanel();
  return { ...r, clics: (window as unknown as { __clics: string[] }).__clics };
});

test.describe('SMS : utilitaire Hearo, quel que soit son libellé', () => {
  test('« Client marqué » dans la barre du bas : ouvert, jamais le filtre du Kanban', async ({ page }) => {
    await fausePage(page, ['Téléphone', 'Client marqué']);
    const r = await ouvrir(page);
    expect(r.ok).toBe(true);
    expect(r.clics).toEqual(['Client marqué']);
    expect(r.steps?.map((s) => s.msg)).toEqual(['about:blank#sms-essai']);
  });

  test('libellés déjà connus : « Hearo », « Nouveau message », « Approbation en attente »', async ({ page }) => {
    for (const libelle of ['Hearo', 'Nouveau message', 'Approbation en attente', 'Nouveaux messages']) {
      await fausePage(page, ['Téléphone', libelle]);
      const r = await ouvrir(page);
      expect(r.ok, libelle).toBe(true);
      expect(r.clics, libelle).toEqual([libelle]);
    }
  });

  test('aucun utilitaire SMS : rien n’est cliqué, le message dit les boutons de la barre', async ({ page }) => {
    await fausePage(page, ['Téléphone', 'Notes']);
    const r = await ouvrir(page);
    expect(r.ok).toBe(false);
    expect(r.clics).toEqual([]);
    expect(r.msg).toBe('bouton Hearo / Nouveau message introuvable dans la barre du bas (boutons vus : Téléphone, Notes)');
  });
});
