import type { ContentRequest, ContentResponse } from '../../shared/messages';
import { fillSmsSearch } from './actions';

/**
 * Cadres secondaires d'une page Salesforce (ex. le panneau Hearo, intégré en iframe) :
 * ils ne répondent qu'aux demandes qui les concernent — ici la recherche SMS — et
 * seulement s'ils contiennent le champ visé, pour ne pas parler à la place du cadre principal.
 */
export function initSalesforceFrame(): () => void {
  const onMessage = (msg: ContentRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: ContentResponse) => void) => {
    if (msg.type !== 'fillSmsSearch') return;
    const result = fillSmsSearch(msg.text);
    if (!result) return;
    sendResponse({ type: 'result', result });
    return;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return () => chrome.runtime.onMessage.removeListener(onMessage);
}
