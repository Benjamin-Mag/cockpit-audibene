import { CONTENT_VERSION, type ContentRequest, type ContentResponse } from '../../shared/messages';
import { fillSmsSearch } from './actions';

/**
 * Cadres secondaires (cadres d'une page Salesforce, ou application intégrée comme Hearo) :
 * ils répondent au ping, et à la recherche SMS seulement s'ils contiennent le champ visé —
 * pour ne pas parler à la place du bon cadre quand la demande est envoyée à tous.
 */
export function initSalesforceFrame(): () => void {
  const onMessage = (msg: ContentRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: ContentResponse) => void) => {
    if (msg.type === 'ping') { sendResponse({ type: 'pong', version: CONTENT_VERSION, site: 'salesforce' }); return; }
    if (msg.type !== 'fillSmsSearch') return;
    const result = fillSmsSearch(msg.text);
    if (!result) { if (window !== window.top) sendResponse({ type: 'result', result: { ok: false, msg: `champ absent de ${location.hostname}` } }); return; }
    sendResponse({ type: 'result', result });
    return;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return () => chrome.runtime.onMessage.removeListener(onMessage);
}
