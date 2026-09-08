import { type AppData, DEFAULT_SITUATIONS, DEFAULT_TEXTES, RESUME_TAG, type Situation, type Template, type VentesData, ensurePhoneUnderName } from '../model';

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
    out.categories.patient = old.customCategories.patient?.map((c) => ({ id: c.id, label: c.label })) ?? out.categories.patient;
    out.categories.partenaire = old.customCategories.partenaire?.map((c) => ({ id: c.id, label: c.label })) ?? out.categories.partenaire;
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
    customCategories: data.categories,
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
  if (old.sales && typeof old.sales === 'object') {
    for (const [month, list] of Object.entries(old.sales)) {
      if (!Array.isArray(list)) continue;
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
  if (o.categories) out.categories = { patient: o.categories.patient ?? [], partenaire: o.categories.partenaire ?? [] };
  if (o.ventes) out.ventes = { settings: { ...out.ventes.settings, ...(o.ventes.settings ?? {}) }, payslips: o.ventes.payslips ?? [], sales: o.ventes.sales ?? {} };
  return out;
}
