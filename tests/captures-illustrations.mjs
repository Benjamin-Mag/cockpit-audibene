// Illustrations du tutoriel qui ne se capturent pas (Explorateur Windows, carte de l'extension) : dessinées en HTML, rendues en PNG.
//   CHROMIUM_PATH="…/chrome.exe" node tests/captures-illustrations.mjs <dossier-images>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [dossier = 'tests/captures-tuto'] = process.argv.slice(2);
mkdirSync(dossier, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const STYLE = `
  * { box-sizing: border-box; } body { margin: 0; font: 15px/1.5 "Segoe UI", system-ui, sans-serif; color: #1a2b4a; background: #fff; }
  .scene { padding: 22px 26px; display: flex; align-items: center; gap: 18px; }
  .fichier { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 150px; text-align: center; font-size: 13px; }
  .zip { width: 70px; height: 84px; border-radius: 8px; background: linear-gradient(#f7d774, #e4b93a); border: 1px solid #c9a330; position: relative; box-shadow: 0 6px 16px rgba(26,43,74,.14); }
  .zip::after { content: "ZIP"; position: absolute; left: 0; right: 0; bottom: 10px; font-weight: 700; font-size: 13px; color: #6b4f00; }
  .zip::before { content: ""; position: absolute; left: 31px; top: 0; width: 8px; height: 46px; background: repeating-linear-gradient(#6b4f00 0 5px, transparent 5px 10px); opacity: .7; }
  .menu { background: #fff; border: 1px solid #cfd8e3; border-radius: 8px; box-shadow: 0 10px 26px rgba(26,43,74,.18); padding: 6px 0; width: 230px; font-size: 14px; }
  .menu div { padding: 7px 16px; color: #333; } .menu .on { background: #1b4f9b; color: #fff; font-weight: 600; }
  .fleche { font-size: 30px; color: #8fa8cc; }
  .dossier { width: 86px; height: 66px; position: relative; }
  .dossier::before { content: ""; position: absolute; left: 0; top: 10px; width: 86px; height: 56px; background: #f4c04a; border-radius: 6px; }
  .dossier::after { content: ""; position: absolute; left: 0; top: 2px; width: 36px; height: 14px; background: #e4ad2f; border-radius: 6px 6px 0 0; }
  .chemin { font-size: 13px; color: #5b7a99; margin-top: 4px; }
  .carte { margin: 20px; width: 440px; border: 1px solid #dadce0; border-radius: 10px; padding: 16px 18px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.12); background: #fff; font: 14px "Segoe UI", system-ui, sans-serif; }
  .carte .haut { display: flex; gap: 14px; align-items: flex-start; }
  .carte .ico { width: 36px; height: 36px; border-radius: 9px; background: #1b4f9b; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
  .carte b { font-size: 15px; } .carte .desc { color: #5f6368; font-size: 13px; margin-top: 3px; }
  .carte .bas { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e8eaed; }
  .carte .lien { color: #1a73e8; font-weight: 600; }
  .carte .rond { margin-left: auto; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #1a73e8; box-shadow: 0 0 0 4px #d0e8f7; }
  .carte .toggle { width: 38px; height: 20px; border-radius: 10px; background: #1a73e8; position: relative; } .carte .toggle::after { content: ""; position: absolute; right: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; }
  .legende { position: absolute; font-size: 13px; color: #1b4f9b; font-weight: 600; }
`;

async function rendre(nom, html, largeur) {
  const page = await browser.newPage({ viewport: { width: largeur, height: 200 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${html}</body></html>`);
  await page.waitForTimeout(200);
  const el = page.locator('body > *').first();
  await el.screenshot({ path: `${dossier}/${nom}.png` });
  await page.close();
  console.log('illustration', nom);
}

await rendre('decompresser', `
  <div class="scene">
    <div class="fichier"><div class="zip"></div><span>cockpit-audibene.zip</span></div>
    <div class="menu"><div>Ouvrir</div><div class="on">Extraire tout…</div><div>Copier</div><div>Supprimer</div></div>
    <div class="fleche">→</div>
    <div class="fichier"><div class="dossier"></div><span>Cockpit Audibene</span><span class="chemin">Documents\\Cockpit Audibene</span></div>
  </div>`, 760);

await rendre('mise-a-jour', `
  <div class="carte">
    <div class="haut">
      <div class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14" r="1.6" fill="#fff"/></svg></div>
      <div><b>Cockpit Audibene</b> <span style="color:#5f6368">1.1.0</span><div class="desc">Panneau latéral pour Salesforce : anamnèse, MV non joignable, mails, prise de RDV…</div></div>
    </div>
    <div class="bas"><span class="lien">Détails</span><span class="lien">Supprimer</span><div class="rond" title="Recharger">↻</div><div class="toggle"></div></div>
  </div>`, 480);

await browser.close();
