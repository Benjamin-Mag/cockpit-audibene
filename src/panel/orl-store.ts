// Réglages et cache de l'ORL Finder : navigateur seul (chrome.storage.local, repli
// localStorage en mode web), jamais dans cockpit.json ni dans le partage.
import type { Creneau, FicheOrl, Orl } from './doctolib';

export type DelaiFiltre = 1 | 3 | 7 | 14 | 0;
export type SecteurFiltre = 'tous' | 's1' | 's12';
export interface OrlPrefs { delai: DelaiFiltre; secteur: SecteurFiltre }
export const DEFAULT_PREFS: OrlPrefs = { delai: 14, secteur: 'tous' };

export interface LigneCache { orl: Orl; creneau: Creneau | null; fiche: FicheOrl | null | undefined; ficheErreur?: string }
export interface Resultat { at: number; rayonKm: number; lignes: LigneCache[] }

const PREFS_KEY = 'orlFinderPrefs';
const CACHE_KEY = 'orlFinderCache';
/** Durée de validité d'une recherche (code postal + filtres). */
export const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 12;

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage;

async function get<T>(key: string): Promise<T | null> {
  try {
    if (isExtension) return ((await chrome.storage.local.get(key))[key] as T) ?? null;
    return JSON.parse(localStorage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    if (isExtension) await chrome.storage.local.set({ [key]: value });
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* stockage indisponible : on continue sans mémoire */ }
}

export async function loadPrefs(): Promise<OrlPrefs> {
  const p = await get<Partial<OrlPrefs>>(PREFS_KEY);
  const delai = [0, 1, 3, 7, 14].includes(p?.delai as number) ? (p!.delai as DelaiFiltre) : DEFAULT_PREFS.delai;
  const secteur = p?.secteur === 's1' || p?.secteur === 's12' || p?.secteur === 'tous' ? p.secteur : DEFAULT_PREFS.secteur;
  return { delai, secteur };
}

export const savePrefs = (p: OrlPrefs) => set(PREFS_KEY, p);

export const cacheKey = (cp: string, p: OrlPrefs) => `${cp}|${p.delai}|${p.secteur}`;

export async function loadResultat(key: string): Promise<Resultat | null> {
  const all = (await get<Record<string, Resultat>>(CACHE_KEY)) ?? {};
  const r = all[key];
  return r && Array.isArray(r.lignes) && Date.now() - r.at < CACHE_MS ? r : null;
}

export async function saveResultat(key: string, r: Resultat): Promise<void> {
  const all = (await get<Record<string, Resultat>>(CACHE_KEY)) ?? {};
  const now = Date.now();
  for (const [k, v] of Object.entries(all)) if (!v || now - v.at >= CACHE_MS) delete all[k];
  all[key] = r;
  const keys = Object.keys(all).sort((a, b) => all[a].at - all[b].at);
  while (keys.length > CACHE_MAX) delete all[keys.shift()!];
  await set(CACHE_KEY, all);
}
