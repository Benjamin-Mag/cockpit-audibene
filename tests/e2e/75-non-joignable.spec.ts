import { type Page } from '@playwright/test';
import { ONGLET, expect, ouvrir, test, toast } from './outils';

// « Non joignable » (demande de Benjamin, 26/10/2026) : juste à gauche du Message vocal sur une Piste, il clique
// « Piste non joignable » seul, sans écrire de commentaire, en deux temps (« Non joignable » puis « Confirmer ? »).
// Données fictives.

const nonJoignable = (page: Page) => page.getByRole('button', { name: 'Non joignable', exact: true });
const confirmer = (page: Page) => page.getByRole('button', { name: 'Confirmer ?', exact: true });

test.describe('Non joignable (panneau)', () => {
  test('Piste : bouton bleu juste à gauche du Message vocal', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    const nj = nonJoignable(page);
    const mv = page.getByRole('button', { name: /Message vocal/ }).first();
    await expect(nj).toBeVisible();
    await expect(mv).toBeVisible();
    const a = (await nj.boundingBox())!;
    const b = (await mv.boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    expect(b.x - (a.x + a.width)).toBeLessThan(16);
    expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(3);
    await expect(nj).toHaveCSS('background-color', 'rgb(27, 79, 155)');
    await expect(nj).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await mv.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    expect(p.erreurs).toEqual([]);
  });

  test('Opportunité : pas de bouton Non joignable', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.opportunite });
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await expect(nonJoignable(page)).toHaveCount(0);
  });

  test('deux temps : rien au premier clic, puis « Piste non joignable » seul, sans texte, et message', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await nonJoignable(page).click();
    await expect(confirmer(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await p.demandes('runNonJoignable')).toEqual([]);
    await confirmer(page).click();
    await toast(page, 'OK runNonJoignable');
    expect(await p.demandes('runNonJoignable')).toEqual([{ type: 'runNonJoignable' }]);
    expect(await p.demandes('runMv')).toEqual([]);
    expect(await p.demandes('writeComment')).toEqual([]);
    await expect(nonJoignable(page)).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });

  test('sans second clic, « Confirmer ? » redevient « Non joignable » ; un double-clic ne confirme pas', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await nonJoignable(page).dblclick();
    await expect(confirmer(page)).toBeVisible();
    await expect(nonJoignable(page)).toBeVisible({ timeout: 6000 });
    expect(await p.demandes('runNonJoignable')).toEqual([]);
  });

  test('échec : message d’erreur, bouton rendu', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste, echecs: ['runNonJoignable'] });
    await nonJoignable(page).click();
    await page.waitForTimeout(500);
    await confirmer(page).click();
    await expect(page.locator('.toast.err')).toContainText('Échec simulé runNonJoignable');
    await expect(nonJoignable(page)).toBeEnabled();
  });
});

// Script de page : fausse Piste avec les onglets « Commentaires internes » / « Lead » du bandeau d'actions ;
// « Piste non joignable » n'existe que sous « Lead », et une fiche gardée en arrière-plan (taille nulle) a le sien.
interface Options { sansBouton?: boolean; sansOnglets?: boolean }

async function faussePiste(page: Page, o: Options = {}) {
  await page.goto('/content/salesforce/actions.ts');
  await page.evaluate((o) => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    const w = window as unknown as { __journal: string[] };
    w.__journal = [];
    const noter = (el: Element, quoi: string) => el.addEventListener('click', (e) => { e.preventDefault(); w.__journal.push(quoi); });

    const cachee = document.createElement('div');
    cachee.style.display = 'none';
    cachee.innerHTML = '<button type="button">Piste non joignable</button>';
    noter(cachee.querySelector('button')!, 'fiche cachée');
    document.body.append(cachee);

    const corps = document.createElement('div');
    const lead = () => {
      corps.innerHTML = o.sansBouton ? '<p>Lead</p>' : '<button type="button">Piste non joignable</button>';
      if (!o.sansBouton) noter(corps.querySelector('button')!, 'Piste non joignable');
    };
    if (o.sansOnglets) lead();
    else {
      const onglets = document.createElement('ul');
      onglets.setAttribute('role', 'tablist');
      onglets.innerHTML = '<li title="Commentaires internes"><a href="#">Commentaires internes</a></li><li title="Lead"><a href="#">Lead</a></li>';
      noter(onglets.querySelector('[title="Commentaires internes"] a')!, 'onglet Commentaires internes');
      const a = onglets.querySelector('[title="Lead"] a')!;
      noter(a, 'onglet Lead');
      a.addEventListener('click', () => setTimeout(lead, 150));
      document.body.append(onglets);
      corps.innerHTML = '<label for="c">Commentaires</label><textarea id="c"></textarea><button type="button">Enregistrer</button>';
      noter(corps.querySelector('button')!, 'Enregistrer');
    }
    document.body.append(corps);
  }, o);
}

const lancer = (page: Page) => page.evaluate(async () => {
  const m = await import('/content/salesforce/actions.ts' as string) as { runNonJoignable: () => Promise<{ ok: boolean; msg: string }> };
  const r = await m.runNonJoignable();
  return { ok: r.ok, msg: r.msg, journal: (window as unknown as { __journal: string[] }).__journal };
});

test.describe('Non joignable (script de page)', () => {
  test('onglet « Lead », puis « Piste non joignable » ; aucun commentaire, rien sur la fiche cachée', async ({ page }) => {
    await faussePiste(page);
    const r = await lancer(page);
    expect(r).toEqual({ ok: true, msg: 'Piste marquée non joignable (sans commentaire)', journal: ['onglet Lead', 'Piste non joignable'] });
  });

  test('bouton déjà à l’écran, sans onglet « Lead » : cliqué quand même', async ({ page }) => {
    await faussePiste(page, { sansOnglets: true });
    const r = await lancer(page);
    expect(r.ok).toBe(true);
    expect(r.journal).toEqual(['Piste non joignable']);
  });

  test('bouton introuvable : rien n’est fait, et le message le dit', async ({ page }) => {
    await faussePiste(page, { sansBouton: true });
    const r = await lancer(page);
    expect(r.ok).toBe(false);
    expect(r.msg).toBe('Rien n\'a été fait : bouton "Piste non joignable" introuvable');
    expect(r.journal.filter((j) => j !== 'onglet Lead')).toEqual([]);
  });
});
