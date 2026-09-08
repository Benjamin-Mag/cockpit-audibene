import { CONTENT_VERSION } from '../shared/messages';
import { initSalesforce } from './salesforce';

// Le script peut être injecté deux fois (manifest + injection à la demande après
// une mise à jour de l'extension). Un ancien exemplaire dont le runtime est mort
// ne compte pas : `alive` est évalué avec SON binding chrome, invalidé au reload.
interface Marker { version: number; alive: () => boolean }
declare global { interface Window { __cockpit?: Marker } }

const prev = window.__cockpit;
if (!(prev && prev.alive())) {
  window.__cockpit = {
    version: CONTENT_VERSION,
    alive: () => { try { return !!chrome.runtime?.id; } catch { return false; } },
  };
  const host = location.hostname;
  if (/(salesforce\.com|force\.com)$/.test(host)) {
    if (window === window.top) initSalesforce();
  }
  // Doctolib et Acuitis : étape 2.
}
