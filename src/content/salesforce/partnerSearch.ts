// Lecture de l'onglet « Partner Search » d'une Piste : les partenaires proposés par Salesforce,
// avec le « Commentaire Partnersearch » et les liens de prise de rendez-vous de chaque partenaire.
// Tout se fait au clic du panneau (jamais en boucle) ; les recherches sont limitées au tableau une fois trouvé.
import type { PartenaireSF } from '../../shared/types';
import { deepAll, sleep, textOf, visibleEl, waitFor } from './dom';

export interface LecturePartnerSearch {
  ok: boolean;
  msg: string;
  partenaires: PartenaireSF[];
}

const RUBRIQUES = /\n\s*(?:Processus ORL|Fabricants proposés par partenaire|Fourchette de prix|Réseaux mutuelles)\b/;

/** Le tableau des partenaires, repéré par son en-tête « Durée du parcours » (un seul parcours de la page). */
function tablePartenaires(): HTMLTableElement | null {
  const th = visibleEl(deepAll<HTMLElement>('th').filter((t) => /^Durée du parcours$/i.test(textOf(t))));
  return (th?.closest('table') as HTMLTableElement | null) ?? null;
}

/** Lignes des partenaires (les lignes de détails dépliés n'ont pas de bouton « Détails »). */
const lignesPartenaires = (table: HTMLTableElement) =>
  Array.from(table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr')).filter((tr) => tr.querySelector('button[title="Détails"]'));

const estLigneDetail = (tr: Element | null): tr is HTMLTableRowElement => !!tr && tr.tagName === 'TR' && !tr.querySelector('button[title="Détails"]');

const nettoyerUrl = (u: string) => u.replace(/[)\].,;:!?»"'’]+$/, '');

function lireDetail(detail: HTMLElement): { commentaire: string; liens: string[] } {
  const texte = detail.innerText || '';
  const apres = texte.split(/Commentaire Partnersearch/)[1] ?? '';
  const commentaire = apres.split(RUBRIQUES)[0].trim();
  const liens = new Set<string>();
  detail.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => { if (/^https?:/i.test(a.href)) liens.add(nettoyerUrl(a.href)); });
  (texte.match(/https?:\/\/[^\s<>"]+/g) ?? []).forEach((u) => liens.add(nettoyerUrl(u)));
  return { commentaire, liens: Array.from(liens) };
}

function lireLigne(tr: HTMLTableRowElement): Omit<PartenaireSF, 'commentaire' | 'liens'> {
  const cellules = Array.from(tr.cells);
  const celluleNom = cellules.find((c) => c.querySelector('[title]') && / - /.test(c.querySelector('[title]')?.getAttribute('title') ?? '')) ?? cellules[2];
  const titres = Array.from(celluleNom?.querySelectorAll('[title]') ?? []).map((e) => e.getAttribute('title') ?? '').filter(Boolean);
  const nom = titres.find((t) => / - /.test(t)) ?? titres[0] ?? '';
  const lignesTexte = (celluleNom?.innerText ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const adresse = lignesTexte.find((l) => l !== nom && /\d/.test(l) && /,/.test(l)) ?? '';
  const texteDe = (re: RegExp) => cellules.map((c) => textOf(c)).find((t) => re.test(t)) ?? '';
  return {
    nom,
    adresse,
    distance: texteDe(/^\d+(?:[.,]\d+)?\s*km$/i),
    duree: texteDe(/^\d+\s*min/i),
    pastilles: titres.filter((t) => t !== nom),
  };
}

export async function lirePartnerSearch(): Promise<LecturePartnerSearch> {
  let table = tablePartenaires();
  let ongletPrecedent: HTMLElement | null = null;
  if (!table) {
    const onglet = visibleEl(deepAll<HTMLElement>('[role="tab"]').filter((t) => textOf(t) === 'Partner Search'));
    if (!onglet) return { ok: false, msg: 'Onglet « Partner Search » introuvable sur cette fiche (ouvre une Piste).', partenaires: [] };
    ongletPrecedent = Array.from(onglet.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]') ?? [])[0] ?? null;
    onglet.click();
    table = await waitFor(tablePartenaires, 8000, 300);
  }
  if (!table) return { ok: false, msg: 'Partner Search ne s\'est pas affiché.', partenaires: [] };
  const t = table;
  // Les résultats arrivent un peu après le tableau.
  await waitFor(() => lignesPartenaires(t).length > 0, 6000, 250);

  const partenaires: PartenaireSF[] = [];
  for (const tr of lignesPartenaires(t)) {
    const base = lireLigne(tr);
    const bouton = tr.querySelector<HTMLButtonElement>('button[title="Détails"]');
    const dejaOuvert = estLigneDetail(tr.nextElementSibling);
    let detail: HTMLTableRowElement | null = dejaOuvert ? (tr.nextElementSibling as HTMLTableRowElement) : null;
    if (!dejaOuvert && bouton) {
      bouton.click();
      detail = await waitFor(() => (estLigneDetail(tr.nextElementSibling) ? tr.nextElementSibling : null), 3000, 100);
    }
    const lu = detail ? lireDetail(detail) : { commentaire: '', liens: [] };
    // On referme ce qu'on a ouvert : la page reste comme l'utilisateur l'avait laissée.
    if (!dejaOuvert && detail && bouton) {
      bouton.click();
      await sleep(120);
    }
    partenaires.push({ ...base, ...lu });
  }
  if (ongletPrecedent && ongletPrecedent.getAttribute('aria-selected') !== 'true') ongletPrecedent.click();
  return { ok: true, msg: `${partenaires.length} partenaire(s) lu(s) dans Partner Search`, partenaires };
}
