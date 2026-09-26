import { type Locator, type Page, expect, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FAUX = readFileSync(fileURLToPath(new URL('./faux-navigateur.js', import.meta.url)), 'utf8');

/** Onglets du faux navigateur. */
export const ONGLET = { piste: 11, opportunite: 12, doctolib: 13, google: 14, accueilSf: 15, acuitis: 16 } as const;

export interface Scenario {
  onglet?: number;
  /** Données Cockpit de départ ; null = premier lancement. */
  donnees?: Record<string, unknown> | null;
  echecs?: string[];
  ficheSansGenre?: boolean;
  doctolibBloque?: boolean;
  sansDoctolibPro?: boolean;
  partnerSearchVide?: boolean;
  recents?: unknown[];
  creneauxEnDouble?: boolean;
  /** La page Salesforce répond au ping mais plus à aucune autre demande (script figé). */
  pageMuette?: boolean;
  /** Page Salesforce qui répond au ping mais ne pousse jamais son contexte (connexion, page Setup…). */
  sansContexte?: boolean;
  /** Partenaire et adresse absents de la lecture rapide : lus seulement quand le panneau les demande. */
  partenaireALaDemande?: boolean;
  /** 30 ORL au lieu de 6 (plus que l'affichage initial de l'ORL Finder). */
  beaucoupOrl?: boolean;
  /** Dossier synchronisé simulé (OPFS) : autorisation de départ, refus au clic « Autoriser ». */
  dossier?: { permission?: 'granted' | 'prompt' | 'denied'; refus?: boolean };
}

import { MODELES, donneesTest } from './donnees.mjs';
export { MODELES, donneesTest };

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

