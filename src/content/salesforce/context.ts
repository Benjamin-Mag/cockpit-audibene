import type { Fiche, Genre, SfContext, SfPage } from '../../shared/types';
import { type Lieu, lireLieu } from './adresse';
import { deepAll, deepGroup, enSerie, expandSection, revenirSur, sleep, sousOngletActifAvec, textOf, valeurChamp, visibleEl, waitFor } from './dom';

/** Type de fiche d'après l'adresse seule : aucune lecture de la page, appelable aussi souvent qu'on veut. */
function pageParAdresse(url: string): { page: SfPage; recordId: string } | null {
  const m = url.match(/\/lightning\/r\/([A-Za-z0-9_]+)\/([A-Za-z0-9]{15,18})(?:\/|\?|$)/);
  if (!m) return null;
  const obj = m[1].toLowerCase();
  return { page: obj === 'lead' ? 'lead' : obj === 'opportunity' ? 'opportunity' : 'other', recordId: m[2] };
}

export function pageInfo(): { page: SfPage; recordId: string } {
  const parAdresse = pageParAdresse(location.href);
  if (parAdresse) return parAdresse;
  // URL non standard : le bandeau d'actions a un onglet "Lead" seulement sur une Piste (lecture de toute la page : coûteuse).
  if (visibleEl(deepAll('[title="Lead"]'))) return { page: 'lead', recordId: 'dom' };
  return { page: 'other', recordId: '' };
}

/**
 * Contexte poussé au panneau toutes les 0,8 s : il doit rester quasi gratuit. Salesforce Console garde
 * en mémoire toutes les fiches ouvertes dans la journée ; parcourir toute la page à chaque fois figeait
 * Salesforce, de plus en plus au fil des onglets. Seule l'adresse est lue ; la lecture de la page
 * (adresse non standard) n'est tentée qu'au changement d'adresse, puis deux fois le temps qu'elle s'affiche.
 */
let memo: { url: string; depuis: number; essais: number; info: { page: SfPage; recordId: string } } | null = null;
const RELECTURES_MS = [2000, 6000];

export function currentContext(): SfContext {
  const url = location.href;
  const parAdresse = pageParAdresse(url);
  if (parAdresse) {
    memo = null;
    return { ...parAdresse, url };
  }
  const maintenant = Date.now();
  if (!memo || memo.url !== url) {
    memo = { url, depuis: maintenant, essais: 0, info: pageInfo() };
  } else if (memo.essais < RELECTURES_MS.length && maintenant - memo.depuis >= RELECTURES_MS[memo.essais]) {
    memo.essais++;
    memo.info = pageInfo();
  }
  return { ...memo.info, url };
}

function splitNomEtGenre(nomComplet: string): { genre: Genre; prenom: string; nom: string } {
  let txt = (nomComplet || '').trim();
  let genre: Genre = null;
  let m = txt.match(/^(Mme|Madame|Mlle|Mademoiselle)\.?\s+(.*)$/i);
  if (m) { genre = 'F'; txt = m[2]; }
  else {
    m = txt.match(/^(M|Monsieur)\.?\s+(.*)$/i);
    if (m) { genre = 'M'; txt = m[2]; }
  }
  const parts = txt.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { genre, prenom: txt, nom: '' };
  return { genre, prenom: parts[0], nom: parts.slice(1).join(' ') };
}

const normaliserTelephone = (tel: string) => tel.replace(/\s+/g, '').replace(/^\+33/, '0');

/**
 * Tout ce que la lecture d'une fiche cherche dans la page, ramassé en UN SEUL parcours :
 * libellés de champs, titre de la fiche, colonnes de numéros, lien du partenaire.
 */
const SELECTEURS = ['.slds-form-element__label', 'lightning-formatted-text[slot="primaryField"]', '.c_numberColor', 'a[href*="/lightning/r/Account/"]'];

interface Lecture {
  labels: Element[];
  titres: Element[];
  numeros: Element[];
  comptes: HTMLAnchorElement[];
}

function lirePage(): Lecture {
  const [labels, titres, numeros, comptes] = deepGroup(SELECTEURS);
  return { labels, titres, numeros, comptes: comptes as HTMLAnchorElement[] };
}

const titreFiche = (lu: Lecture) => {
  const el = visibleEl(lu.titres);
  return el ? textOf(el) : '';
};

/** Sur une Opportunité, le nom du patient est dans le titre, suivi du code postal. */
function nomDepuisTitre(lu: Lecture): string {
  const full = titreFiche(lu);
  const m = full.match(/^(.*?)\s+\d{5}/);
  return m ? m[1].trim() : full;
}

/**
 * Rue, code postal et ville : champ « Adresse » de la Piste (« 12 rue … / 33510 ANDERNOS LES BAINS / Région / France »),
 * sinon code postal et ville du titre de l'Opportunité (« Nom 69110 STE FOY LES LYON - 2026/09 », sans rue).
 */
function codePostalEtVille(lu: Lecture): Lieu {
  const titre = lireLieu(titreFiche(lu));
  return lireLieu(valeurChamp(lu.labels, 'Adresse') ?? '') ?? (titre ? { ...titre, rue: '' } : { rue: '', codePostal: '', ville: '' });
}

function telephoneDepuisOpportunite(lu: Lecture): string {
  const cols = lu.numeros;
  const pick =
    visibleEl(cols.filter((c) => /num[ée]ro mobile du client/i.test(c.textContent || ''))) ||
    visibleEl(cols.filter((c) => /num[ée]ro fixe du client/i.test(c.textContent || '')));
  const m = pick ? (pick.textContent || '').match(/(\+?\d[\d\s]{6,})\s*$/) : null;
  return m ? m[1].trim() : '';
}

/** Partenaire (lien Account) + adresse d'expédition lue dans le panneau de survol SF. */
async function partenaireEtAdresse(lu: Lecture): Promise<{ partenaire: string; adresse: string }> {
  const partLink = visibleEl(lu.comptes);
  if (!partLink) return { partenaire: '', adresse: '' };
  const partenaire = textOf(partLink);

  const rect = partLink.getBoundingClientRect();
  const opts = { bubbles: true, composed: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  partLink.dispatchEvent(new PointerEvent('pointerover', opts));
  partLink.dispatchEvent(new MouseEvent('mouseover', opts));
  partLink.dispatchEvent(new MouseEvent('mouseenter', opts));
  let panelText = '';
  for (let a = 0; a < 8; a++) {
    await sleep(250);
    const panel = document.querySelector('.forceHoverPanel[aria-hidden="false"]') || document.querySelector('[class*="forceHoverPanel"]:not([aria-hidden="true"])');
    if (panel) { panelText = textOf(panel); break; }
  }
  partLink.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, composed: true }));
  partLink.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, composed: true }));

  let adresse = '';
  if (panelText) {
    const lines = panelText.split('\n').map((s) => s.trim()).filter(Boolean);
    const expIdx = lines.findIndex((l) => /exp[eé]dition|shipping/i.test(l));
    if (expIdx >= 0) {
      const al: string[] = [];
      for (let k = expIdx + 1; k < lines.length && al.length < 3; k++) {
        if (/\d{5}/.test(lines[k]) || (al.length > 0 && lines[k].length > 2)) { al.push(lines[k]); if (/\d{5}/.test(lines[k])) break; }
        else if (al.length === 0) al.push(lines[k]);
        else break;
      }
      adresse = al.join(',\n');
    }
    if (!adresse) {
      const cpIdx = lines.findIndex((l) => /\d{5}/.test(l));
      if (cpIdx >= 0) {
        const pts: string[] = [];
        if (cpIdx > 0 && lines[cpIdx - 1].length > 2) pts.push(lines[cpIdx - 1]);
        pts.push(lines[cpIdx]);
        adresse = pts.join(',\n');
      }
    }
  }
  return { partenaire, adresse };
}

/** Sous-onglet de la fiche qui porte les champs patient (les autres, dont Partner Search, ne les rendent pas). */
const SOUS_ONGLET_CHAMPS = /^(Anamnèse|Anamnese|Détails|Details)$/i;

/** Rien de lisible sur ce sous-onglet ? On passe sur celui des champs, et on remettra l'utilisateur où il était. */
function bascule(lu: Lecture): { cible: HTMLElement; precedent: string | null } | null {
  if (valeurChamp(lu.labels, 'Nom complet') !== null || valeurChamp(lu.labels, 'Adresse') !== null) return null;
  const cible = visibleEl(deepAll<HTMLElement>('[role="tab"]').filter((t) => SOUS_ONGLET_CHAMPS.test(textOf(t))));
  if (!cible || cible.getAttribute('aria-selected') === 'true') return null;
  return { cible, precedent: sousOngletActifAvec(cible) };
}

export const readFiche = (withPartner: boolean): Promise<Fiche> => enSerie(() => lireFiche(withPartner));

async function lireFiche(withPartner: boolean): Promise<Fiche> {
  const { page, recordId } = pageInfo();
  let lu = lirePage();
  // Sur « Partner Search », les champs du patient ne sont pas dans la page : aller les chercher.
  const retour = bascule(lu);
  if (retour) {
    retour.cible.click();
    await waitFor(() => { lu = lirePage(); return valeurChamp(lu.labels, 'Nom complet') !== null || valeurChamp(lu.labels, 'Adresse') !== null; }, 5000, 200);
  }
  let email = valeurChamp(lu.labels, 'Adresse e-mail');
  let naissance = valeurChamp(lu.labels, 'Date de naissance');
  if (email === null || naissance === null) {
    // Rubrique repliée : on ne relit la page qu'après l'avoir dépliée.
    if (expandSection('Coordonnées client')) {
      await sleep(400);
      lu = lirePage();
      email = valeurChamp(lu.labels, 'Adresse e-mail');
      naissance = valeurChamp(lu.labels, 'Date de naissance');
    }
  }
  const nomComplet = valeurChamp(lu.labels, 'Nom complet');
  const telMobile = valeurChamp(lu.labels, 'Téléphone mobile');
  const telFixe = valeurChamp(lu.labels, 'Téléphone');
  let telephone = normaliserTelephone(telMobile || telFixe || '');
  let np = splitNomEtGenre(nomComplet || '');
  if (!np.prenom && !np.nom) np = splitNomEtGenre(nomDepuisTitre(lu));
  if (!telephone) telephone = normaliserTelephone(telephoneDepuisOpportunite(lu));

  let pa: { partenaire: string; adresse: string };
  if (withPartner) pa = await partenaireEtAdresse(lu);
  else {
    const link = visibleEl(lu.comptes);
    pa = { partenaire: link ? textOf(link) : '', adresse: '' };
  }

  // Tout doit être lu AVANT de rendre l'utilisateur à son sous-onglet : les champs redeviennent invisibles.
  const lieu = codePostalEtVille(lu);
  if (retour) await revenirSur(retour.precedent);

  return {
    page,
    recordId,
    genre: np.genre,
    prenom: np.prenom,
    nom: np.nom,
    email: email || '',
    naissance: naissance || '',
    telephone,
    ...lieu,
    partenaire: pa.partenaire,
    adresse: pa.adresse,
  };
}
