// Capture de la page des extensions (chrome://extensions) avec le Chrome du poste, l'extension chargée
// depuis dist/ et le mode développeur activé. Pas lancé par npm test.
//   CHROMIUM_PATH="…/chrome.exe" node tests/captures-chrome.mjs <dossier-images>
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const [dossier = 'tests/captures-tuto'] = process.argv.slice(2);
mkdirSync(dossier, { recursive: true });
const dist = resolve('dist');
const profil = mkdtempSync(join(tmpdir(), 'cockpit-tuto-'));
const headless = process.env.VISIBLE ? false : true;
const ctx = await chromium.launchPersistentContext(profil, {
  executablePath: process.env.CHROMIUM_PATH,
  headless,
  viewport: { width: 1100, height: 380 },
  deviceScaleFactor: 1.5,
  locale: 'fr-FR',
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--lang=fr-FR'],
});
const page = await ctx.newPage();
await page.goto('chrome://extensions/');
await page.waitForTimeout(1200);
const toggle = page.locator('extensions-manager extensions-toolbar #devMode');
if (!(await toggle.getAttribute('checked'))) { await toggle.click(); await page.waitForTimeout(600); }
await page.screenshot({ path: `${dossier}/extensions-mode-developpeur.png` });
const carte = page.locator('extensions-item').first();
if (await carte.count()) { await carte.screenshot({ path: `${dossier}/extensions-carte.png` }); console.log('capture extensions-carte'); } else console.log('pas de carte (extension non chargée)');
console.log('capture extensions-mode-developpeur');
await ctx.close();
