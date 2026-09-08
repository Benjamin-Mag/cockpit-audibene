import { CONTENT_VERSION, PORT_NAME, type ContentRequest, type ContentResponse, type ContextPush } from '../shared/messages';
import type { ActionResult, Fiche, SfContext } from '../shared/types';

export type Site = 'salesforce' | 'doctolib' | 'acuitis' | 'none';

export const isExtension = typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.runtime?.id;

export function siteOf(url: string | undefined): Site {
  if (!url) return 'none';
  try {
    const h = new URL(url).hostname;
    if (/(salesforce\.com|force\.com)$/.test(h)) return 'salesforce';
    if (/doctolib\.fr$/.test(h)) return 'doctolib';
    if (/acuitis\.com$/.test(h)) return 'acuitis';
  } catch { /* url invalide */ }
  return 'none';
}

export async function activeTab(): Promise<chrome.tabs.Tab | null> {
  if (!isExtension) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function inject(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  await new Promise((r) => setTimeout(r, 150));
}

/** S'assure que le script de contenu répond (l'injecte au besoin, ex. après mise à jour). */
export async function ensureContent(tabId: number): Promise<boolean> {
  const ping = () => chrome.tabs.sendMessage(tabId, { type: 'ping' } satisfies ContentRequest) as Promise<ContentResponse | undefined>;
  try {
    const r = await ping();
    if (r?.type === 'pong' && r.version === CONTENT_VERSION) return true;
  } catch { /* pas de script */ }
  try {
    await inject(tabId);
    const r = await ping();
    return r?.type === 'pong';
  } catch {
    return false;
  }
}

export async function send(tabId: number, req: ContentRequest): Promise<ContentResponse> {
  if (!(await ensureContent(tabId))) throw new Error('Impossible de dialoguer avec la page — recharge l\'onglet Salesforce.');
  const r = (await chrome.tabs.sendMessage(tabId, req)) as ContentResponse | undefined;
  if (!r) throw new Error('Pas de réponse de la page.');
  return r;
}

export async function runAction(tabId: number, req: ContentRequest): Promise<ActionResult> {
  const r = await send(tabId, req);
  if (r.type !== 'result') throw new Error('Réponse inattendue');
  return r.result;
}

export async function readFiche(tabId: number, withPartner: boolean): Promise<Fiche> {
  const r = await send(tabId, { type: 'readFiche', withPartner });
  if (r.type !== 'fiche') throw new Error('Réponse inattendue');
  return r.fiche;
}

/** Appelle `cb` à chaque changement d'onglet actif ou de son URL. */
export function watchActiveTab(cb: (tab: chrome.tabs.Tab | null) => void): () => void {
  if (!isExtension) { cb(null); return () => {}; }
  const refresh = () => activeTab().then(cb);
  const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
    if (tab.active && (info.url || info.status === 'complete')) refresh();
  };
  chrome.tabs.onActivated.addListener(refresh);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.windows.onFocusChanged.addListener(refresh);
  refresh();
  return () => {
    chrome.tabs.onActivated.removeListener(refresh);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.windows.onFocusChanged.removeListener(refresh);
  };
}

/** Abonne le panneau aux changements de contexte poussés par la page Salesforce. */
export function connectContext(tabId: number, cb: (ctx: SfContext) => void): () => void {
  let port: chrome.runtime.Port | null = null;
  let closed = false;
  ensureContent(tabId).then((ok) => {
    if (!ok || closed) return;
    port = chrome.tabs.connect(tabId, { name: PORT_NAME });
    port.onMessage.addListener((m: ContextPush) => { if (m.type === 'contextChanged') cb(m.context); });
    port.onDisconnect.addListener(() => { port = null; });
  });
  return () => {
    closed = true;
    try { port?.disconnect(); } catch { /* déjà fermé */ }
  };
}

/** Raccourci clavier relayé par le service worker. Le gestionnaire doit répondre `true`. */
export function onCommand(cb: (command: string) => Promise<void>): () => void {
  if (!isExtension) return () => {};
  const listener = (msg: { type?: string; command?: string }, _s: unknown, sendResponse: (r: unknown) => void) => {
    if (msg?.type !== 'command' || !msg.command) return;
    sendResponse(true);
    cb(msg.command);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export async function readClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
