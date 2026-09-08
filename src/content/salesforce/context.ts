import type { Fiche, Genre, SfContext, SfPage } from '../../shared/types';
import { deepAll, expandSection, fieldValue, sleep, textOf, visibleEl } from './dom';

export function pageInfo(): { page: SfPage; recordId: string } {
  const m = location.href.match(/\/lightning\/r\/([A-Za-z0-9_]+)\/([A-Za-z0-9]{15,18})(?:\/|\?|$)/);
  if (m) {
    const obj = m[1].toLowerCase();
    return { page: obj === 'lead' ? 'lead' : obj === 'opportunity' ? 'opportunity' : 'other', recordId: m[2] };
  }
  // URL non standard : le bandeau d'actions a un onglet "Lead" seulement sur une Piste.
  if (visibleEl(deepAll('[title="Lead"]'))) return { page: 'lead', recordId: 'dom' };
  return { page: 'other', recordId: '' };
}

export function isComposerOpen(): boolean {
  return !!visibleEl(deepAll('.ql-editor'));
}

export function currentContext(): SfContext {
  return { ...pageInfo(), composerOpen: isComposerOpen(), url: location.href };
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

/** Sur une Opportunité, le nom du patient est dans le titre, suivi du code postal. */
function nomDepuisTitre(): string {
  const el = visibleEl(deepAll('lightning-formatted-text[slot="primaryField"]'));
  const full = el ? textOf(el) : '';
  const m = full.match(/^(.*?)\s+\d{5}/);
  return m ? m[1].trim() : full;
}

function telephoneDepuisOpportunite(): string {
  const cols = deepAll('.c_numberColor');
  const pick =
    visibleEl(cols.filter((c) => /num[ée]ro mobile du client/i.test(c.textContent || ''))) ||
    visibleEl(cols.filter((c) => /num[ée]ro fixe du client/i.test(c.textContent || '')));
  const m = pick ? (pick.textContent || '').match(/(\+?\d[\d\s]{6,})\s*$/) : null;
  return m ? m[1].trim() : '';
}

/** Partenaire (lien Account) + adresse d'expédition lue dans le panneau de survol SF. */
async function partenaireEtAdresse(): Promise<{ partenaire: string; adresse: string }> {
  const partLink = visibleEl(deepAll<HTMLAnchorElement>('a[href*="/lightning/r/Account/"]'));
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

export async function readFiche(withPartner: boolean): Promise<Fiche> {
  const { page, recordId } = pageInfo();
  let email = fieldValue('Adresse e-mail');
  let naissance = fieldValue('Date de naissance');
  if (email === null || naissance === null) {
    if (expandSection('Coordonnées client')) {
      await sleep(400);
      email = fieldValue('Adresse e-mail');
      naissance = fieldValue('Date de naissance');
    }
  }
  const nomComplet = fieldValue('Nom complet');
  const telMobile = fieldValue('Téléphone mobile');
  const telFixe = fieldValue('Téléphone');
  let telephone = normaliserTelephone(telMobile || telFixe || '');
  let np = splitNomEtGenre(nomComplet || '');
  if (!np.prenom && !np.nom) np = splitNomEtGenre(nomDepuisTitre());
  if (!telephone) telephone = normaliserTelephone(telephoneDepuisOpportunite());

  let pa: { partenaire: string; adresse: string };
  if (withPartner) pa = await partenaireEtAdresse();
  else {
    const link = visibleEl(deepAll('a[href*="/lightning/r/Account/"]'));
    pa = { partenaire: link ? textOf(link) : '', adresse: '' };
  }

  return {
    page,
    recordId,
    genre: np.genre,
    prenom: np.prenom,
    nom: np.nom,
    email: email || '',
    naissance: naissance || '',
    telephone,
    partenaire: pa.partenaire,
    adresse: pa.adresse,
  };
}
