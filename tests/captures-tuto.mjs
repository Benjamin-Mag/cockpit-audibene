// Captures du panneau pour le tutoriel des collègues (design Fusion), prises dans le faux navigateur du banc.
// Données 100 % fictives (donneesTest, fiches « Alice Essai » / « Bernard Test »). Pas lancé par npm test.
//   PW_PORT=5531 CHROMIUM_PATH="…/chrome.exe" node tests/captures-tuto.mjs <dossier-images>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const [dossier = 'tests/captures-tuto'] = process.argv.slice(2);
const PORT = Number(process.env.PW_PORT ?? 5199);
mkdirSync(dossier, { recursive: true });
const FAUX = readFileSync(new URL('./e2e/faux-navigateur.js', import.meta.url), 'utf8');
const { donneesTest } = await import('./e2e/donnees.mjs');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const RECENTS = [{ recordId: 'PISTETEST0000001A', genre: 'F', prenom: 'Alice', nom: 'Essai', email: 'alice.essai@example.com', telephone: '06 00 00 00 01', naissance: '12/03/1951', savedAt: Date.now() - 120000 }];

async function capture(nom, onglet, etapes = async () => {}, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 420, height: opts.hauteur ?? 860 }, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const sc = { onglet, stockage: opts.premierLancement ? {} : { 'cockpit-data': JSON.stringify(donneesTest()), recentPatients: RECENTS } };
  await page.addInitScript(`window.__SCENARIO = ${JSON.stringify(sc)}; ${opts.premierLancement ? '' : "localStorage.setItem('cockpit-storage-mode','browser');"}`);
  await page.addInitScript(FAUX);
  // Numéro de version montré dans Réglages : celui de la version publiée, pas celui du faux navigateur.
  await page.addInitScript("chrome.runtime.getManifest = () => ({ version: '1.1.0', permissions: [] });");
  await page.goto(`http://localhost:${PORT}/panel.html`);
  await page.waitForTimeout(800);
  await etapes(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dossier}/${nom}.png` });
  await page.close();
  console.log('capture', nom);
}
const barre = (p, t) => p.locator('nav.barre button').filter({ hasText: new RegExp(`^\\s*${t}\\s*$`) }).first().click();
const reglages = (p) => p.getByRole('button', { name: 'Réglages', exact: true }).first().click();

// Installation
await capture('premier-lancement', 11, async () => {}, { premierLancement: true, hauteur: 500 });
// Utilisation
await capture('fiche', 11);
await capture('fiche-reprendre', 11, async (p) => { await barre(p, 'COSI'); await p.getByRole('button', { name: 'Premier appareillage', exact: true }).click(); await barre(p, 'Fiche'); });
await capture('cosi', 11, async (p) => { await barre(p, 'COSI'); await p.getByRole('button', { name: 'Premier appareillage', exact: true }).click(); await p.getByRole('button', { name: 'Retraité/e', exact: true }).click(); });
await capture('anamnese', 11, async (p) => { await barre(p, 'Anamnèse'); });
await capture('orl-finder', 11, async (p) => { await barre(p, 'ORL Finder'); await p.waitForTimeout(3500); });
await capture('partenaires', 11, async (p) => { await barre(p, 'Partenaires'); await p.waitForTimeout(3500); });
await capture('mails', 12, async (p) => { await barre(p, 'Mails'); await p.getByRole('button', { name: /Confirmation de RDV/ }).click(); });
await capture('modele-nouveau', 12, async (p) => { await barre(p, 'Mails'); await p.getByRole('button', { name: 'Nouveau modèle' }).click(); await p.getByPlaceholder(/Confirmation de rendez-vo/).fill('Relance après devis'); });
await capture('chat-partenaire', 12, async (p) => { await barre(p, 'Chat partenaire'); });
await capture('doctolib', 13, async () => {}, { hauteur: 560 });
await capture('reglages', 11, async (p) => { await reglages(p); });
await capture('reglages-donnees', 11, async (p) => { await reglages(p); await p.locator('.section-title', { hasText: 'Données' }).scrollIntoViewIfNeeded(); await p.locator('.section-title', { hasText: 'Données' }).evaluate((el) => el.scrollIntoView({ block: 'start' })); });
await browser.close();
