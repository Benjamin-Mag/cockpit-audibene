import { CONTENT_VERSION, PORT_NAME, type ContentRequest, type ContentResponse, type ContextPush } from '../../shared/messages';
import { diagSms, fillAnamnese, fillSmsSearch, insertMail, openComposer, openSmsPanel, runMv, writeChatPartenaire, writeComment } from './actions';
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
      return { type: 'result', result: await writeComment(req.text, req.save) };
    case 'writeChatPartenaire':
      return { type: 'result', result: await writeChatPartenaire(req.text) };
    case 'openSms':
      return { type: 'result', result: await openSmsPanel() };
    case 'diagSms':
      return { type: 'result', result: diagSms() };
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

/** Installe les écouteurs ; renvoie la fonction qui les retire (remplacement par un build plus récent). */
export function initSalesforce(): () => void {
  const onMessage = (msg: ContentRequest, _sender: chrome.runtime.MessageSender, sendResponse: (r: ContentResponse) => void) => {
    // Envoyé à tous les cadres : seul celui qui contient le champ répond (sinon il
    // prendrait la place du bon cadre, la première réponse l'emportant).
    if (msg.type === 'fillSmsSearch') {
      const r = fillSmsSearch(msg.text);
      if (r) sendResponse({ type: 'result', result: r });
      return;
    }
    handle(msg).then(sendResponse, (e: unknown) => sendResponse({ type: 'result', result: { ok: false, msg: String(e) } }));
    return true;
  };
  chrome.runtime.onMessage.addListener(onMessage);

  // Tant qu'un panneau est connecté, on lui pousse les changements de contexte
  // (Salesforce navigue sans recharger la page). Rien ne tourne panneau fermé.
  const timers = new Set<number>();
  const onConnect = (port: chrome.runtime.Port) => {
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
    const timer = window.setInterval(tick, 800);
    timers.add(timer);
    port.onDisconnect.addListener(() => { clearInterval(timer); timers.delete(timer); });
  };
  chrome.runtime.onConnect.addListener(onConnect);

  return () => {
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.runtime.onConnect.removeListener(onConnect);
    for (const t of timers) clearInterval(t);
    timers.clear();
  };
}
