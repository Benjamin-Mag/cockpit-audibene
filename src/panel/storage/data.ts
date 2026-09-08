import { type AppData, defaultData } from '../model';
import { clearHandle, fsSupported, permissionState, pickFolder, readText, savedHandle, writeText } from './fs';
import { detectKind, mergeGenerateur, mergeVentes, normalize } from './legacy';

export const DATA_FILE = 'data.json';
const LOCAL_KEY = 'cockpit-data';

export type StorageStatus = 'ready' | 'needs-folder' | 'needs-permission';
export interface StorageState {
  mode: 'folder' | 'browser';
  status: StorageStatus;
  folderName: string;
}

let handle: FileSystemDirectoryHandle | null = null;

async function localRead(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return ((await chrome.storage.local.get(LOCAL_KEY))[LOCAL_KEY] as string) ?? null;
  return localStorage.getItem(LOCAL_KEY);
}
async function localWrite(content: string) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) await chrome.storage.local.set({ [LOCAL_KEY]: content });
  else localStorage.setItem(LOCAL_KEY, content);
}

/** Interprète le contenu d'un fichier : Cockpit, ancien générateur ou ancien suivi ventes. */
export function parseAny(text: string, base: AppData): { data: AppData; kind: ReturnType<typeof detectKind> } {
  const raw: unknown = JSON.parse(text);
  const kind = detectKind(raw);
  if (kind === 'cockpit') return { data: normalize(raw, base), kind };
  if (kind === 'generateur') return { data: mergeGenerateur(base, raw), kind };
  if (kind === 'ventes') return { data: mergeVentes(base, raw), kind };
  throw new Error('Format de fichier non reconnu');
}

async function loadFrom(h: FileSystemDirectoryHandle | null): Promise<AppData> {
  const text = h ? await readText(h, DATA_FILE) : await localRead();
  if (!text || !text.trim()) return defaultData();
  try {
    return parseAny(text, defaultData()).data;
  } catch {
    return defaultData();
  }
}

const MODE_KEY = 'cockpit-storage-mode';
const browserModeChosen = () => { try { return localStorage.getItem(MODE_KEY) === 'browser'; } catch { return false; } };

/** Choix explicite : pas de dossier, tout reste dans le navigateur. */
export async function useBrowserStorage(): Promise<{ state: StorageState; data: AppData }> {
  handle = null;
  await clearHandle().catch(() => {});
  try { localStorage.setItem(MODE_KEY, 'browser'); } catch { /* indisponible */ }
  return { state: { mode: 'browser', status: 'ready', folderName: '' }, data: await loadFrom(null) };
}

/** Au démarrage : retrouve le dossier mémorisé ; sans dossier ni autorisation, le dit. */
export async function initStorage(): Promise<{ state: StorageState; data: AppData | null }> {
  if (!fsSupported || browserModeChosen()) return { state: { mode: 'browser', status: 'ready', folderName: '' }, data: await loadFrom(null) };
  handle = await savedHandle().catch(() => null);
  if (!handle) return { state: { mode: 'folder', status: 'needs-folder', folderName: '' }, data: null };
  const perm = await permissionState(handle, false);
  if (perm !== 'granted') return { state: { mode: 'folder', status: 'needs-permission', folderName: handle.name }, data: null };
  return { state: { mode: 'folder', status: 'ready', folderName: handle.name }, data: await loadFrom(handle) };
}

/** Clic utilisateur : demande l'autorisation sur le dossier mémorisé. */
export async function authorize(): Promise<{ state: StorageState; data: AppData | null }> {
  if (!handle) return { state: { mode: 'folder', status: 'needs-folder', folderName: '' }, data: null };
  const perm = await permissionState(handle, true);
  if (perm !== 'granted') {
    await clearHandle();
    handle = null;
    return { state: { mode: 'folder', status: 'needs-folder', folderName: '' }, data: null };
  }
  return { state: { mode: 'folder', status: 'ready', folderName: handle.name }, data: await loadFrom(handle) };
}

/** Clic utilisateur : choisit (ou change) le dossier et charge son data.json s'il existe. */
export async function chooseFolder(): Promise<{ state: StorageState; data: AppData; existed: boolean } | null> {
  const h = await pickFolder();
  if (!h) return null;
  handle = h;
  try { localStorage.removeItem(MODE_KEY); } catch { /* indisponible */ }
  const existed = (await readText(h, DATA_FILE)) !== null;
  return { state: { mode: 'folder', status: 'ready', folderName: h.name }, data: await loadFrom(h), existed };
}

export async function save(data: AppData): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  if (handle) await writeText(handle, DATA_FILE, content);
  else await localWrite(content);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) await chrome.storage.local.set({ mvComment: data.reglages.mvComment });
}
