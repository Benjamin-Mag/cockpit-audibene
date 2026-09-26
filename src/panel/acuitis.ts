// Créneaux des magasins Acuitis. Leur prise de rendez-vous passe par rdv.acuitis.com, qui expose
// la liste des créneaux libres d'un magasin ; le motif ne change que la durée du rendez-vous.
// Appels exécutés dans un onglet du site, comme pour Doctolib (voir fetchViaTab).
import { fetchViaTab, isExtension } from './bridge';
import type { JourCreneaux } from './doctolib';

const BASE = 'https://rdv.acuitis.com';
const ONGLET = 'https://rdv.acuitis.com/*';
/** Fenêtre de recherche : au-delà, les créneaux n'intéressent plus personne. */
const JOURS = 60;

/** Motifs audition proposés par Acuitis ; seule la durée change dans la demande. */
export const MOTIFS_ACUITIS: { nom: string; duree: number }[] = [
  { nom: 'Bilan auditif', duree: 30 },
  { nom: '1er rendez-vous', duree: 60 },
];

/** Code du magasin dans un lien Acuitis : « ?store=CODE » ou « /v3/acuitis/CODE_ACUITIS ». */
export function magasinAcuitis(url: string): string | null {
  if (!/^https?:\/\/[^/]*acuitis\.com\//i.test(url)) return null;
  try {
    const u = new URL(url);
    const parStore = u.searchParams.get('store');
    if (parStore) return parStore.trim().toUpperCase();
    const m = u.pathname.match(/\/v3\/[^/]+\/([A-Za-z0-9_-]+?)(?:_ACUITIS)?\/?$/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Page de prise de rendez-vous d'un magasin, à ouvrir dans un onglet. */
export const lienRdvAcuitis = (code: string) => `${BASE}/v3/acuitis/${encodeURIComponent(code)}_ACUITIS?store=${encodeURIComponent(code)}`;

const jour = (iso: string) => new Date(iso).toLocaleDateString('sv-SE');

/** Créneaux audition du jour le plus proche pour un magasin et une durée de rendez-vous. */
export async function creneauxAcuitis(code: string, duree: number): Promise<JourCreneaux> {
  const debut = new Date();
  const fin = new Date(debut.getTime() + JOURS * 86400000);
  const q = new URLSearchParams({
    entity: 'acuitis_fr',
    duration: String(duree),
    qualification: 'AUDIOLOGY',
    start_date: jour(debut.toISOString()),
    end_date: jour(fin.toISOString()),
  });
  const chemin = `/api/timeslots/list/${encodeURIComponent(code)}?${q.toString()}`;
  let corps: string;
  if (isExtension) {
    const r = await fetchViaTab(ONGLET, lienRdvAcuitis(code), `${BASE}${chemin}`, { headers: { Accept: 'application/json' } });
    if (r.status === 0) throw new Error(`Acuitis injoignable (${r.body || 'pas de réponse'}).`);
    if (r.status < 200 || r.status >= 300) throw new Error(`Acuitis a répondu ${r.status}.`);
    corps = r.body;
  } else {
    corps = await (await fetch(`${BASE}${chemin}`)).text();
  }
  let json: { availableTimeSlots?: { date?: string }[]; errorMessage?: string | null };
  try {
    json = JSON.parse(corps) as typeof json;
  } catch {
    throw new Error('Réponse Acuitis illisible.');
  }
  if (json.errorMessage) throw new Error(json.errorMessage);
  const tous = (json.availableTimeSlots ?? []).map((s) => s.date ?? '').filter(Boolean).sort();
  if (!tous.length) return { date: '', creneaux: [], total: 0, raison: 'Aucun créneau en ligne' };
  const premierJour = jour(tous[0]);
  const creneaux = tous.filter((d) => jour(d) === premierJour);
  return { date: tous[0], creneaux, total: tous.length, raison: '' };
}
