import type { Genre } from '../shared/types';

export interface Template {
  id: string;
  title: string;
  audience: 'patient' | 'partenaire';
  type: 'email' | 'sms';
  patientCategory?: string;
  partnerCategory?: string;
  subject?: string;
  body: string;
  smsCompanion?: string;
  createdAt?: number;
}

export interface Situation { id: string; label: string }
export interface Categorie { id: string; label: string }

export interface Reglages {
  nom: string;
  telephone: string;
  email: string;
  genre: 'M' | 'F';
  mvComment: string;
  /** Après « Écrire dans la fiche », cliquer Enregistrer automatiquement. */
  autoSaveComment: boolean;
  emailFooter: string;
  sigPatientMail: string;
  sigPatientSMS: string;
  sigPartenaireMail: string;
}

export interface Vente { name: string; cat: 1 | 2; url?: string }
export interface Payslip {
  onglet?: string; ficheMonth: string; brut: number; primes: number; cotisations: number; indemnites: number;
  autresRetenues: number; prelevementSource: number; netAvantImpot: number; netApayer: number; netSocial: number; includeInAverage: boolean;
}
export interface VentesData {
  settings: { primeCat1: number; primeCat2: number; salaireBase: number; indemnites: number; cotFallback: number; pasFallback: number; retenuesFallback: number; tauxImposition: number };
  payslips: Payslip[];
  sales: Record<string, Vente[]>;
}

export interface ChatTexte { id: string; label: string; text: string }

export interface AppData {
  version: 2;
  onboardingDone: boolean;
  /** Horodatage du dernier enregistrement (sert à départager copie locale et dossier). */
  updatedAt?: number;
  reglages: Reglages;
  anamnese: {
    situations: Situation[];
    /** id de situation → texte du commentaire, avec {{resume}} à l'endroit du résumé Salesforce */
    textes: Record<string, string>;
    /** valeur de Situation 1/2 (ex. "Musique") → micro-phrases enregistrées */
    phrases: Record<string, string[]>;
  };
  /** Textes à coller dans le « Chat Partenaire » d'une Opportunité. */
  chatPartenaire: ChatTexte[];
  templates: Template[];
  /** Liste complète (modifiable) des catégories ; `seeded` = les catégories de base ont été ajoutées une fois. */
  categories: { patient: Categorie[]; partenaire: Categorie[]; seeded?: boolean };
  ventes: VentesData;
}

export const RESUME_TAG = '{{resume}}';

export const DEFAULT_SITUATIONS: Situation[] = [
  { id: 'depistage_simple', label: 'Dépistage' },
  { id: 'depistage_orl', label: 'Dépistage avec ORL' },
  { id: 'premier_rdv', label: '1er RDV' },
  { id: 'renouvellement_avec_ordonnance', label: 'Renouvellement – Avec ordonnance' },
  { id: 'renouvellement_sans_ordonnance', label: 'Renouvellement – Sans ordonnance' },
];

const SIGN = `\n\n${RESUME_TAG}\n\nJe vous souhaite une excellente consultation.\nBien à vous,\n{{nom_conseiller}}\n{{tel_conseiller}}`;
export const DEFAULT_TEXTES: Record<string, string> = {
  depistage_simple: 'Cher partenaire, je vous confie notre patient(e) pour un dépistage auditif.' + SIGN,
  depistage_orl: "Cher partenaire, je vous confie notre patient(e) pour un dépistage auditif, avec orientation vers un ORL de votre réseau. Je vous remercie par avance pour votre prise en charge." + SIGN,
  premier_rdv: "Cher partenaire, je vous confie notre patient(e) muni(e) d'une ordonnance ORL pour un premier rendez-vous." + SIGN,
  renouvellement_avec_ordonnance: "Cher partenaire, je vous confie notre patient(e) pour un renouvellement d'appareillage avec ordonnance de renouvellement." + SIGN,
  renouvellement_sans_ordonnance: "Cher partenaire, je vous confie notre patient(e) pour un renouvellement d'appareillage." + SIGN,
};

export const DEFAULT_FOOTER =
  "_________________________________________________\n\nAudibene - Pour bien entendre\nTour la Marseillaise\n2bis Bd Euromediterranée Quai d'Arenc, 13002 Marseille\n\nAudibene GmbH\n820 709 046 R.C.S. Marseille\nSiège de la société : Berlin\nGérants : Paul Crusius, Dr. Marco Vietor, Marco Wiesmann";

export const CATEGORIES_PATIENT: Categorie[] = [{ id: 'Reconfirmation', label: 'Reconfirmation' }, { id: 'CC1', label: 'CC1' }, { id: 'CC2', label: 'CC2' }, { id: 'CC3', label: 'CC3' }, { id: 'CC4', label: 'CC4' }];
export const CATEGORIES_PARTENAIRE: Categorie[] = [{ id: 'CC1', label: 'CC1' }, { id: 'CC2', label: 'CC2' }, { id: 'CC3', label: 'CC3' }, { id: 'CC4', label: 'CC4' }];

export function defaultData(): AppData {
  return {
    version: 2,
    onboardingDone: false,
    reglages: { nom: '', telephone: '', email: '', genre: 'M', mvComment: 'MV', autoSaveComment: true, emailFooter: DEFAULT_FOOTER, sigPatientMail: '', sigPatientSMS: '', sigPartenaireMail: '' },
    anamnese: { situations: DEFAULT_SITUATIONS.map((s) => ({ ...s })), textes: { ...DEFAULT_TEXTES }, phrases: {} },
    chatPartenaire: [{ id: 'chat-merci', label: 'Merci', text: 'Bonjour,\nMerci pour cette mise à jour.\nAu plaisir de vous lire,\n{{nom_conseiller}}' }],
    templates: [],
    categories: { patient: CATEGORIES_PATIENT.map((c) => ({ ...c })), partenaire: CATEGORIES_PARTENAIRE.map((c) => ({ ...c })), seeded: true },
    ventes: {
      settings: { primeCat1: 40, primeCat2: 80, salaireBase: 0, indemnites: 0, cotFallback: 0.21, pasFallback: 0.099, retenuesFallback: 0, tauxImposition: 9.9 },
      payslips: [],
      sales: {},
    },
  };
}

export function systemValues(r: Reglages): Record<string, string> {
  return {
    nom_conseiller: r.nom,
    tel_conseiller: r.telephone,
    email_conseiller: r.email,
    titre_conseiller: (r.genre === 'F' ? 'Conseillère' : 'Conseiller') + ' audibene',
  };
}

const echapperRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const permutations = <T>(l: T[]): T[][] =>
  l.length <= 1 ? [l] : l.flatMap((x, i) => permutations([...l.slice(0, i), ...l.slice(i + 1)]).map((p) => [x, ...p]));

/**
 * Le nom des Réglages, dans n'importe quel ordre de ses mots (2 ou 3 mots), casse et espaces libres,
 * en mot entier seulement (\b ignore les accents) : ni « Jean-Pierre » pour « Pierre », ni une adresse mail.
 */
function motifNom(nom: string): RegExp | null {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if ((nom.match(/\p{L}/gu) ?? []).length < 3) return null;
  const ordres = mots.length === 2 || mots.length === 3 ? permutations(mots) : [mots];
  const variantes = ordres.map((o) => o.map(echapperRegex).join('[^\\S\\r\\n]+'));
  return new RegExp(`(?<![\\p{L}\\p{N}_@-])(?<![\\p{L}\\p{N}]\\.)(?:${variantes.join('|')})(?![\\p{L}\\p{N}_@-])(?!\\.[\\p{L}\\p{N}])`, 'giu');
}

/**
 * Le téléphone des Réglages par ses seuls chiffres (emoji, espaces, points… ignorés), écrit avec n'importe quels
 * séparateurs (espaces, points, tirets) ; « 06… » se reconnaît aussi en « +33 6… » et inversement.
 * Ce qui entoure le numéro dans les Réglages (« 📞 ») est repris s'il est aussi dans la signature, pour ne pas le doubler.
 * Jamais au milieu d'un nombre plus long (chiffres collés avant ou après).
 */
function motifTel(tel: string): RegExp | null {
  const brut = tel.trim();
  const chiffres = brut.replace(/\D/g, '');
  if (chiffres.length < 6) return null;
  const SEP = '(?:[^\\S\\r\\n]|[.-])*';
  const suite = (c: string) => [...c].join(SEP);
  const formes = [`(?:\\+${SEP})?${suite(chiffres)}`];
  if (chiffres.startsWith('0')) formes.push(`\\+${SEP}33${SEP}(?:\\(0\\)${SEP})?${suite(chiffres.slice(1))}`);
  else if (chiffres.startsWith('33') && brut.includes('+')) formes.push(suite('0' + chiffres.slice(2)));
  const prefixe = brut.slice(0, brut.search(/[\d+]/)).trim();
  const suffixe = brut.slice(brut.search(/\d\D*$/) + 1).trim();
  const avant = prefixe ? `(?:${echapperRegex(prefixe)}[^\\S\\r\\n]*)?` : '';
  const apres = suffixe ? `(?:[^\\S\\r\\n]*${echapperRegex(suffixe)})?` : '';
  return new RegExp(`(?<![\\d+])${avant}(?<![\\d+])(?:${formes.join('|')})(?!\\d)${apres}`, 'g');
}

/**
 * Signatures des Réglages : le nom et le téléphone écrits en dur (souvent repris de l'ancien générateur)
 * deviennent {{nom_conseiller}} et {{tel_conseiller}}, pour que les modèles signent du nom de chacun.
 * Les variables déjà présentes ({{…}}) ne sont jamais touchées.
 */
function variabilisateur(r: Reglages): ((t: string) => string) | null {
  const motifs: [RegExp, string][] = [];
  const nom = motifNom(r.nom ?? '');
  const tel = motifTel(r.telephone ?? '');
  if (nom) motifs.push([nom, '{{nom_conseiller}}']);
  if (tel) motifs.push([tel, '{{tel_conseiller}}']);
  if (!motifs.length) return null;
  return (t: string) => t.split(/(\{\{[^{}]*\}\})/).map((morceau, i) =>
    i % 2 ? morceau : motifs.reduce((acc, [motif, variable]) => acc.replace(motif, variable), morceau)).join('');
}

export function variabiliserSignatures(r: Reglages): Reglages {
  const varier = variabilisateur(r);
  if (!varier) return r;
  return { ...r, sigPatientMail: varier(r.sigPatientMail ?? ''), sigPartenaireMail: varier(r.sigPartenaireMail ?? ''), sigPatientSMS: varier(r.sigPatientSMS ?? '') };
}

/**
 * Même conversion pour les modèles de mail/SMS et les textes du Chat partenaire : un modèle partagé
 * signe ainsi du nom de chaque collègue. Le rendu ne change pas pour soi : la variable vaut le même nom.
 */
export function variabiliserTextes(d: AppData): AppData {
  const varier = variabilisateur(d.reglages);
  if (!varier) return d;
  d.templates = d.templates.map((t) => ({
    ...t,
    body: varier(t.body ?? ''),
    ...(t.subject !== undefined ? { subject: varier(t.subject) } : {}),
    ...(t.smsCompanion !== undefined ? { smsCompanion: varier(t.smsCompanion) } : {}),
  }));
  d.chatPartenaire = d.chatPartenaire.map((c) => ({ ...c, text: varier(c.text ?? '') }));
  return d;
}

/** Remplace {{variable}} par sa valeur ; laisse la balise si la valeur est vide. */
export function fillVars(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, n: string) => {
    const v = values[n.trim()];
    return v && v.trim() ? v : m;
  });
}

/** Résout les formes "patient(e)", "il(elle)", "du(de la)"… selon le genre. */
export function resolveGenre(text: string, genre: Genre): string {
  if (!genre) return text;
  const f = genre === 'F';
  return text
    .replace(/s'il\(elle\)/gi, f ? 'si elle' : "s'il")
    .replace(/\bdu\(de la\)/gi, f ? 'de la' : 'du')
    .replace(/\bau\(à la\)/gi, f ? 'à la' : 'au')
    .replace(/\ble\(la\)/gi, f ? 'la' : 'le')
    .replace(/\bun\(une\)/gi, f ? 'une' : 'un')
    .replace(/il\(elle\)/gi, f ? 'elle' : 'il')
    .replace(/(\S+?)er\(ère\)/g, (_m, w: string) => (f ? w + 'ère' : w + 'er'))
    .replace(/(\S+?)\(te\)/g, (_m, w: string) => (f ? w + 'te' : w))
    .replace(/(\S+?)\(e\)/g, (_m, w: string) => (f ? w + 'e' : w));
}

/** Ajoute {{tel_conseiller}} sous le nom si le texte signe avec {{nom_conseiller}} sans téléphone. */
export function ensurePhoneUnderName(text: string): string {
  if (!text.includes('{{nom_conseiller}}') || text.includes('{{tel_conseiller}}')) return text;
  const idx = text.lastIndexOf('{{nom_conseiller}}');
  return text.slice(0, idx) + '{{nom_conseiller}}\n{{tel_conseiller}}' + text.slice(idx + '{{nom_conseiller}}'.length);
}

/** Texte final du commentaire : variables, genre, résumé inséré (ou balise retirée), variables vides retirées. */
export function composeComment(raw: string, resume: string, r: Reglages, genre: Genre): string {
  let t = resolveGenre(fillVars(raw, systemValues(r)), genre);
  const clean = resume.trim();
  if (clean) t = t.replace(RESUME_TAG, clean);
  else t = t.replace(new RegExp(`\\n*${RESUME_TAG.replace(/[{}]/g, '\\$&')}\\n*`), '\n\n');
  t = t.split('\n').filter((line) => !/^\s*\{\{[^}]+\}\}\s*$/.test(line)).join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** Ajoute une fois les catégories de base devant les catégories personnalisées. */
export function seedCategories(c: AppData['categories']): AppData['categories'] {
  if (c.seeded) return c;
  const merge = (base: Categorie[], extra: Categorie[]) => [...base.map((x) => ({ ...x })), ...extra.filter((e) => !base.some((b) => b.id === e.id))];
  return { patient: merge(CATEGORIES_PATIENT, c.patient ?? []), partenaire: merge(CATEGORIES_PARTENAIRE, c.partenaire ?? []), seeded: true };
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
