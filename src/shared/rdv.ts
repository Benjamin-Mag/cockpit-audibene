/**
 * Date et heure du rendez-vous lues sur la fiche ouverte, pour {{date}} et {{heure}} des modèles de mail.
 * Le champ est reconnu par son libellé (« Date du rendez-vous », « Date et heure du RDV », « 1er RDV »,
 * « Appointment date »…), jamais par un nom technique : on ne connaît pas encore celui de la vraie org.
 * Écartés : le rappel de la Piste (« A rappeler (date/heure) »), la date à laquelle le RDV a été pris ou créé,
 * son statut, sa confirmation… Même règle dans Cockpit Plein Écran (src/plein/rdv-fiche.ts). Pur.
 */

export interface RdvLu {
  /** « AAAA-MM-JJ » */
  date: string;
  /** « HH:MM », vide si la fiche ne donne pas l'heure. */
  heure: string;
  /** Libellé du champ d'où vient la date (et celui de l'heure s'il est à part). */
  champ: string;
}

export interface ChampLu { libelle: string; valeur: string }

const plat = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const RDV = /(^|[^a-z0-9])(rendez[- ]?vous|rdv|appointments?|termin)([^a-z0-9]|$)/;
const ECARTES = /rappel|statut|status|confirm|venu|annul|cancel|nombre|number|delai|time to|duree|type|lieu|location|adresse|commentaire|comment|motif|raison|reason|cree|creat|modifi|pris|prise|lien|url|source|canal|proprietaire|owner/;
const HEURE = /heure|horaire|time/;

/** Ce libellé désigne-t-il la date ou l'heure du rendez-vous ? */
export const estChampRdv = (libelle: string) => {
  const l = plat(libelle);
  return RDV.test(l) && !ECARTES.test(l);
};

const pad = (n: number) => String(n).padStart(2, '0');

function isoValide(a: number, m: number, j: number): string {
  const d = new Date(Date.UTC(a, m - 1, j));
  return a >= 1900 && a <= 2200 && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? `${a}-${pad(m)}-${pad(j)}` : '';
}

/** « 14:30 », « 14h30 », « 2:30 PM » → « 14:30 » ; vide sinon. */
function heureDans(t: string): string {
  const h = /(\d{1,2})\s*[:h]\s*(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/i.exec(t);
  if (!h) return '';
  let hh = Number(h[1]);
  const mm = Number(h[2]);
  if (h[3]) {
    const pm = /p/i.test(h[3]);
    if (hh < 1 || hh > 12) return '';
    hh = (hh % 12) + (pm ? 12 : 0);
  }
  return hh < 24 && mm < 60 ? `${pad(hh)}:${pad(mm)}` : '';
}

/** « 12/11/2026 14:30 », « 12/11/2026, 14h30 », « 2026-11-12 » → date et heure ; null sans date reconnue. */
export function dateHeureDepuisTexte(texte: string): { date: string; heure: string } | null {
  const t = texte.trim();
  let m = /(?<!\d)(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?!\d)/.exec(t);
  let date = m ? isoValide(Number(m[3]), Number(m[2]), Number(m[1])) : '';
  if (!m) {
    m = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(t);
    date = m ? isoValide(Number(m[1]), Number(m[2]), Number(m[3])) : '';
  }
  if (!m || !date) return null;
  return { date, heure: heureDans(t.slice(m.index + m[0].length)) };
}

/** Champ « heure » seul (« Heure du RDV » : « 14:30 ») → « 14:30 » ; vide sinon. */
export const heureDepuisTexte = (texte: string) => (/^\s*\d{1,2}\s*[:h]\s*\d{2}/.test(texte) ? heureDans(texte) : '');

/**
 * Le rendez-vous d'après les champs de la fiche, dans l'ordre de la page : le premier champ du rendez-vous qui donne
 * une date ; son heure, sinon celle d'un champ « heure » du rendez-vous (« Heure du RDV »). Null si aucun.
 */
export function rdvDepuisChamps(champs: ChampLu[]): RdvLu | null {
  const candidats = champs.filter((c) => c.valeur.trim() && estChampRdv(c.libelle));
  for (const c of candidats) {
    const dh = dateHeureDepuisTexte(c.valeur);
    if (!dh) continue;
    if (dh.heure) return { ...dh, champ: c.libelle };
    const h = candidats.filter((x) => x !== c && HEURE.test(plat(x.libelle))).map((x) => ({ x, h: heureDepuisTexte(x.valeur) })).find((x) => x.h);
    return { date: dh.date, heure: h?.h ?? '', champ: h ? `${c.libelle} + ${h.x.libelle}` : c.libelle };
  }
  return null;
}
