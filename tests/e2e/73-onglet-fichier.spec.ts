import { type Page, expect, test } from '@playwright/test';

// La lecture de la fiche (src/content/salesforce/context.ts) exécutée dans une vraie page, sur une fausse page Salesforce :
// Vite sert src/, le module est importé tel quel. Données fictives.
//
// Bug vu par Benjamin le 26/10/2026 : sur la page d'un fichier (facture PDF ouverte depuis une Opportunité), Cockpit
// cliquait sur le sous-onglet « Détails » pour chercher les champs du patient, n'y trouvait rien, revenait sur « Aperçu »,
// et recommençait à chaque lecture : la page changeait d'onglet toute seule et Cockpit ne chargeait pas.

type Onglet = { nom: string; actif: boolean; champs?: Record<string, string> };

/** Fausse page : une barre de sous-onglets ; seul le contenu de l'onglet actif est affiché ; chaque clic est noté. */
async function fausePage(page: Page, chemin: string, onglets: Onglet[]) {
  await page.goto('/content/salesforce/context.ts');
  await page.evaluate(({ chemin, onglets }) => {
    history.replaceState(null, '', chemin);
    const w = window as unknown as { __clics: string[] };
    w.__clics = [];
    document.documentElement.innerHTML = '<head></head><body></body>';
    const barre = document.createElement('div');
    barre.setAttribute('role', 'tablist');
    document.body.append(barre);
    const contenus: HTMLElement[] = [];
    const montrer = (i: number) => onglets.forEach((_, j) => {
      barre.children[j].setAttribute('aria-selected', String(i === j));
      contenus[j].style.display = i === j ? 'block' : 'none';
    });
    onglets.forEach((o, i) => {
      const t = document.createElement('a');
      t.setAttribute('role', 'tab');
      t.textContent = o.nom;
      t.style.cssText = 'display:inline-block;padding:4px';
      t.addEventListener('click', () => { w.__clics.push(o.nom); montrer(i); });
      barre.append(t);
      const c = document.createElement('div');
      for (const [libelle, valeur] of Object.entries(o.champs ?? {})) {
        c.insertAdjacentHTML('beforeend', `<div class="slds-form-element"><span class="slds-form-element__label">${libelle}</span><div class="slds-form-element__control">${valeur}</div></div>`);
      }
      document.body.append(c);
      contenus.push(c);
    });
    montrer(onglets.findIndex((o) => o.actif));
  }, { chemin, onglets });
}

const lire = (page: Page) => page.evaluate(async () => {
  const m = await import('/content/salesforce/context.ts' as string) as { readFiche: (p: boolean) => Promise<{ page: string; prenom: string; nom: string }> };
  const f = await m.readFiche(false);
  const actif = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
  return { page: f.page, prenom: f.prenom, nom: f.nom, actif, clics: (window as unknown as { __clics: string[] }).__clics };
});

test.describe('Lecture de la fiche : sous-onglets', () => {
  test('page d\'un fichier (Aperçu / Détails) : aucun clic, l\'utilisateur reste sur Aperçu', async ({ page }) => {
    await fausePage(page, '/lightning/r/ContentDocument/FICHIERESSAI00001A/view', [{ nom: 'Aperçu', actif: true }, { nom: 'Détails', actif: false }]);
    const r = await lire(page);
    expect(r.clics).toEqual([]);
    expect(r.actif).toBe('Aperçu');
    expect(r.page).toBe('other');
  });

  test('Piste ouverte sur Partner Search : Cockpit va lire Anamnèse puis remet Partner Search', async ({ page }) => {
    await fausePage(page, '/lightning/r/Lead/PISTEESSAI0000001A/view', [
      { nom: 'Partner Search', actif: true },
      { nom: 'Anamnèse', actif: false, champs: { 'Nom complet': 'Mme Alice Essai' } },
    ]);
    const r = await lire(page);
    expect(r.clics).toEqual(['Anamnèse', 'Partner Search']);
    expect(r.actif).toBe('Partner Search');
    expect([r.page, r.prenom, r.nom]).toEqual(['lead', 'Alice', 'Essai']);
  });
});
