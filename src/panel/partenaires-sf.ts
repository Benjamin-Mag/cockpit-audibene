// Page « Partenaires » : les partenaires de l'onglet Partner Search de la Piste, avec leurs
// créneaux Doctolib quand ils ont une page publique. Cache 10 min par fiche dans le
// navigateur seul (chrome.storage.local, repli localStorage), jamais dans cockpit.json.
import type { PartenaireSF } from '../shared/types';
import { type JourCreneaux, type MotifDoctolib, PAUSE_MS, creneauxMotif, motifsDoctolib } from './doctolib';

/** Sorte de lien de prise de rendez-vous trouvée dans les détails Partner Search. */
export type Lien =
  | { sorte: 'public'; url: string; slug: string }
  | { sorte: 'pro'; url: string }
  | { sorte: 'autre'; url: string }
  | { sorte: 'aucun' };

const PUBLIC = /^https?:\/\/(?:www\.)?doctolib\.fr\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)/i;

/** Le meilleur lien d'un partenaire : page Doctolib publique, sinon agenda Doctolib Pro, sinon autre site. */
export function classerLien(liens: string[]): Lien {
  const urls = liens.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
  for (const url of urls) {
    const m = url.match(PUBLIC);
    if (m && !/^(search|online_booking|patient)/i.test(m[1])) return { sorte: 'public', url, slug: decodeURIComponent(m[3]) };
  }
  const pro = urls.find((u) => /^https?:\/\/pro\.doctolib\.fr\//i.test(u));
  if (pro) return { sorte: 'pro', url: pro };
  const autre = urls.find((u) => !/doctolib\.fr/i.test(u));
  if (autre) return { sorte: 'autre', url: autre };
  return urls[0] ? { sorte: 'autre', url: urls[0] } : { sorte: 'aucun' };
}

/** Motifs à montrer, dans l'ordre : test / bilan auditif, puis première consultation avec puis sans ordonnance. */
const PRIORITES: RegExp[] = [/\b(test|bilan)\s+auditif/i, /premi[eè]re\s+consultation.*avec\s+ordonnance/i, /premi[eè]re\s+consultation.*sans\s+ordonnance/i, /premi[eè]re\s+consultation/i];
export const MAX_MOTIFS = 3;

export function choisirMotifs(motifs: MotifDoctolib[]): MotifDoctolib[] {
  const choisis: MotifDoctolib[] = [];
  for (const re of PRIORITES) {
    const m = motifs.find((x) => re.test(x.nom) && !choisis.includes(x));
    if (m) choisis.push(m);
    if (choisis.length >= MAX_MOTIFS) break;
  }
  return choisis;
}

export interface MotifCreneaux { motif: MotifDoctolib; jour: JourCreneaux | null; erreur?: string }
export interface LignePartenaire {
  partenaire: PartenaireSF;
  lien: Lien;
  /** Rang dans Partner Search (départage des partenaires sans créneau). */
  rang: number;
  /** Motifs et créneaux lus (page publique seulement) ; undefined = pas encore lu ; null = lecture impossible. */
  motifs?: MotifCreneaux[] | null;
  erreur?: string;
}

/** Premier créneau, tous motifs confondus. */
export const premierCreneau = (l: LignePartenaire): string => (l.motifs ?? []).flatMap((m) => m.jour?.creneaux ?? []).sort()[0] ?? '';

/** Partenaires avec un créneau Doctolib d'abord (le plus tôt en tête), puis les autres dans l'ordre de Partner Search. */
export function trierPartenaires(list: LignePartenaire[]): LignePartenaire[] {
  return [...list].sort((a, b) => {
    const ca = premierCreneau(a);
    const cb = premierCreneau(b);
    if (!!ca !== !!cb) return ca ? -1 : 1;
    if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
    return a.rang - b.rang;
  });
}

/** Lit les motifs puis les créneaux d'une page Doctolib publique, un appel à la fois. */
export async function lireCreneaux(slug: string, alive: () => boolean, onMotif?: (partiel: MotifCreneaux[]) => void): Promise<MotifCreneaux[]> {
  const motifs = choisirMotifs(await motifsDoctolib(slug));
  const out: MotifCreneaux[] = motifs.map((motif) => ({ motif, jour: null }));
  for (let i = 0; i < out.length; i++) {
    if (!alive()) break;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
    try { out[i] = { ...out[i], jour: await creneauxMotif(out[i].motif) }; } catch (e) { out[i] = { ...out[i], erreur: (e as Error).message }; }
    onMotif?.([...out]);
  }
  return out;
}

// ---------------------------------------------------------------- cache navigateur
export interface CachePartenaires { at: number; lignes: LignePartenaire[]; msg?: string }
const CACHE_KEY = 'partnerSearchCache';
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

export async function loadCache(ficheKey: string): Promise<CachePartenaires | null> {
  const all = (await get<Record<string, CachePartenaires>>(CACHE_KEY)) ?? {};
  const c = all[ficheKey];
  return c && Array.isArray(c.lignes) && Date.now() - c.at < CACHE_MS ? c : null;
}

export async function saveCache(ficheKey: string, c: CachePartenaires): Promise<void> {
  const all = (await get<Record<string, CachePartenaires>>(CACHE_KEY)) ?? {};
  const now = Date.now();
  for (const [k, v] of Object.entries(all)) if (!v || now - v.at >= CACHE_MS) delete all[k];
  all[ficheKey] = c;
  const keys = Object.keys(all).sort((a, b) => all[a].at - all[b].at);
  while (keys.length > CACHE_MAX) delete all[keys.shift()!];
  await set(CACHE_KEY, all);
}
