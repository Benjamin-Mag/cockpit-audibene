import { CONTENT_VERSION, type ContentRequest, type ContentResponse } from '../shared/messages';
import type { ActionResult, PatientData } from '../shared/types';

export const REFERRER = 'Audibene';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Remplit un champ React comme un utilisateur (setter natif de LA fenêtre du champ + événements). */
export function setVal(el: Element, value: string, win: Window = window) {
  const w = win as Window & typeof globalThis;
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}

/** Écrase toujours le champ (même vide) : une valeur d'un collage précédent ne doit pas rester. */
export function fillById(doc: Document, id: string, value: string | undefined, win: Window = window): boolean {
  const el = doc.getElementById(id);
  if (!el) return false;
  setVal(el, value ?? '', win);
  return true;
}

export const fullName = (p: PatientData) => [p.prenom, p.nom].filter(Boolean).join(' ');

/**
 * Formulaire de RDV du prestataire commun à Acuitis et Grand Audition (mêmes identifiants de champs).
 * `jourVide` : valeur de l'option « Jour » quand la date de naissance manque. Renvoie faux si aucun champ n'est là.
 */
export function remplirWidgetRdv(data: PatientData, note: string, jourVide: string): boolean {
  const f = (id: string, v: string | undefined) => fillById(document, id, v);
  let found = false;
  found = f('name', data.nom) || found;
  found = f('firstname', data.prenom) || found;
  const tel = document.querySelector('input[type="tel"]');
  if (tel) { setVal(tel, data.telephone || ''); found = true; }
  found = f('email', data.email) || found;
  const parts = (data.naissance || '').split('/');
  let day = jourVide, month = '', year = '';
  if (parts.length === 3) {
    day = String(parseInt(parts[0], 10));
    month = String(parseInt(parts[1], 10));
    year = parts[2];
  }
  found = f('birthdateDay', day) || found;
  found = f('birthdateMonth', month) || found;
  found = f('birthdateYear', year) || found;
  found = f('remarque', note) || found;
  return found;
}

/** Écoute les messages du panneau pour un site de formulaire ; renvoie de quoi se désactiver. */
export function listen(site: 'doctolib' | 'acuitis' | 'grandaudition', paste: (data: PatientData, note: string) => Promise<ActionResult>): () => void {
  const onMessage = (msg: ContentRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: ContentResponse) => void) => {
    if (msg.type === 'ping') { sendResponse({ type: 'pong', version: CONTENT_VERSION, site }); return; }
    if (msg.type === 'pastePatient') {
      paste(msg.data, msg.note).then((result) => sendResponse({ type: 'result', result }), (e: unknown) => sendResponse({ type: 'result', result: { ok: false, msg: String(e) } }));
      return true;
    }
    return;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return () => chrome.runtime.onMessage.removeListener(onMessage);
}
