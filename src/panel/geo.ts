import { type Partenaire, isActif } from './partenaires';

// Table code postal → [latitude, longitude], générée par scripts/codes-postaux.mjs
// (Base officielle des codes postaux, La Poste). Fichier local de l'extension :
// aucun appel réseau, chargé seulement quand l'onglet Partenaires en a besoin.
export interface GeoTable {
  date: string;
  cp: Record<string, [number, number]>;
}

let tablePromise: Promise<GeoTable | null> | null = null;

export function loadGeo(): Promise<GeoTable | null> {
  tablePromise ??= (async () => {
    try {
      const res = await fetch('data/codes-postaux.json');
      if (!res.ok) return null;
      const json = (await res.json()) as { _source?: { date?: string }; cp?: GeoTable['cp'] };
      if (!json.cp) return null;
      return { date: json._source?.date ?? '', cp: json.cp };
    } catch {
      return null;
    }
  })();
  return tablePromise;
}

export type Origine = { coords: [number, number]; mode: 'exact' | 'departement' };

/** Coordonnées d'un code postal ; à défaut, centre du département (2 premiers chiffres, 3 pour les DOM). */
export function localiser(cp: string, table: GeoTable): Origine | null {
  const clean = cp.trim();
  if (!/^\d{5}$/.test(clean)) return null;
  const exact = table.cp[clean];
  if (exact) return { coords: exact, mode: 'exact' };
  const prefix = clean.startsWith('97') || clean.startsWith('98') ? clean.slice(0, 3) : clean.slice(0, 2);
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (const [k, v] of Object.entries(table.cp)) if (k.startsWith(prefix)) { lat += v[0]; lon += v[1]; n++; }
  return n ? { coords: [lat / n, lon / n], mode: 'departement' } : null;
}

/** Distance à vol d'oiseau, en km. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Proche { p: Partenaire; km: number }

/** Les `n` partenaires les plus proches d'un point ; ceux sans code postal connu sont comptés à part. */
export function plusProches(origine: [number, number], partenaires: Partenaire[], table: GeoTable, n: number, inclureInactifs: boolean): { items: Proche[]; ignores: number } {
  const items: Proche[] = [];
  let ignores = 0;
  for (const p of partenaires) {
    if (!inclureInactifs && !isActif(p)) continue;
    const c = table.cp[p.codePostal];
    if (!c) { ignores++; continue; }
    items.push({ p, km: haversineKm(origine, c) });
  }
  items.sort((x, y) => x.km - y.km);
  return { items: items.slice(0, n), ignores };
}

export const kmLabel = (km: number) => (km < 1 ? '< 1 km' : `${Math.round(km)} km`);
