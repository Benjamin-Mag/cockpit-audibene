import { type Locator, type Page, expect, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FAUX = readFileSync(fileURLToPath(new URL('./faux-navigateur.js', import.meta.url)), 'utf8');

/** Onglets du faux navigateur. */
export const ONGLET = { piste: 11, opportunite: 12, doctolib: 13, google: 14, accueilSf: 15, acuitis: 16, grandAudition: 17 } as const;

export interface Scenario {
  onglet?: number;
  /** Données Cockpit de départ ; null = premier lancement. */
  donnees?: Record<string, unknown> | null;
  echecs?: string[];
  ficheSansGenre?: boolean;
  /** La Piste se lit vide (Salesforce encore en train de se dessiner) ; modifiable en cours de test. */
  ficheVide?: boolean;
  doctolibBloque?: boolean;
  sansDoctolibPro?: boolean;
  partnerSearchVide?: boolean;
  recents?: unknown[];
  creneauxEnDouble?: boolean;
  /** La page Salesforce répond au ping mais plus à aucune autre demande (script figé). */
  pageMuette?: boolean;
  /** Partenaire et adresse absents de la lecture rapide : lus seulement quand le panneau les demande. */
  partenaireALaDemande?: boolean;
  /** 30 ORL au lieu de 6 (plus que l'affichage initial de l'ORL Finder). */
  beaucoupOrl?: boolean;
  /** Dossier synchronisé simulé (OPFS) : autorisation de départ, refus au clic « Autoriser », cockpit.json en lecture seule. */
  dossier?: { permission?: 'granted' | 'prompt' | 'denied'; refus?: boolean; lectureSeule?: boolean };
  /** chrome.storage.local survit au rechargement du panneau (réinstallation, fermeture/réouverture). */
  localPersistant?: boolean;
}

export const MODELES = [
  { id: 'tpl-rdv', title: 'Confirmation de RDV', audience: 'patient', type: 'email', patientCategory: 'Reconfirmation', subject: 'Votre rendez-vous du {{date}}', body: 'Bonjour {{nom}},\nVotre rendez-vous est confirmé le {{date}} à {{heure}}.\nBien à vous,\n{{nom_conseiller}}', smsCompanion: 'Bonjour, RDV le {{date}} à {{heure}}. {{nom_conseiller}}' },
  { id: 'tpl-cc1', title: 'Relance CC1', audience: 'patient', type: 'email', patientCategory: 'CC1', subject: 'Suite à notre échange', body: 'Bonjour {{nom}},\nJe reviens vers vous.\n{{nom_conseiller}}' },
  { id: 'tpl-sms', title: 'SMS rappel', audience: 'patient', type: 'sms', patientCategory: 'all', body: 'Bonjour {{nom}}, pensez à votre RDV. {{nom_conseiller}}' },
  { id: 'tpl-part', title: 'Nouveau patient partenaire', audience: 'partenaire', type: 'email', partnerCategory: 'CC1', subject: 'Patient pour {{nom partenaire}}', body: 'Bonjour {{nom partenaire}},\nJe vous adresse {{nom}}.\n{{adresse}}\nCordialement,\n{{nom_conseiller}}' },
];

export function donneesTest(extra: Record<string, unknown> = {}) {
  return {
    version: 2,
    onboardingDone: true,
    updatedAt: 1,
    reglages: { nom: 'Benjamin Test', telephone: '06 00 00 00 00', email: 'benjamin@test.fr', genre: 'M', mvComment: 'MV', autoSaveComment: true, emailFooter: 'Pied de page test', sigPatientMail: '', sigPatientSMS: '', sigPartenaireMail: '' },
    anamnese: {
      situations: [{ id: 'depistage_simple', label: 'Dépistage' }, { id: 'premier_rdv', label: '1er RDV' }],
      textes: { depistage_simple: 'Cher partenaire, je vous confie notre patient(e) pour un dépistage.\n\n{{resume}}\n\nBien à vous,\n{{nom_conseiller}}', premier_rdv: 'Premier RDV pour notre patient(e).\n\n{{resume}}\n\n{{nom_conseiller}}' },
      phrases: {},
    },
    chatPartenaire: [{ id: 'chat-merci', label: 'Merci', text: 'Bonjour,\nMerci pour cette mise à jour.\n{{nom_conseiller}}' }, { id: 'chat-relance', label: 'Relance', text: 'Bonjour, avez-vous des nouvelles de notre patient(e) ?' }],
    // Une copie par appel : un test qui retouche un modèle (60-cosi-anamnese) ne doit pas le changer pour les suivants.
    templates: MODELES.map((t) => ({ ...t })),
    categories: { patient: [{ id: 'Reconfirmation', label: 'Reconfirmation' }, { id: 'CC1', label: 'CC1' }], partenaire: [{ id: 'CC1', label: 'CC1' }, { id: 'CC2', label: 'CC2' }], seeded: true },
    ventes: { settings: { primeCat1: 40, primeCat2: 80, salaireBase: 0, indemnites: 0, cotFallback: 0.21, pasFallback: 0.099, retenuesFallback: 0, tauxImposition: 9.9 }, payslips: [], sales: { '2026-09': [{ name: 'Vente gardée', cat: 1 }] } },
    ...extra,
  };
}

export interface Panneau {
  page: Page;
  erreurs: string[];
  journal: () => Promise<{ api: string; type: string; detail: any }[]>;
  demandes: (type: string) => Promise<any[]>;
  donnees: () => Promise<any>;
  presse: () => Promise<string>;
}

/** Ouvre le vrai panneau dans le faux navigateur. */
export async function ouvrir(page: Page, s: Scenario = {}): Promise<Panneau> {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) erreurs.push('console: ' + m.text()); });
  const stockage: Record<string, unknown> = {};
  if (s.donnees !== null) stockage['cockpit-data'] = JSON.stringify(s.donnees ?? donneesTest());
  if (s.recents) stockage.recentPatients = s.recents;
  const scenario = { ...s, stockage };
  await page.addInitScript(`window.__SCENARIO = ${JSON.stringify(scenario)}; ${s.donnees === null || s.dossier ? '' : "try { localStorage.setItem('cockpit-storage-mode', 'browser'); } catch {}"}`);
  await page.addInitScript(FAUX);
  await page.goto('/panel.html');
  const journal = () => page.evaluate(() => (window as any).__journal);
  return {
    page,
    erreurs,
    journal,
    demandes: async (type) => (await journal()).filter((j) => j.api === 'page' && j.type === type).map((j) => j.detail),
    donnees: () => page.evaluate(() => JSON.parse((window as any).__mock.local._d['cockpit-data'] ?? 'null')),
    presse: () => page.evaluate(() => navigator.clipboard.readText()),
  };
}

// ---------------------------------------------------------------- navigation (commune aux deux designs)

/** Va sur un écran : bouton de navigation portant ce nom (onglet, barre du bas, sélecteur du haut). */
export async function aller(page: Page, ecran: 'Fiche' | 'COSI' | 'Anamnèse' | 'ORL Finder' | 'Mails' | 'Chat partenaire' | 'Partenaires' | 'Réglages' | 'Cockpit') {
  if (ecran === 'Réglages') {
    if (await page.locator('.section-title', { hasText: 'Signature' }).isVisible()) return;
    await page.getByRole('button', { name: 'Réglages', exact: true }).first().click();
    return;
  }
  const noms: Record<string, RegExp> = {
    Fiche: /^\s*(Fiche|Cockpit)\s*$/, Cockpit: /^\s*(Cockpit|Fiche)\s*$/, COSI: /^\s*COSI\s*$/, 'Anamnèse': /^\s*Anamnèse\s*$/, 'ORL Finder': /^\s*(ORL Finder|ORL)\s*$/,
    Mails: /^\s*Mails?\s*$/, 'Chat partenaire': /^\s*(Chat partenaire|Chat)\s*$/, Partenaires: /^\s*Partenaires\s*$/,
  };
  const btn = page.locator('nav button, .pages button').filter({ hasText: noms[ecran] });
  if (ecran === 'Fiche' && !(await btn.count())) return;
  await btn.first().click();
}

/** Les écrans proposés par la navigation (textes des boutons). */
export async function ecransVisibles(page: Page): Promise<string[]> {
  return (await page.locator('nav button:visible, .pages button:visible').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

export const test = base;
export { expect };

/** Glisser-déposer HTML5 (dragstart → dragover → drop → dragend) de `source` sur `cible`, avec un même DataTransfer. */
export async function glisser(page: Page, source: Locator, cible: Locator) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer: dt });
  await cible.dispatchEvent('dragenter', { dataTransfer: dt });
  await cible.dispatchEvent('dragover', { dataTransfer: dt });
  await cible.dispatchEvent('drop', { dataTransfer: dt });
  await source.dispatchEvent('dragend', { dataTransfer: dt });
}

/** Attend un message court (toast). */
export async function toast(page: Page, texte: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: texte }).first()).toBeVisible();
}

