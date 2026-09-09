import type { Partenaire, PartenairesData } from './model';

// Rapport Salesforce « FRA Partenaires Actifs », lu avec le jeton de session du
// navigateur (Benjamin est connecté à Salesforce dans un onglet). C'est, avec la
// carte Google, la seule exception à la règle « pas d'appel réseau ».
const SF_HOST = 'https://betterhearing.my.salesforce.com';
const API_VERSION = 'v62.0';
export const REPORT_ID = '00O3V000000rs59UAA';
export const REPORT_URL = `https://betterhearing.lightning.force.com/lightning/r/Report/${REPORT_ID}/view`;
/** Salesforce limite à 500 exécutions de rapport par heure : on ne relit qu'une fois par jour, ou sur demande. */
export const CACHE_MS = 24 * 3600 * 1000;

export const isStale = (p: PartenairesData) => Date.now() - p.fetchedAt > CACHE_MS;
export const canFetch = typeof chrome !== 'undefined' && !!chrome.cookies && !!chrome.runtime?.id;

interface ReportJson {
  reportMetadata?: { detailColumns?: string[] };
  reportExtendedMetadata?: { detailColumnInfo?: Record<string, { label?: string }> };
  factMap?: Record<string, { rows?: { dataCells?: { label?: unknown; value?: unknown }[] }[] }>;
}

async function sessionId(): Promise<string | null> {
  const cookie = await chrome.cookies.get({ url: SF_HOST, name: 'sid' });
  return cookie?.value ?? null;
}

async function fetchReport(sid: string): Promise<ReportJson> {
  const res = await fetch(`${SF_HOST}/services/data/${API_VERSION}/analytics/reports/${REPORT_ID}?includeDetails=true`, { headers: { Authorization: `Bearer ${sid}` } });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { errorCode?: string; message?: string }[];
      if (Array.isArray(body) && body[0]) detail = body[0].errorCode === 'REQUEST_LIMIT_EXCEEDED' ? 'quota Salesforce atteint, réessaie plus tard' : `${body[0].errorCode ?? ''} ${body[0].message ?? ''}`.trim();
    } catch { /* pas de corps JSON */ }
    if (res.status === 401) throw new Error('Session Salesforce expirée — reconnecte-toi dans l\'onglet Salesforce, puis réessaie.');
    throw new Error(`Salesforce a répondu ${res.status}${detail ? ` (${detail})` : ''}.`);
  }
  return (await res.json()) as ReportJson;
}

const cellText = (cell: { label?: unknown; value?: unknown } | undefined): string => {
  if (!cell) return '';
  const clean = (s: unknown) => (typeof s === 'string' && s.trim() !== '-' ? s.trim() : '');
  return clean(cell.label) || clean(cell.value);
};

/** Adresse composée Salesforce : objet (street/postalCode/city) ou texte sur plusieurs lignes. */
function parseAdresse(cell: { label?: unknown; value?: unknown } | undefined): { adresse: string; codePostal: string; ville: string } {
  const v = cell?.value;
  if (v && typeof v === 'object') {
    const o = v as { street?: string; postalCode?: string; city?: string };
    if (o.street || o.postalCode || o.city) return { adresse: (o.street ?? '').replace(/\s*\n\s*/g, ', ').trim(), codePostal: (o.postalCode ?? '').trim(), ville: (o.city ?? '').trim() };
  }
  const lines = cellText(cell).split(/\s*\n\s*|,\s+(?=\d{5}\s)/).map((s) => s.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => /^\d{5}\s+\S/.test(l));
  if (idx === -1) return { adresse: lines.join(', '), codePostal: '', ville: '' };
  const m = lines[idx].match(/^(\d{5})\s+(.+)$/)!;
  // Après la ville peuvent suivre la région et le pays (« Gap, Provence-Alpes-Côte d'Azur France ») : on ne garde que la ville.
  return { adresse: lines.slice(0, idx).join(', '), codePostal: m[1], ville: m[2].split(',')[0].replace(/\s+France$/i, '').trim() };
}

/** Transforme la réponse du rapport en liste de partenaires (colonnes repérées par libellé, pas par position). */
export function parsePartenaires(json: ReportJson): Partenaire[] {
  const cols = json.reportMetadata?.detailColumns ?? [];
  const info = json.reportExtendedMetadata?.detailColumnInfo ?? {};
  const col = (re: RegExp) => cols.findIndex((c) => re.test((info[c]?.label ?? c).toLowerCase()));
  const iId = col(/^id du compte|account id/);
  const iNom = col(/^nom du compte|account name/);
  const iPrincipal = col(/compte principal|parent account/);
  const iCp = col(/code postal de facturation|billing.*(zip|postal)/);
  const iStatut = col(/^statut|^status/);
  const iEmail = col(/e-?mail/);
  const iAdresse = col(/point of sale address/);
  if (iNom === -1) throw new Error('Colonne « Nom du compte » introuvable dans le rapport.');

  const seen = new Set<string>();
  const out: Partenaire[] = [];
  for (const entry of Object.values(json.factMap ?? {})) {
    for (const row of entry.rows ?? []) {
      const cells = row.dataCells ?? [];
      const nom = cellText(cells[iNom]);
      if (!nom) continue;
      const id = (iId >= 0 ? cellText(cells[iId]) : '') || nom;
      if (seen.has(id)) continue;
      seen.add(id);
      const a = parseAdresse(iAdresse >= 0 ? cells[iAdresse] : undefined);
      const cpFact = iCp >= 0 ? cellText(cells[iCp]).match(/\d{5}/)?.[0] ?? '' : '';
      out.push({
        id,
        nom,
        comptePrincipal: iPrincipal >= 0 ? cellText(cells[iPrincipal]) : '',
        adresse: a.adresse,
        codePostal: a.codePostal || cpFact,
        ville: a.ville,
        statut: iStatut >= 0 ? cellText(cells[iStatut]) : '',
        email: iEmail >= 0 ? cellText(cells[iEmail]) : '',
      });
    }
  }
  out.sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
  return out;
}

let inflight: Promise<PartenairesData> | null = null;

/** Relit le rapport (une seule lecture à la fois, même si plusieurs vues le demandent). */
export async function loadPartenaires(): Promise<PartenairesData> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!canFetch) throw new Error('Lecture du rapport disponible seulement dans l\'extension.');
    const sid = await sessionId();
    if (!sid) throw new Error('Pas de session Salesforce — ouvre Salesforce dans un onglet et connecte-toi, puis réessaie.');
    const items = parsePartenaires(await fetchReport(sid));
    if (!items.length) throw new Error('Le rapport ne contient aucune ligne.');
    return { fetchedAt: Date.now(), items };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export const isActif = (p: Partenaire) => /^actif$/i.test(p.statut.trim());

/** « il y a 5 min », « hier à 10:18 », « le 3 sept. à 09:02 ». */
export function fetchedLabel(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const d = new Date(t);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (m < 24 * 60 && d.getDate() === new Date().getDate()) return `aujourd'hui à ${heure}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${heure}`;
}
