import { CONTENT_VERSION } from '../shared/messages';
import { initAcuitis } from './acuitis';
import { initDoctolib } from './doctolib';
import { initSalesforce } from './salesforce';
import { initSalesforceFrame } from './salesforce/frame';

// Le script peut être injecté plusieurs fois : par le manifest au chargement de la
// page, puis par le panneau après chaque nouveau build de l'extension. Un seul
// exemplaire doit répondre : le plus récent désactive le précédent (dispose), et un
// exemplaire dont le runtime est mort (extension rechargée) ne compte plus.
interface Marker { version: string; alive: () => boolean; dispose: () => void }
declare global { interface Window { __cockpit?: Marker } }

const prev = window.__cockpit;
if (!(prev && prev.alive() && prev.version === CONTENT_VERSION)) {
  try { prev?.dispose(); } catch { /* ancien exemplaire sans dispose */ }
  const host = location.hostname;
  let dispose: () => void;
  if (/(salesforce\.com|force\.com)$/.test(host)) {
    dispose = window === window.top ? initSalesforce() : initSalesforceFrame();
  } else if (/doctolib\.fr$/.test(host)) {
    dispose = initDoctolib();
  } else if (/acuitis\.com$/.test(host)) {
    dispose = initAcuitis();
  } else {
    // Cadre d'une application intégrée à Salesforce (ex. Hearo), injecté à la demande par le panneau.
    dispose = initSalesforceFrame();
  }
  window.__cockpit = {
    version: CONTENT_VERSION,
    alive: () => { try { return !!chrome.runtime?.id; } catch { return false; } },
    dispose,
  };
}
