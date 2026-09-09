// Recherche d'ORL sur Doctolib depuis le panneau (host permission doctolib.fr déjà
// présente). Appels vérifiés par le chef d'orchestre le 2026-09-09 ; c'est, avec
// l'itinéraire Google Maps (ouvert seulement au clic), une exception assumée à la
// règle « pas d'appel réseau » : rien du patient n'est envoyé, seulement un point GPS.
import { type ProxyResponse, fetchViaTab, isExtension } from './bridge';

const BASE = 'https://www.doctolib.fr';
/** Onglets utilisables pour porter les appels (site patient uniquement). */
const ONGLET = 'https://www.doctolib.fr/*';
export const SPECIALITE = 'orl-oto-rhino-laryngologie';
/** Pause entre deux lectures de créneaux : Doctolib n'aime pas les rafales. */
export const PAUSE_MS = 150;

export type Secteur = 'S1' | 'S2' | null;

/** Un praticien à un lieu d'exercice (le même médecin peut avoir plusieurs cabinets). */
export interface Orl {
  /** Clé unique praticien + lieu. */
  key: string;
  nom: string;
  specialite: string;
  adresse: string;
  codePostal: string;
  ville: string;
  lat: number;
  lng: number;
  distanceKm: number;
  secteur: Secteur;
  /** Valeur brute Doctolib (`contracted_1`, `contracted_2`, …) ou null si non renseigné. */
  secteurBrut: string | null;
  /** Page de prise de RDV. */
  lien: string;
  slug: string;
  practiceId: string;
  visitMotiveId: number | null;
  agendaIds: number[];
  motif: string;
  nouveauxPatients: boolean | null;
}

export interface Creneau {
  /** ISO du prochain rendez-vous, ou null. */
  next: string | null;
  /** Explication Doctolib quand il n'y a rien (« Aucune disponibilité en ligne »). */
  raison: string;
}

export interface SearchOptions {
  /** Secteurs Doctolib (CONTRACTED_1, CONTRACTED_2, …) ; vide = tous. */
  secteurs?: string[];
  /** Créneau dans les N jours (1, 3, 7, 14) ; absent = pas de filtre. */
  delaiJours?: number;
  page?: number;
}

interface RawProvider {
  title?: string;
  firstName?: string;
  name?: string;
  speciality?: { name?: string };
  location?: { address?: string; zipcode?: string; city?: string; lat?: number; lng?: number; distanceInMeters?: number };
  regulationSector?: string | null;
  link?: string;
  references?: { practiceId?: string | number; id?: string | number; profileId?: string | number };
  matchedVisitMotive?: { visitMotiveId?: number; agendaIds?: number[]; name?: string; allowNewPatients?: boolean } | null;
  onlineBooking?: { agendaIds?: number[] } | null;
}

interface CallInit { method?: string; headers?: Record<string, string>; body?: string }

/** Depuis l'extension, l'appel part de l'onglet Doctolib (voir fetchViaTab) ; en mode web, appel direct. */
async function transport(path: string, init: CallInit): Promise<ProxyResponse> {
  if (isExtension) return fetchViaTab(ONGLET, `${BASE}/`, `${BASE}${path}`, init);
  const r = await fetch(`${BASE}${path}`, { ...init, credentials: 'include' });
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', body: await r.text() };
}

async function call(path: string, init: CallInit = {}): Promise<{ json: () => Promise<unknown> }> {
  const r = await transport(path, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
  if (r.status === 0) throw new Error(`Doctolib injoignable (${r.body || 'pas de réponse'}).`);
  if (r.status === 403 || r.status === 429 || r.contentType.includes('text/html')) throw new DoctolibRefus(r.status);
  if (r.status < 200 || r.status >= 300) throw new Error(`Doctolib a répondu ${r.status}.`);
  return {
    json: async () => {
      try { return JSON.parse(r.body) as unknown; } catch { throw new Error('Réponse Doctolib illisible.'); }
    },
  };
}

/**
 * Doctolib bloque (vérification anti-robot dans l'onglet, ou trop de demandes) : le panneau
 * propose alors de voir l'onglet Doctolib (pour valider la vérification) ou d'ouvrir la recherche.
 */
export class DoctolibRefus extends Error {
  status: number;
  constructor(status: number) {
    super(status === 429
      ? 'Doctolib demande de ralentir (trop de demandes). Réessaie dans une minute, ou ouvre la recherche sur Doctolib.'
      : "Doctolib bloque la recherche (vérification anti-robot). Ouvre l'onglet Doctolib, valide la vérification si elle s'affiche, puis relance avec ↻.");
    this.name = 'DoctolibRefus';
    this.status = status;
  }
}

/** Met l'onglet Doctolib au premier plan (celui qui porte les appels), ou en ouvre un. */
export async function voirOngletDoctolib(): Promise<void> {
  if (!isExtension) { window.open(`${BASE}/`, '_blank', 'noopener'); return; }
  const [tab] = (await chrome.tabs.query({ url: ONGLET })).filter((t) => t.id !== undefined);
  if (tab?.id !== undefined) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: `${BASE}/`, active: true });
  }
}

/** Secteurs Doctolib selon le filtre choisi (vide = tous). */
export const SECTEURS_S1 = ['CONTRACTED_1', 'CONTRACTED_1_WITH_EXTRA', 'CONTRACTED_1_WITH_OPTAM', 'CONTRACTED_1_WITH_OPTAM_CO'];
export const SECTEURS_S2 = ['CONTRACTED_2', 'CONTRACTED_2_WITH_OPTAM', 'CONTRACTED_2_WITH_OPTAM_CO'];

export function secteurDe(brut: string | null | undefined): Secteur {
  if (!brut) return null;
  if (/^contracted_1/i.test(brut) || /secteur 1/i.test(brut)) return 'S1';
  if (/^contracted_2/i.test(brut) || /secteur 2/i.test(brut) || /^non_contracted/i.test(brut) || /non conventionn/i.test(brut)) return 'S2';
  return null;
}

/** Ordre des groupes : secteur 1 → secteur 2 / OPTAM / non conventionné → non renseigné. */
export const groupeSecteur = (s: Secteur) => (s === 'S1' ? 0 : s === 'S2' ? 1 : 2);

function toOrl(raw: RawProvider): Orl | null {
  const nom = [raw.title, raw.firstName, raw.name].filter(Boolean).join(' ').trim();
  const loc = raw.location ?? {};
  if (!nom || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  const link = raw.link ?? '';
  const practiceId = String(raw.references?.practiceId ?? link.match(/pid=practice-(\d+)/)?.[1] ?? '');
  const slug = link.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  const id = String(raw.references?.id ?? raw.references?.profileId ?? slug);
  const motive = raw.matchedVisitMotive ?? null;
  return {
    key: `${id}@${practiceId}`,
    nom,
    specialite: raw.speciality?.name ?? 'ORL',
    adresse: loc.address ?? '',
    codePostal: loc.zipcode ?? '',
    ville: loc.city ?? '',
    lat: loc.lat,
    lng: loc.lng,
    distanceKm: (loc.distanceInMeters ?? 0) / 1000,
    secteur: secteurDe(raw.regulationSector),
    secteurBrut: raw.regulationSector ?? null,
    lien: link ? `${BASE}${link}` : '',
    slug,
    practiceId,
    visitMotiveId: motive?.visitMotiveId ?? null,
    agendaIds: motive?.agendaIds?.length ? motive.agendaIds : raw.onlineBooking?.agendaIds ?? [],
    motif: motive?.name ?? '',
    nouveauxPatients: motive?.allowNewPatients ?? null,
  };
}

/** Une page de résultats (16 praticiens, déjà triés par distance). */
export async function rechercherOrl(lat: number, lng: number, opts: SearchOptions = {}): Promise<{ total: number; items: Orl[] }> {
  const filters: Record<string, unknown> = {};
  if (opts.secteurs?.length) filters.regulationSector = opts.secteurs;
  if (opts.delaiJours) filters.availabilitiesBefore = opts.delaiJours;
  const body = { keyword: SPECIALITE, location: { gpsPoint: { lat, lng } }, ...(Object.keys(filters).length ? { filters } : {}) };
  const res = await call(`/patient-health-search/api/v1/hcp/search?page=${opts.page ?? 0}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as { total?: number; healthcareProviders?: RawProvider[] };
  const items = (json.healthcareProviders ?? []).map(toOrl).filter((o): o is Orl => !!o);
  return { total: json.total ?? items.length, items };
}

/** ISO local avec décalage horaire (« 2026-09-09T14:47:44+02:00 ») : un « Z » est refusé par Doctolib. */
export function isoLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

/** Prochain créneau d'un praticien à ce lieu (un appel ; à espacer de PAUSE_MS entre praticiens). */
export async function prochainCreneau(o: Orl): Promise<Creneau> {
  if (!o.visitMotiveId || !o.agendaIds.length || !o.practiceId) return { next: null, raison: 'Pas de prise de RDV en ligne' };
  const q = new URLSearchParams({
    telehealth: 'false',
    limit: '5',
    start_date_time: isoLocal(),
    visit_motive_id: String(o.visitMotiveId),
    agenda_ids: o.agendaIds.join(','),
    practice_ids: o.practiceId,
  });
  const res = await call(`/search/availabilities.json?${q.toString()}`);
  const json = (await res.json()) as { next_slot?: string | null; reason?: string | null; availabilities?: { date: string; slots: unknown[] }[] };
  const first = json.availabilities?.find((a) => a.slots?.length);
  const slot = first?.slots?.[0];
  const fromList = typeof slot === 'string' ? slot : slot && typeof slot === 'object' && 'start_date' in slot ? String((slot as { start_date: unknown }).start_date) : null;
  return { next: json.next_slot ?? fromList ?? null, raison: json.reason ?? '' };
}

/** Ce que la fiche publique d'un praticien apporte pour un lieu donné. */
export interface FicheOrl {
  /** Numéro du cabinet à ce lieu ; vide = « pas de téléphone = pas de ligne » (sauf numéro d'un autre cabinet). */
  telephone: string;
  /** Numéro d'un autre cabinet du même médecin, quand ce lieu n'en a pas (affiché avec la mention « autre cabinet »). */
  telephoneAutre: string;
  autreLieu: string;
  adresse: string;
  /** Secteur en clair (« Conventionné secteur 2 avec OPTAM »), vide si absent. */
  secteurClair: string;
  /** Un acte de la fiche contient « audiom ». */
  audiometrie: boolean;
  actes: string[];
}

interface RawProfile {
  data?: {
    places?: { id?: string; landline_number?: string | null; full_address?: string | null; name?: string }[];
    details?: { practice_id?: number | string; regulation_sector?: string | null }[];
    profile?: { skills_by_practice?: Record<string, { name?: string }[]> };
  };
}

/** Fiche praticien pour un lieu (un appel ; à espacer de PAUSE_MS). Ne pas appeler pour tout le monde : seulement les retenus. */
export async function ficheOrl(o: Orl): Promise<FicheOrl> {
  if (!o.slug || !o.practiceId) throw new Error('Fiche introuvable (pas de lien Doctolib).');
  const res = await call(`/profiles/${encodeURIComponent(o.slug)}.json?pid=practice-${encodeURIComponent(o.practiceId)}&locale=fr`);
  const json = (await res.json()) as RawProfile;
  const d = json.data ?? {};
  const place = d.places?.find((p) => p.id === `practice-${o.practiceId}`);
  const detail = d.details?.find((x) => String(x.practice_id) === o.practiceId);
  const actes = (d.profile?.skills_by_practice?.[o.practiceId] ?? []).map((s) => s.name ?? '').filter(Boolean);
  const autre = d.places?.find((p) => p.id !== `practice-${o.practiceId}` && (p.landline_number ?? '').trim());
  return {
    telephone: (place?.landline_number ?? '').trim(),
    telephoneAutre: (autre?.landline_number ?? '').trim(),
    autreLieu: (autre?.name || autre?.full_address || '').trim(),
    adresse: (place?.full_address ?? '').trim(),
    secteurClair: (detail?.regulation_sector ?? '').trim(),
    audiometrie: actes.some((a) => /audiom/i.test(a)),
    actes,
  };
}

/** Libellé court du secteur, depuis la fiche (en clair) ou la recherche (code). */
export function secteurLabel(clair: string, brut: string | null): string {
  const s = clair || brut || '';
  if (!s) return '';
  const optam = /optam/i.test(s) ? ' OPTAM' : '';
  if (/secteur 1|^contracted_1/i.test(s)) return `secteur 1${optam}`;
  if (/secteur 2|^contracted_2/i.test(s)) return `secteur 2${optam}`;
  if (/non conventionn|^non_contracted/i.test(s)) return 'non conventionné';
  return s;
}

export const MESSAGE_TYPE = "Bonjour, je souhaite prendre rendez-vous pour un bilan auditif complet incluant une audiométrie tonale et vocale, dans le cadre d'un projet d'appareillage. Pouvez-vous me confirmer que ce bilan est bien réalisé dans votre cabinet ? Merci.";

/** Recherche Doctolib pré-remplie, pour l'ouvrir dans un onglet. */
export const lienRechercheDoctolib = (codePostal: string) => `${BASE}/search?speciality=${SPECIALITE}&location=${encodeURIComponent(codePostal)}`;

export const lienItineraire = (origine: string, destination: string) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origine)}&destination=${encodeURIComponent(destination)}`;

/** Tri du prompt du collègue : secteur 1 d'abord, puis distance, puis délai. */
export function trierOrl<T extends { orl: Orl; creneau: Creneau | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const g = groupeSecteur(a.orl.secteur) - groupeSecteur(b.orl.secteur);
    if (g) return g;
    const d = a.orl.distanceKm - b.orl.distanceKm;
    if (Math.abs(d) > 0.05) return d;
    const na = a.creneau?.next ?? '9999';
    const nb = b.creneau?.next ?? '9999';
    return na.localeCompare(nb);
  });
}

/** « lun. 4 janv. à 17:00 · dans 12 j ». */
export function creneauLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const jours = Math.max(0, Math.round((d.getTime() - Date.now()) / 86400000));
  const quand = d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${quand} · ${jours === 0 ? "aujourd'hui" : jours === 1 ? 'demain' : `dans ${jours} j`}`;
}
