import { type AppData, DEFAULT_SITUATIONS, DEFAULT_TEXTES, RESUME_TAG, type Situation, type Template, type VentesData } from '../model';

export type LegacyKind = 'cockpit' | 'generateur' | 'ventes' | 'inconnu';

export function detectKind(obj: unknown): LegacyKind {
  if (!obj || typeof obj !== 'object') return 'inconnu';
  const o = obj as Record<string, unknown>;
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
      if (text) out.anamnese.textes[id] = withResumeTag(nameSubst(text));
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
    out.categories.patient = old.customCategories.patient?.map((c) => ({ id: c.id, label: c.label })) ?? out.categories.patient;
    out.categories.partenaire = old.customCategories.partenaire?.map((c) => ({ id: c.id, label: c.label })) ?? out.categories.partenaire;
  }
  if (old.onboardingDone) out.onboardingDone = true;
  return out;
}

/** Fusionne un export JSON de l'ancien Suivi Ventes & Primes. */
export function mergeVentes(data: AppData, raw: unknown): AppData {
  const old = raw as VentesData;
  const out: AppData = structuredClone(data);
  out.ventes.settings = { ...out.ventes.settings, ...old.settings };
  out.ventes.payslips = Array.isArray(old.payslips) ? old.payslips : out.ventes.payslips;
  out.ventes.sales = old.sales && typeof old.sales === 'object' ? old.sales : out.ventes.sales;
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
  if (Array.isArray(o.templates)) out.templates = o.templates;
  if (o.categories) out.categories = { patient: o.categories.patient ?? [], partenaire: o.categories.partenaire ?? [] };
  if (o.ventes) out.ventes = { settings: { ...out.ventes.settings, ...(o.ventes.settings ?? {}) }, payslips: o.ventes.payslips ?? [], sales: o.ventes.sales ?? {} };
  return out;
}
