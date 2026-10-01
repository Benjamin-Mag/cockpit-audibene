// Captures d'écran du panneau dans le faux navigateur : node tests/captures.mjs <dossier> <prefixe>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const [dossier = 'tests/captures', prefixe = 'ecran'] = process.argv.slice(2);
mkdirSync(dossier, { recursive: true });
const FAUX = readFileSync(new URL('./e2e/faux-navigateur.js', import.meta.url), 'utf8');
const { donneesTest } = await import('./e2e/donnees.mjs');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function capture(nom, onglet, etapes = async () => {}) {
  const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const sc = { onglet, stockage: { 'cockpit-data': JSON.stringify(donneesTest()), recentPatients: [{ recordId: 'PISTETEST0000001A', genre: 'F', prenom: 'Alice', nom: 'Essai', email: 'm@example.com', telephone: '06 00 00 00 01', naissance: '12/03/1951', savedAt: Date.now() - 120000 }] } };
  await page.addInitScript(`window.__SCENARIO = ${JSON.stringify(sc)}; localStorage.setItem('cockpit-storage-mode','browser');`);
  await page.addInitScript(FAUX);
  await page.goto('http://localhost:5199/panel.html');
  await page.waitForTimeout(700);
  await etapes(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dossier}/${prefixe}-${nom}.png` });
  await page.close();
}
const nav = (p, t) => p.locator('nav button, .pages button').filter({ hasText: new RegExp(`^\\s*${t}\\s*$`) }).first().click();
await capture('1-piste-accueil', 11);
await capture('2-cosi', 11, async (p) => { await nav(p, 'COSI'); await p.getByRole('button', { name: 'Premier appareillage', exact: true }).click(); await p.getByRole('button', { name: 'Retraité/e', exact: true }).click(); });
await capture('3-anamnese', 11, async (p) => { await nav(p, 'Anamnèse'); });
await capture('4-orl', 11, async (p) => { await nav(p, '(ORL|ORL Finder)'); await p.waitForTimeout(3000); });
await capture('5-partenaires', 11, async (p) => { await nav(p, 'Partenaires'); await p.waitForTimeout(3000); });
await capture('6-opp-accueil', 12);
await capture('7-mails', 12, async (p) => { await nav(p, 'Mails?'); await p.getByRole('button', { name: /Confirmation de RDV/ }).click(); });
await capture('8-mail-edition', 12, async (p) => { await nav(p, 'Mails?'); await p.getByRole('button', { name: 'Nouveau modèle' }).click(); });
await capture('9-chat', 12, async (p) => { await nav(p, '(Chat|Chat partenaire)'); });
await capture('10-doctolib', 13);
await capture('11-reglages', 11, async (p) => { await p.getByRole('button', { name: 'Réglages', exact: true }).first().click(); });
await browser.close();
