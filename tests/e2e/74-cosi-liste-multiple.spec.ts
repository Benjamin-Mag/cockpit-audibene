import { type Page, expect, test } from '@playwright/test';
import { ONGLET, aller, ouvrir, toast } from './outils';

// « Le client est intéressé par » : liste à choix multiples de la Piste (demande de Benjamin, 26/10/2026).
// En modification, Lightning l'affiche en double liste (lightning-dual-listbox). La fausse page ci-dessous en reprend la
// structure : composants à shadow root, titre de groupe (pas de <label for>), listes role="listbox" « Disponible » et
// « Sélectionné » nommées par aria-labelledby, options role="option" avec aria-selected, flèches lightning-button-icon
// « Déplacer la sélection vers … » ; chaque clic redessine les listes (nouveaux éléments), comme Lightning. Données fictives.

const CHAMP = 'Le client est intéressé par';
const VALEURS = ['App ou télécommande', 'Rechargeable', 'Anti bruit vent', "Facilité d'utilisation", 'Streaming'];

interface Options { choisis?: string[]; exigeClicReel?: boolean; boutonMuet?: boolean; flechesSansNom?: boolean; flechesInconnues?: boolean }

async function fausseFiche(page: Page, o: Options = {}) {
  await page.goto('/content/salesforce/liste-multiple.ts');
  await page.evaluate(({ CHAMP, VALEURS, o }) => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    const w = window as unknown as { __journal: string[]; __choisis: Record<string, () => string[]> };
    w.__journal = [];
    w.__choisis = {};
    let n = 0;

    function doubleListe(parent: HTMLElement, libelle: string, valeurs: string[], depart: string[], nom: string) {
      const champ = document.createElement('lightning-input-field');
      champ.style.display = 'block';
      parent.append(champ);
      const srChamp = champ.attachShadow({ mode: 'open' });
      const hote = document.createElement('lightning-dual-listbox');
      hote.style.display = 'block';
      srChamp.append(hote);
      const sr = hote.attachShadow({ mode: 'open' });
      const id = ++n;
      let choisis = [...depart];
      let surlignees = new Set<string>();
      w.__choisis[nom] = () => [...choisis];
      sr.innerHTML = `<div class="slds-form-element" role="group" aria-labelledby="group-label-${id}">
        <div class="slds-form-element__legend slds-form-element__label" id="group-label-${id}">${libelle}</div>
        <div class="slds-form-element__control"><div class="slds-dueling-list">
          <div class="slds-dueling-list__column"><span class="slds-form-element__label" id="source-list-label-${id}">Disponible</span>
            <div class="slds-dueling-list__options"><ul role="listbox" aria-multiselectable="true" aria-labelledby="source-list-label-${id}" tabindex="0" data-cote="dispo"></ul></div></div>
          <div class="slds-dueling-list__column slds-dueling-list__column_responsive boutons"></div>
          <div class="slds-dueling-list__column"><span class="slds-form-element__label" id="selected-list-label-${id}">Sélectionné</span>
            <div class="slds-dueling-list__options"><ul role="listbox" aria-multiselectable="true" aria-labelledby="selected-list-label-${id}" tabindex="0" data-cote="choisis"></ul></div></div>
        </div></div></div>`;
      const ulDispo = sr.querySelector<HTMLElement>('[data-cote="dispo"]')!;
      const ulChoisis = sr.querySelector<HTMLElement>('[data-cote="choisis"]')!;

      const dessiner = () => {
        for (const [ul, liste] of [[ulDispo, valeurs.filter((v) => !choisis.includes(v))], [ulChoisis, choisis]] as const) {
          ul.replaceChildren();
          for (const v of liste) {
            const li = document.createElement('li');
            li.setAttribute('role', 'presentation');
            li.className = 'slds-listbox__item';
            li.innerHTML = `<div role="option" class="slds-listbox__option slds-listbox__option_plain slds-media slds-media_small slds-media_inline" tabindex="-1" aria-selected="${surlignees.has(v)}"><span class="slds-media__body"><span class="slds-truncate" title="${v}">${v}</span></span></div>`;
            const opt = li.firstElementChild as HTMLElement;
            opt.addEventListener('click', (e) => {
              w.__journal.push(`${nom}:clic ${v}${e.ctrlKey ? ' (ctrl)' : ''}`);
              if (o.exigeClicReel && !e.isTrusted) return;
              if (e.ctrlKey || e.metaKey) { if (surlignees.has(v)) surlignees.delete(v); else surlignees.add(v); } else surlignees = new Set([v]);
              dessiner();
            });
            ul.append(li);
          }
        }
      };

      const colonne = sr.querySelector<HTMLElement>('.boutons')!;
      for (const [vers, icone] of [['Sélectionné', 'right'], ['Disponible', 'left']] as const) {
        const bi = document.createElement('lightning-button-icon');
        bi.style.display = 'block';
        const srb = bi.attachShadow({ mode: 'open' });
        // Vraie org (26/10) : flèche introuvable par son nom. Variantes : nom absent, icône seulement sur l'hôte (icon-name),
        // ou ni nom ni icône reconnaissables.
        if (o.flechesSansNom) bi.setAttribute('icon-name', `utility:${icone}`);
        srb.innerHTML = o.flechesSansNom || o.flechesInconnues
          ? `<button class="slds-button slds-button_icon slds-button_icon-container" type="button"><svg class="slds-button__icon" aria-hidden="true" width="14" height="14"></svg></button>`
          : `<button class="slds-button slds-button_icon slds-button_icon-container" type="button" title="Déplacer la sélection vers ${vers}"><svg class="slds-button__icon" aria-hidden="true" width="14" height="14"><use href="/assets/icons/utility-sprite/svg/symbols.svg#${icone}"></use></svg><span class="slds-assistive-text">Déplacer la sélection vers ${vers}</span></button>`;
        srb.querySelector('button')!.addEventListener('click', () => {
          w.__journal.push(`${nom}:déplacer vers ${vers}`);
          if (o.boutonMuet) return;
          const versChoisis = vers === 'Sélectionné';
          const aBouger = [...surlignees].filter((v) => choisis.includes(v) !== versChoisis);
          choisis = versChoisis ? [...choisis, ...aBouger] : choisis.filter((v) => !aBouger.includes(v));
          surlignees = new Set();
          dessiner();
        });
        colonne.append(bi);
      }
      dessiner();
    }

    // Fiche gardée en arrière-plan par la console (taille nulle) : ne doit jamais être touchée.
    const cachee = document.createElement('div');
    cachee.style.display = 'none';
    document.body.append(cachee);
    doubleListe(cachee, CHAMP, VALEURS, [], 'cachee');
    // Une autre double liste de la fiche, à ne pas confondre.
    doubleListe(document.body, 'Traitement médical', ['Aucun', 'Anticoagulants'], [], 'autre');
    doubleListe(document.body, CHAMP, VALEURS, o.choisis ?? [], 'champ');
  }, { CHAMP, VALEURS, o });
}

const remplir = (page: Page, valeurs: string[]) => page.evaluate(async ({ CHAMP, valeurs }) => {
  const m = await import('/content/salesforce/actions.ts' as string) as { fillAnamnese: (p: unknown[], t: unknown[], m: { label: string; values: string[] }[]) => Promise<{ ok: boolean; msg: string; steps?: { ok: boolean; msg: string }[] }> };
  const r = await m.fillAnamnese([], [], [{ label: CHAMP, values: valeurs }]);
  const w = window as unknown as { __journal: string[]; __choisis: Record<string, () => string[]> };
  return { ...r, choisis: w.__choisis.champ(), cachee: w.__choisis.cachee(), autre: w.__choisis.autre(), journal: w.__journal };
}, { CHAMP, valeurs });

test.describe('COSI : double liste « Le client est intéressé par » (script de page)', () => {
  test('ajout de deux valeurs : sélection dans « Disponible » puis flèche vers « Sélectionné »', async ({ page }) => {
    await fausseFiche(page);
    const r = await remplir(page, ['Rechargeable', 'Streaming']);
    expect(r.ok).toBe(true);
    expect(r.choisis).toEqual(['Rechargeable', 'Streaming']);
    expect(r.steps).toEqual([{ ok: true, msg: `${CHAMP} → Rechargeable, Streaming` }]);
    expect(r.cachee).toEqual([]);
    expect(r.autre).toEqual([]);
    expect(r.journal.filter((j) => j.startsWith('champ:déplacer'))).toEqual(['champ:déplacer vers Sélectionné', 'champ:déplacer vers Sélectionné']);
    expect(r.journal.some((j) => !j.startsWith('champ:'))).toBe(false);
  });

  test('flèches sans nom (vraie org, 26/10) : retrouvées par l’icône de leur composant', async ({ page }) => {
    await fausseFiche(page, { flechesSansNom: true, choisis: ['Streaming'] });
    const r = await remplir(page, ['Rechargeable']);
    expect(r.ok).toBe(true);
    expect(r.choisis).toEqual(['Rechargeable']);
    expect(r.journal).toContain('champ:déplacer vers Sélectionné');
    expect(r.journal).toContain('champ:déplacer vers Disponible');
  });

  test('flèches méconnaissables (ni nom ni icône) : les deux seules flèches sont prises dans l’ordre', async ({ page }) => {
    await fausseFiche(page, { flechesInconnues: true });
    const r = await remplir(page, ['Rechargeable']);
    expect(r.ok).toBe(true);
    expect(r.choisis).toEqual(['Rechargeable']);
  });

  test('retrait : ce qui est dans « Sélectionné » sans être choisi repasse dans « Disponible »', async ({ page }) => {
    await fausseFiche(page, { choisis: ['Rechargeable', 'Streaming'] });
    const r = await remplir(page, ['Streaming']);
    expect(r.ok).toBe(true);
    expect(r.choisis).toEqual(['Streaming']);
    expect(r.journal).toContain('champ:déplacer vers Disponible');
    expect(r.journal).not.toContain('champ:déplacer vers Sélectionné');
  });

  test('déjà à jour : aucun clic, apostrophe typographique tolérée', async ({ page }) => {
    await fausseFiche(page, { choisis: ['Streaming', "Facilité d'utilisation"] });
    const r = await remplir(page, ['Facilité d’utilisation', 'Streaming']);
    expect(r.ok).toBe(true);
    expect(r.steps?.[0].msg).toContain('déjà à jour');
    expect(r.journal).toEqual([]);
  });

  test('option introuvable : signalée, les autres valeurs sont quand même posées', async ({ page }) => {
    await fausseFiche(page);
    const r = await remplir(page, ['Rechargeable', 'Valeur inconnue']);
    expect(r.ok).toBe(false);
    expect(r.choisis).toEqual(['Rechargeable']);
    expect(r.msg).toContain('option « Valeur inconnue » introuvable');
    expect(r.steps?.filter((s) => !s.ok).map((s) => s.msg)).toEqual([`${CHAMP} : option « Valeur inconnue » introuvable dans la liste de Salesforce`]);
  });

  test('clic refusé par Salesforce (clics scriptés ignorés) : échec précis, rien de faux', async ({ page }) => {
    await fausseFiche(page, { exigeClicReel: true });
    const r = await remplir(page, ['Rechargeable']);
    expect(r.ok).toBe(false);
    expect(r.choisis).toEqual([]);
    expect(r.msg).toContain('« Rechargeable » ne se sélectionne pas dans « Disponible »');
    expect(r.msg).toContain('« Sélectionné » contient rien — manque Rechargeable');
  });

  test('flèche sans effet : l\'étape du déplacement est nommée', async ({ page }) => {
    await fausseFiche(page, { boutonMuet: true });
    const r = await remplir(page, ['Streaming']);
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('« Streaming » sélectionnée mais pas déplacée vers « Sélectionné »');
  });

  test('fiche pas en modification : liste introuvable', async ({ page }) => {
    await page.goto('/content/salesforce/liste-multiple.ts');
    await page.evaluate(() => { document.documentElement.innerHTML = '<head></head><body><p>Fiche en lecture</p></body>'; });
    const r = await page.evaluate(async (CHAMP) => {
      const m = await import('/content/salesforce/liste-multiple.ts' as string) as { remplirListeMultiple: (l: string, v: string[]) => Promise<{ ok: boolean; msg: string }[]> };
      return m.remplirListeMultiple(CHAMP, ['Streaming']);
    }, CHAMP);
    expect(r).toEqual([{ ok: false, msg: `liste « ${CHAMP} » introuvable — la fiche est-elle en modification (crayon) ?` }]);
  });
});

test.describe('COSI : puces « Le client est intéressé par » (panneau)', () => {
  test('plusieurs puces actives, gardées en brouillon, envoyées en liste', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    const groupe = page.getByRole('group', { name: `${CHAMP} : plusieurs choix possibles` });
    await expect(page.getByText('plusieurs choix', { exact: true })).toBeVisible();
    await groupe.getByRole('button', { name: 'Rechargeable' }).click();
    await groupe.getByRole('button', { name: 'Streaming' }).click();
    await groupe.getByRole('button', { name: 'App ou télécommande' }).click();
    await groupe.getByRole('button', { name: 'App ou télécommande' }).click();
    await expect(groupe.getByRole('button', { name: 'Rechargeable' })).toHaveClass(/on/);
    await expect(groupe.getByRole('button', { name: 'Streaming' })).toHaveClass(/on/);
    await expect(groupe.getByRole('button', { name: 'App ou télécommande' })).not.toHaveClass(/on/);
    await page.waitForTimeout(600);
    await page.reload();
    await aller(page, 'COSI');
    await expect(groupe.getByRole('button', { name: 'Rechargeable' })).toHaveClass(/on/);
    await expect(groupe.getByRole('button', { name: 'Streaming' })).toHaveClass(/on/);
    await expect(page.getByRole('button', { name: /^Appliquer \(2\)/ })).toBeVisible();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.multis).toEqual([{ label: CHAMP, values: ['Rechargeable', 'Streaming'] }]);
    expect(d.picklists.map((x: { label: string }) => x.label)).not.toContain(CHAMP);
    expect(p.erreurs).toEqual([]);
  });

  test('rien choisi dans la liste : elle n\'est pas envoyée', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await aller(page, 'COSI');
    await page.getByRole('button', { name: 'Premier appareillage', exact: true }).click();
    await page.getByRole('button', { name: /^Appliquer/ }).click();
    await toast(page, 'OK fillAnamnese');
    const [d] = await p.demandes('fillAnamnese');
    expect(d.multis ?? []).toEqual([]);
  });
});
