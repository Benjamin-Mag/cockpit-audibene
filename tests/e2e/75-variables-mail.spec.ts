import { type Page, expect, test } from '@playwright/test';
import { resolveGenre } from '../../src/panel/model';
import { FORMES_GENRE, GROUPES_VARIABLES } from '../../src/panel/variables-mail';
import { dateHeureDepuisTexte, estChampRdv, rdvDepuisChamps } from '../../src/shared/rdv';
import { ONGLET, type Panneau, aller, ouvrir, toast } from './outils';

// Benjamin (26/10/2026) : l'éditeur de modèle de mail doit proposer toutes les variables que le remplissage sait
// résoudre, dont la date et l'heure, lues sur la fiche ouverte, et toutes les formes masculin / féminin.
// Mêmes cas que tests/variables-mail.spec.ts de Cockpit Plein Écran (même règle, même résultat). Données fictives.

const RDV = { date: '2026-11-12', heure: '14:30', champ: 'Date du rendez-vous' };

test.describe('Rendez-vous lu sur la fiche (règle commune)', () => {
  test('libellés reconnus, et ceux qui ne sont pas la date du rendez-vous', () => {
    for (const l of ['Date du rendez-vous', 'Date et heure du RDV', 'Rendez-vous', 'Date du 1er RDV', 'Heure du RDV', 'RDV partenaire', 'Appointment Date', 'Date RDV']) expect(estChampRdv(l), l).toBe(true);
    for (const l of ['A rappeler (date/heure)', 'Date de création', 'RDV pris le', 'Statut du RDV', 'Date de confirmation du RDV', 'Time to first Appointment', 'Date de naissance', 'Dernier contact', 'Type de RDV', 'Rendez-vous annulé le']) expect(estChampRdv(l), l).toBe(false);
  });

  test('date et heure dans le texte affiché', () => {
    expect(dateHeureDepuisTexte('12/11/2026 14:30')).toEqual({ date: '2026-11-12', heure: '14:30' });
    expect(dateHeureDepuisTexte('12/11/2026, 9h05')).toEqual({ date: '2026-11-12', heure: '09:05' });
    expect(dateHeureDepuisTexte('2026-11-12T14:30:00')).toEqual({ date: '2026-11-12', heure: '14:30' });
    expect(dateHeureDepuisTexte('11/12/2026 2:30 PM')).toEqual({ date: '2026-12-11', heure: '14:30' });
    expect(dateHeureDepuisTexte('12/11/2026')).toEqual({ date: '2026-11-12', heure: '' });
    expect(dateHeureDepuisTexte('31/02/2026 10:00')).toBeNull();
    expect(dateHeureDepuisTexte('Mardi à 14h')).toBeNull();
  });

  test('choix du champ : le premier du rendez-vous dans la page, son heure ou celle d’un champ « heure » ; rappel jamais pris', () => {
    expect(rdvDepuisChamps([
      { libelle: 'A rappeler (date/heure)', valeur: '03/11/2026 10:00' },
      { libelle: 'Statut du RDV', valeur: 'Confirmé' },
      { libelle: 'Date du rendez-vous', valeur: '12/11/2026 14:30' },
    ])).toEqual(RDV);
    expect(rdvDepuisChamps([
      { libelle: 'Date du RDV', valeur: '12/11/2026' },
      { libelle: 'Heure du RDV', valeur: '14h30' },
    ])).toEqual({ date: '2026-11-12', heure: '14:30', champ: 'Date du RDV + Heure du RDV' });
    expect(rdvDepuisChamps([{ libelle: 'Rendez-vous', valeur: 'Centre Essai' }, { libelle: 'Date du 1er RDV', valeur: '12/11/2026 14:30' }, { libelle: 'Date du 2e RDV', valeur: '20/11/2026 10:00' }]))
      .toEqual({ date: '2026-11-12', heure: '14:30', champ: 'Date du 1er RDV' });
    expect(rdvDepuisChamps([{ libelle: 'Date du RDV', valeur: '12/11/2026' }])).toEqual({ date: '2026-11-12', heure: '', champ: 'Date du RDV' });
    expect(rdvDepuisChamps([{ libelle: 'A rappeler (date/heure)', valeur: '03/11/2026 10:00' }, { libelle: 'Date du RDV', valeur: '' }])).toBeNull();
  });
});

test.describe('Formes masculin / féminin', () => {
  test('chaque forme proposée donne le bon mot pour M. et pour Mme', () => {
    for (const f of FORMES_GENRE) {
      const texte = f.exemple?.texte ?? f.snippet;
      expect(resolveGenre(texte, 'M'), texte).toBe(f.exemple?.masculin ?? f.masculin);
      expect(resolveGenre(texte, 'F'), texte).toBe(f.exemple?.feminin ?? f.feminin);
    }
  });

  test('majuscule du modèle gardée, apostrophe typographique comprise ; sans genre, rien ne bouge', () => {
    const t = 'Il(elle) vous attend. S’il(elle) le souhaite, Le(la) patient(e) viendra. Un(une) Cher(ère) ami(e).';
    expect(resolveGenre(t, 'M')).toBe('Il vous attend. S’il le souhaite, Le patient viendra. Un Cher ami.');
    expect(resolveGenre(t, 'F')).toBe('Elle vous attend. Si elle le souhaite, La patiente viendra. Une Chère amie.');
    expect(resolveGenre("s'il(elle)", 'M')).toBe("s'il");
    expect(resolveGenre(t, null)).toBe(t);
  });
});

/** Fausse page Salesforce : des champs en lecture (libellé + valeur), dont une fiche cachée de la console. */
async function fausseFiche(page: Page, html: string) {
  await page.goto('/content/salesforce/context.ts');
  await page.evaluate((html) => { document.documentElement.innerHTML = `<head></head><body>${html}</body>`; }, html);
}
const champ = (libelle: string, valeur: string) =>
  `<div class="slds-form-element"><span class="slds-form-element__label">${libelle}</span><div class="slds-form-element__control"><span>${valeur}</span><button>Modifier ${libelle}</button></div></div>`;
const lireRdv = (page: Page) => page.evaluate(async () => {
  const m = await import('/content/salesforce/context.ts' as string) as { readFiche: (p: boolean) => Promise<{ rdv?: unknown }> };
  return (await m.readFiche(false)).rdv;
});

test.describe('Rendez-vous lu par le script de page', () => {
  test('champ du rendez-vous affiché : date et heure ; la fiche cachée de la console et le rappel ne comptent pas', async ({ page }) => {
    await fausseFiche(page, `<div style="display:none">${champ('Date du rendez-vous', '01/01/2027 08:00')}</div>`
      + champ('A rappeler (date/heure)', '03/11/2026 10:00') + champ('Statut du RDV', 'Confirmé') + champ('Date du rendez-vous', '12/11/2026 14:30'));
    expect(await lireRdv(page)).toEqual(RDV);
  });

  test('aucun champ du rendez-vous : rien (la date et l’heure restent à saisir)', async ({ page }) => {
    await fausseFiche(page, champ('A rappeler (date/heure)', '03/11/2026 10:00') + champ('Date de création', '20/10/2026 09:00'));
    expect(await lireRdv(page)).toBeNull();
  });
});

/** Texte copié, fins de ligne de Windows ramenées à « \n ». */
const texteCopie = async (p: Panneau) => (await p.presse()).replace(/\r\n/g, '\n');

/** Opportunité dont la fiche porte un rendez-vous (le faux navigateur la lit en passant sur son onglet). */
async function oppAvecRdv(page: Page, rdv: unknown = RDV) {
  const p = await ouvrir(page, { onglet: ONGLET.piste });
  await expect(page.getByText('Alice Essai').first()).toBeVisible();
  await page.evaluate((rdv) => { const m = (window as any).__mock; m.FICHES[12].rdv = rdv; m.activer(12); }, rdv);
  await expect(page.getByText('Bernard Test').first()).toBeVisible();
  await aller(page, 'Mails');
  return p;
}

test.describe('Mails : variables de l’éditeur et remplissage', () => {
  test('date et heure lues sur la fiche ouverte, « depuis la fiche » ; une saisie à la main passe devant', async ({ page }) => {
    const p = await oppAvecRdv(page);
    await page.getByRole('button', { name: /Confirmation de RDV/ }).click();
    await expect(page.getByLabel('Date du RDV')).toHaveValue('2026-11-12');
    await expect(page.getByLabel('Heure du RDV')).toHaveValue('14:30');
    await expect(page.getByTitle('Lu dans « Date du rendez-vous »')).toHaveCount(2);
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await toast(page, 'Message copié');
    expect(await texteCopie(p)).toBe('Votre rendez-vous du 12 novembre 2026\nBonjour Monsieur Bernard Test,\nVotre rendez-vous est confirmé le 12 novembre 2026 à 14h30.\nBien à vous,\nBenjamin Test');

    await page.getByLabel('Date du RDV').fill('2026-12-01');
    await expect(page.getByTitle('Lu dans « Date du rendez-vous »')).toHaveCount(1);
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await expect.poll(() => p.presse()).toContain('confirmé le 1 décembre 2026 à 14h30.');
    expect(p.erreurs).toEqual([]);
  });

  test('sélecteur complet : chaque groupe, chaque variable insérée d’un clic, puis remplie et accordée (M. puis Mme)', async ({ page }) => {
    const p = await oppAvecRdv(page);
    await page.getByRole('button', { name: 'Nouveau modèle' }).click();
    await page.getByPlaceholder('Ex. Confirmation de rendez-vous').fill('Toutes les variables');

    const groupes = GROUPES_VARIABLES.map((g) => g.titre);
    expect(groupes).toEqual(['Patient', 'Date et heure du rendez-vous', 'Partenaire', 'Conseiller (toi)', 'Masculin / féminin (selon M. ou Mme du patient)']);
    const objet = page.getByPlaceholder('Objet du mail');
    await objet.click();
    await objet.pressSequentially('RDV du ');
    await page.getByRole('group', { name: 'Date et heure du rendez-vous', exact: true }).getByRole('button', { name: 'Date du RDV', exact: true }).click();
    await expect(objet).toHaveValue('RDV du {{date}}');

    const corps = page.locator('textarea').first();
    await corps.click();
    let attendu = '';
    for (const g of GROUPES_VARIABLES) {
      const groupe = page.getByRole('group', { name: g.titre, exact: true });
      await expect(groupe.getByRole('button')).toHaveText(g.variables.map((v) => v.label));
      for (const v of g.variables) {
        // Terminaison : à coller juste après un mot.
        const avant = FORMES_GENRE.find((f) => f.snippet === v.snippet)?.exemple?.texte.slice(0, -v.snippet.length) ?? '';
        if (avant) await page.keyboard.type(avant);
        const bouton = groupe.getByRole('button', { name: v.label, exact: true });
        await expect(bouton).toHaveAttribute('title', v.aide);
        await bouton.click();
        attendu += `${avant}${v.snippet}`;
        await expect(corps).toHaveValue(attendu);
        await expect(corps).toBeFocused();
        await page.keyboard.type(' ');
        attendu += ' ';
      }
    }
    await page.getByRole('button', { name: /Enregistrer le modèle/ }).click();
    await toast(page, 'Modèle enregistré');

    await expect(page.getByLabel('Date du RDV')).toHaveValue('2026-11-12');
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await toast(page, 'Message copié');
    const commun = 'Bernard Test 12 novembre 2026 14h30 Audition Test Marseille \n7 rue de l’Essai\n13002 Marseille\n Benjamin Test 06 00 00 00 00 benjamin@test.fr Conseiller audibene ';
    expect(await texteCopie(p)).toBe(`RDV du 12 novembre 2026\nMonsieur ${commun}il s'il le un du au cet patient cher premier conseiller intéressé dernier muet `);

    await page.getByRole('button', { name: 'Mme', exact: true }).click();
    await page.getByRole('button', { name: 'Copier (objet + texte)' }).click();
    await expect.poll(() => texteCopie(p)).toBe(`RDV du 12 novembre 2026\nMadame ${commun}elle si elle la une de la à la cette patiente chère première conseillère intéressée dernière muette `);
    expect(p.erreurs).toEqual([]);
  });
});
