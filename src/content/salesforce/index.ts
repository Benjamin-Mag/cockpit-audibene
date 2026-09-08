import { CONTENT_VERSION, PORT_NAME, type ContentRequest, type ContentResponse, type ContextPush } from '../../shared/messages';
import { fillAnamnese, insertMail, openComposer, runMv, writeComment } from './actions';
import { currentContext, readFiche } from './context';

async function handle(req: ContentRequest): Promise<ContentResponse> {
  switch (req.type) {
    case 'ping':
      return { type: 'pong', version: CONTENT_VERSION, site: 'salesforce' };
    case 'getContext':
      return { type: 'context', context: currentContext() };
    case 'readFiche':
      return { type: 'fiche', fiche: await readFiche(req.withPartner) };
    case 'runMv':
      return { type: 'result', result: await runMv(req.comment) };
    case 'writeComment':
      return { type: 'result', result: await writeComment(req.text) };
    case 'fillAnamnese':
      return { type: 'result', result: await fillAnamnese(req.picklists, req.texts) };
    case 'openComposer':
      return { type: 'result', result: await openComposer() };
    case 'insertMail':
      return { type: 'result', result: await insertMail(req.subject, req.html) };
    default:
      return { type: 'result', result: { ok: false, msg: `action inconnue sur Salesforce : ${(req as { type: string }).type}` } };
  }
}

export function initSalesforce() {
  chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
    handle(msg).then(sendResponse, (e: unknown) => sendResponse({ type: 'result', result: { ok: false, msg: String(e) } }));
    return true;
  });

  // Tant qu'un panneau est connecté, on lui pousse les changements de contexte
  // (Salesforce navigue sans recharger la page). Rien ne tourne panneau fermé.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;
    let lastKey = '';
    const tick = () => {
      const ctx = currentContext();
      const key = `${ctx.url}|${ctx.composerOpen}`;
      if (key === lastKey) return;
      lastKey = key;
      const push: ContextPush = { type: 'contextChanged', context: ctx };
      try { port.postMessage(push); } catch { /* port fermé */ }
    };
    tick();
    const timer = setInterval(tick, 800);
    port.onDisconnect.addListener(() => clearInterval(timer));
  });
}
