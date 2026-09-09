import { type AppData, CATEGORIES_PARTENAIRE, CATEGORIES_PATIENT, DEFAULT_SITUATIONS, DEFAULT_TEXTES, type PartenairesData, RESUME_TAG, type Situation, type Template, type Vente, type VentesData, ensurePhoneUnderName, seedCategories } from '../model';
import { canonicalMonthKey } from '../ventes';

/** Regroupe les ventes sous des clés de mois normalisées ("Janvier 26" et "Janvier 2026" fusionnent). */
export function canonicalizeSales(sales: Record<string, Vente[]>): Record<string, Vente[]> {
  const out: Record<string, Vente[]> = {};
  for (const [k, list] of Object.entries(sales)) {
    if (!Array.isArray(list)) continue;
    (out[canonicalMonthKey(k)] ??= []).push(...list);
  }
  return out;
}

export type LegacyKind = 'cockpit' | 'partage' | 'generateur' | 'ventes' | 'inconnu';

export function detectKind(obj: unknown): LegacyKind {
  if (!obj || typeof obj !== 'object') return 'inconnu';
  const o = obj as Record<string, unknown>;
  if (o.share === true) return 'partage';
  if (o.version === 2 && o.reglages) return 'cockpit';
  if (Array.isArray(o.templates) || o.anamnese || typeof o.signatureName === 'string') return 'generateur';
  if (o.sales && o.settings && Array.isArray(o.payslips)) return 'ventes';
  return 'inconnu';
}

/** Ancien texte d'anamnèse (intro + signature) → même texte avec {{resume}} entre les deux. */
function withResumeTag(text: string): string {
  if (text.includes(RESUME_TAG)) return text;
  const idx = text.indexOf('\n\n');
  if (idx === -1) return text + `\n\n${RESUME_TAG}`;
  return text.slice(0, idx) + `\n\n${RESUME_TAG}` + text.slice(idx);
}

interface OldGenerateur {
  templates?: Template[];
  anamnese?: Record<string, { text?: string; intro?: string; conclusion?: string }>;
  customSituations?: Situation[];
  customCategories?: { patient?: { id: string; label: string }[]; partenaire?: { id: string; label: string }[] };
  signatureName?: string;
  phone?: string;
  advisorGenre?: 'M' | 'F';
  emailFooter?: string;
  sigPatientMail?: string;
  sigPatientSMS?: string;
  sigPartenaireMail?: string;
  onboardingDone?: boolean;
}

/** Fusionne un data.json de l'ancien générateur de mails dans les données Cockpit. */
export function mergeGenerateur(data: AppData, raw: unknown): AppData {
  const old = raw as OldGenerateur;
  const out: AppData = structuredClone(data);
  const r = out.reglages;
  if (old.signatureName) r.nom = old.signatureName;
  if (old.phone) r.telephone = old.phone;
  if (old.advisorGenre === 'F' || old.advisorGenre === 'M') r.genre = old.advisorGenre;
  if (old.emailFooter) r.emailFooter = old.emailFooter;
  if (typeof old.sigPatientMail === 'string') r.sigPatientMail = old.sigPatientMail;
  if (typeof old.sigPatientSMS === 'string') r.sigPatientSMS = old.sigPatientSMS;
  if (typeof old.sigPartenaireMail === 'string') r.sigPartenaireMail = old.sigPartenaireMail;

  if (Array.isArray(old.customSituations) && old.customSituations.length) out.anamnese.situations = old.customSituations.map((s) => ({ id: s.id, label: s.label }));
  const nameSubst = (t: string) => (old.signatureName && t.includes(old.signatureName) ? t.split(old.signatureName).join('{{nom_conseiller}}') : t);
  if (old.anamnese) {
    for (const [id, e] of Object.entries(old.anamnese)) {
      const text = typeof e?.text === 'string' ? e.text : [e?.intro, e?.conclusion].filter(Boolean).join('\n\n');
      if (text) out.anamnese.textes[id] = ensurePhoneUnderName(withResumeTag(nameSubst(text)));
    }
  }
  for (const s of out.anamnese.situations) if (!out.anamnese.textes[s.id]) out.anamnese.textes[s.id] = DEFAULT_TEXTES[s.id] ?? `Cher partenaire, je vous confie notre patient(e).\n\n${RESUME_TAG}\n\nBien à vous,\n{{nom_conseiller}}`;

  if (Array.isArray(old.templates)) {
    const ids = new Set(out.templates.map((t) => t.id));
    for (const t of old.templates) {
      if (!t || typeof t.body !== 'string' || ids.has(t.id)) continue;
      const tpl: Template = {
        id: t.id, title: t.title || 'Sans titre', audience: t.audience === 'partenaire' ? 'partenaire' : 'patient',
        type: t.type === 'sms' ? 'sms' : 'email', patientCategory: t.patientCategory, partnerCategory: t.partnerCategory,
        subject: t.subject ? nameSubst(t.subject) : undefined, body: nameSubst(t.body).split('{{telephone}}').join('{{tel_conseiller}}'),
        smsCompanion: t.smsCompanion ? nameSubst(t.smsCompanion).split('{{telephone}}').join('{{tel_conseiller}}') : undefined, createdAt: t.createdAt,
      };
      out.templates.push(tpl);
    }
  }
  if (old.customCategories) {
    const add = (list: { id: string; label: string }[] | undefined, target: { id: string; label: string }[]) => {
      for (const c of list ?? []) if (c?.id && !target.some((t) => t.id === c.id)) target.push({ id: c.id, label: c.label || c.id });
    };
    out.categories = seedCategories(out.categories);
    add(old.customCategories.patient, out.categories.patient);
    add(old.customCategories.partenaire, out.categories.partenaire);
  }
  if (old.onboardingDone) out.onboardingDone = true;
  return out;
}

/** Données Cockpit → format de l'ancien générateur de mails (pour que l'ancienne app reste utilisable). */
export function toLegacyGenerateur(data: AppData): Record<string, unknown> {
  const r = data.reglages;
  const anamnese: Record<string, { text: string }> = {};
  for (const [id, t] of Object.entries(data.anamnese.textes)) {
    anamnese[id] = { text: t.replace(new RegExp(`\\n*${RESUME_TAG.replace(/[{}]/g, '\\$&')}\\n*`), '\n\n').replace(/\n{3,}/g, '\n\n').trim() };
  }
  return {
    templates: data.templates,
    anamnese,
    customSituations: data.anamnese.situations,
    // L'ancien générateur ajoute lui-même ses catégories de base : on n'exporte que les autres.
    customCategories: {
      patient: data.categories.patient.filter((c) => !CATEGORIES_PATIENT.some((b) => b.id === c.id)),
      partenaire: data.categories.partenaire.filter((c) => !CATEGORIES_PARTENAIRE.some((b) => b.id === c.id)),
    },
    signatureName: r.nom,
    phone: r.telephone,
    advisorGenre: r.genre,
    onboardingDone: true,
    tutorialDone: true,
    emailFooter: r.emailFooter,
    sigPatientMail: r.sigPatientMail,
    sigPatientSMS: r.sigPatientSMS,
    sigPartenaireMail: r.sigPartenaireMail,
  };
}

/** Fusionne un export JSON de l'ancien Suivi Ventes & Primes (union : rien de déjà saisi n'est perdu). */
export function mergeVentes(data: AppData, raw: unknown): AppData {
  const old = raw as Partial<VentesData>;
  const out: AppData = structuredClone(data);
  out.ventes.settings = { ...out.ventes.settings, ...(old.settings ?? {}) };
  if (Array.isArray(old.payslips)) {
    for (const p of old.payslips) if (p && !out.ventes.payslips.some((q) => q.ficheMonth === p.ficheMonth && q.brut === p.brut)) out.ventes.payslips.push(p);
  }
  out.ventes.sales = canonicalizeSales(out.ventes.sales);
  if (old.sales && typeof old.sales === 'object') {
    for (const [month, list] of Object.entries(canonicalizeSales(old.sales as Record<string, Vente[]>))) {
      const target = (out.ventes.sales[month] ??= []);
      for (const s of list) {
        if (!s || typeof s.name !== 'string') continue;
        const cat = s.cat === 2 ? 2 : 1;
        if (!target.some((t) => t.name === s.name && t.cat === cat)) target.push({ name: s.name, cat, ...(s.url ? { url: s.url } : {}) });
      }
    }
  }
  return out;
}

/**
 * Réunit deux copies Cockpit (navigateur / dossier) sans rien perdre : les collections
 * sont fusionnées, les réglages viennent de la copie la plus récente (ou la plus remplie).
 */
export function mergeData(a: AppData, b: AppData): AppData {
  const [newer, older] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [a, b] : [b, a];
  const out: AppData = structuredClone(newer);
  out.onboardingDone = a.onboardingDone || b.onboardingDone;
  if (!out.reglages.nom && older.reglages.nom) out.reglages = { ...older.reglages, ...Object.fromEntries(Object.entries(out.reglages).filter(([, v]) => v !== '' && v !== undefined)) } as AppData['reglages'];
  for (const s of older.anamnese.situations) if (!out.anamnese.situations.some((x) => x.id === s.id)) out.anamnese.situations.push(s);
  for (const [id, t] of Object.entries(older.anamnese.textes)) if (!out.anamnese.textes[id]) out.anamnese.textes[id] = t;
  for (const [k, list] of Object.entries(older.anamnese.phrases)) { const arr = (out.anamnese.phrases[k] ??= []); for (const p of list) if (!arr.includes(p)) arr.push(p); }
  for (const c of older.chatPartenaire ?? []) if (!out.chatPartenaire.some((x) => x.id === c.id)) out.chatPartenaire.push(c);
  for (const t of older.templates) if (!out.templates.some((x) => x.id === t.id)) out.templates.push(t);
  for (const aud of ['patient', 'partenaire'] as const) for (const c of older.categories[aud]) if (!out.categories[aud].some((x) => x.id === c.id)) out.categories[aud].push(c);
  out.partenaires = mergePartenaires(a.partenaires, b.partenaires);
  return mergeVentes(out, older.ventes);
}

/** La lecture la plus récente du rapport fait foi ; les partenaires que l'autre copie est seule à connaître sont gardés. */
export function mergePartenaires(a: PartenairesData | undefined, b: PartenairesData | undefined): PartenairesData {
  const pa = a ?? { fetchedAt: 0, items: [] };
  const pb = b ?? { fetchedAt: 0, items: [] };
  const [newer, older] = pa.fetchedAt >= pb.fetchedAt ? [pa, pb] : [pb, pa];
  const items = [...newer.items];
  for (const p of older.items) if (!items.some((x) => x.id === p.id)) items.push(p);
  return { fetchedAt: newer.fetchedAt, items };
}

/**
 * Remplace un nom écrit en dur (celui de l'auteur des textes) par la variable
 * {{nom_conseiller}} dans les modèles, textes d'anamnèse et textes du chat.
 */
export function substituteName(data: AppData, name: string): AppData {
  const n = name.trim();
  if (n.length < 4) return data;
  const out: AppData = structuredClone(data);
  const sub = (t: string | undefined) => (t && t.includes(n) ? t.split(n).join('{{nom_conseiller}}') : t);
  for (const t of out.templates) { t.subject = sub(t.subject); t.body = sub(t.body) ?? t.body; t.smsCompanion = sub(t.smsCompanion); }
  for (const [id, t] of Object.entries(out.anamnese.textes)) out.anamnese.textes[id] = sub(t) ?? t;
  for (const c of out.chatPartenaire) c.text = sub(c.text) ?? c.text;
  return out;
}

/** Fichier de partage : modèles, catégories, situations/textes/phrases, textes du chat — ni réglages ni ventes. */
export function toPartage(data: AppData): Record<string, unknown> {
  const clean = substituteName(data, data.reglages.nom);
  return {
    share: true,
    version: 2,
    templates: clean.templates,
    categories: { patient: clean.categories.patient, partenaire: clean.categories.partenaire },
    anamnese: clean.anamnese,
    chatPartenaire: clean.chatPartenaire,
  };
}

/** Fusionne un fichier de partage dans les données courantes (union, sans doublon). */
export function mergePartage(data: AppData, raw: unknown): AppData {
  const p = raw as Partial<AppData>;
  const out: AppData = structuredClone(data);
  for (const t of p.templates ?? []) if (t?.id && !out.templates.some((x) => x.id === t.id)) out.templates.push(t);
  for (const aud of ['patient', 'partenaire'] as const) for (const c of p.categories?.[aud] ?? []) if (c?.id && !out.categories[aud].some((x) => x.id === c.id)) out.categories[aud].push(c);
  for (const s of p.anamnese?.situations ?? []) if (s?.id && !out.anamnese.situations.some((x) => x.id === s.id)) out.anamnese.situations.push(s);
  for (const [id, t] of Object.entries(p.anamnese?.textes ?? {})) if (!out.anamnese.textes[id]) out.anamnese.textes[id] = t;
  for (const [k, list] of Object.entries(p.anamnese?.phrases ?? {})) { const arr = (out.anamnese.phrases[k] ??= []); for (const ph of list) if (!arr.includes(ph)) arr.push(ph); }
  for (const c of p.chatPartenaire ?? []) if (c?.id && !out.chatPartenaire.some((x) => x.id === c.id)) out.chatPartenaire.push(c);
  return out;
}

/** Complète des données Cockpit éventuellement incomplètes (ancienne version, champs manquants). */
export function normalize(raw: unknown, base: AppData): AppData {
  const o = (raw ?? {}) as Partial<AppData>;
  const out: AppData = structuredClone(base);
  out.onboardingDone = !!o.onboardingDone;
  out.reglages = { ...out.reglages, ...(o.reglages ?? {}) };
  if (o.anamnese) {
    out.anamnese.situations = Array.isArray(o.anamnese.situations) && o.anamnese.situations.length ? o.anamnese.situations : DEFAULT_SITUATIONS.map((s) => ({ ...s }));
    out.anamnese.textes = { ...out.anamnese.textes, ...(o.anamnese.textes ?? {}) };
    out.anamnese.phrases = o.anamnese.phrases ?? {};
  }
  for (const [id, t] of Object.entries(out.anamnese.textes)) out.anamnese.textes[id] = ensurePhoneUnderName(t);
  if (Array.isArray(o.templates)) out.templates = o.templates;
  if (Array.isArray(o.chatPartenaire)) out.chatPartenaire = o.chatPartenaire;
  if (typeof o.updatedAt === 'number') out.updatedAt = o.updatedAt;
  if (o.categories) out.categories = seedCategories({ patient: o.categories.patient ?? [], partenaire: o.categories.partenaire ?? [], seeded: o.categories.seeded });
  if (o.ventes) out.ventes = { settings: { ...out.ventes.settings, ...(o.ventes.settings ?? {}) }, payslips: o.ventes.payslips ?? [], sales: canonicalizeSales(o.ventes.sales ?? {}) };
  if (o.partenaires && Array.isArray(o.partenaires.items)) {
    out.partenaires = { fetchedAt: typeof o.partenaires.fetchedAt === 'number' ? o.partenaires.fetchedAt : 0, items: o.partenaires.items.filter((p) => p && typeof p.id === 'string' && typeof p.nom === 'string') };
  }
  return out;
}
