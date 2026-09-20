// Tri et filtres rapides de l'ORL Finder : tout se fait sur les résultats déjà chargés,
// sans aucun appel à Doctolib.
import { type Creneau, type FicheOrl, type Orl, trierOrl } from './doctolib';
import type { TriOrl } from './orl-store';

export type { TriOrl };
export const TRIS: { id: TriOrl; label: string }[] = [{ id: 'pertinence', label: 'Pertinence' }, { id: 'tot', label: 'Plus tôt' }, { id: 'proche', label: 'Plus proche' }];
export const TRI_TITRE: Record<TriOrl, string> = {
  pertinence: 'Par pertinence : créneau disponible d\'abord, secteur 1 avant secteur 2',
  tot: 'Du créneau le plus tôt au plus tard, puis les ORL à appeler',
  proche: 'Du plus proche au plus loin',
};

export interface FiltresRapides { creneau: boolean; audiometrie: boolean; nouveaux: boolean }
export type FiltreId = keyof FiltresRapides;
export const AUCUN_FILTRE: FiltresRapides = { creneau: false, audiometrie: false, nouveaux: false };
export const FILTRES: { id: FiltreId; label: string; titre: string }[] = [
  { id: 'creneau', label: 'Avec créneau en ligne', titre: 'Seulement les ORL qui ont un rendez-vous visible sur Doctolib' },
  { id: 'audiometrie', label: 'Audiométrie indiquée', titre: 'Seulement les ORL dont la fiche Doctolib mentionne l\'audiométrie' },
  { id: 'nouveaux', label: 'Nouveaux patients acceptés', titre: 'Seulement les ORL qui indiquent accepter les nouveaux patients' },
];

interface L { orl: Orl; creneau: Creneau | null; fiche?: FicheOrl | null }

const TESTS: Record<FiltreId, (l: L) => boolean> = {
  creneau: (l) => !!l.creneau?.next,
  audiometrie: (l) => !!l.fiche?.audiometrie,
  nouveaux: (l) => l.orl.nouveauxPatients === true,
};

/** Doctolib ne dit pas toujours si les nouveaux patients sont acceptés : la puce n'a de sens que si l'information existe. */
export const infoNouveauxPatients = (list: L[]) => list.some((l) => l.orl.nouveauxPatients !== null && l.orl.nouveauxPatients !== undefined);

const parDistance = (a: L, b: L) => a.orl.distanceKm - b.orl.distanceKm;

export function trierPar<T extends L>(list: T[], tri: TriOrl): T[] {
  if (tri === 'pertinence') return trierOrl(list);
  if (tri === 'proche') return [...list].sort((a, b) => parDistance(a, b) || (a.creneau?.next ?? '9999').localeCompare(b.creneau?.next ?? '9999'));
  return [...list].sort((a, b) => {
    const da = a.creneau?.next ?? '';
    const db = b.creneau?.next ?? '';
    if (!!da !== !!db) return da ? -1 : 1;
    if (da !== db) return da < db ? -1 : 1;
    return parDistance(a, b);
  });
}

/** Minuscules sans accents, pour chercher « begles » et trouver « Bègles ». */
export const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function correspond(l: L, recherche: string): boolean {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const texte = normaliser(`${l.orl.nom} ${l.orl.ville} ${l.orl.codePostal}`);
  return mots.every((m) => texte.includes(m));
}

export const filtreActif = (f: FiltresRapides, recherche: string) => f.creneau || f.audiometrie || f.nouveaux || !!recherche.trim();

export function filtrer<T extends L>(list: T[], filtres: FiltresRapides, recherche: string): T[] {
  const actifs = FILTRES.filter((f) => filtres[f.id]);
  return list.filter((l) => correspond(l, recherche) && actifs.every((f) => TESTS[f.id](l)));
}

/** Pour chaque puce : le nombre d'ORL qui resteraient, puce allumée, avec les autres filtres en cours. */
export function compter(list: L[], filtres: FiltresRapides, recherche: string): Record<FiltreId, number> {
  const n = (id: FiltreId) => filtrer(list, { ...filtres, [id]: true }, recherche).length;
  return { creneau: n('creneau'), audiometrie: n('audiometrie'), nouveaux: n('nouveaux') };
}
