import { type AppData, defaultData } from '../model';
import { clearHandle, fsSupported, permissionState, pickFolder, readText, savedHandle, writeText } from './fs';
import { detectKind, mergeGenerateur, mergeVentes, normalize, toLegacyGenerateur } from './legacy';

/**
 * Stockage « navigateur d'abord » : la copie de travail vit dans chrome.storage.local
 * (toujours disponible, sans autorisation), et le dossier choisi reçoit un cockpit.json
 * synchronisé dès que le navigateur en autorise l'accès. L'ancien data.json du
 * générateur est lu une fois pour reprendre les modèles, jamais écrit.
 */
export const DATA_FILE = 'cockpit.json';
export const LEGACY_FILE = 'data.json';
const LOCAL_KEY = 'cockpit-data';
const MODE_KEY = 'cockpit-storage-mode';

export type SyncStatus = 'synced' | 'paused' | 'none';
export interface StorageState {
  mode: 'folder' | 'browser';
  status: 'ready' | 'needs-folder';
  folderName: string;
  /** Dossier : synchronisé, en pause (autorisation à redonner) ou sans dossier. */
  sync: SyncStatus;
}

let handle: FileSystemDirectoryHandle | null = null;
let folderGranted = false;

async function localRead(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return ((await chrome.storage.local.get(LOCAL_KEY))[LOCAL_KEY] as string) ?? null;
  return localStorage.getItem(LOCAL_KEY);
}
async function localWrite(content: string) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) await chrome.storage.local.set({ [LOCAL_KEY]: content });
  else localStorage.setItem(LOCAL_KEY, content);
}
const browserModeChosen = () => { try { return localStorage.getItem(MODE_KEY) === 'browser'; } catch { return false; } };

/** Interprète le contenu d'un fichier : Cockpit, ancien générateur ou ancien suivi ventes. */
export function parseAny(text: string, base: AppData): { data: AppData; kind: ReturnType<typeof detectKind> } {
  const raw: unknown = JSON.parse(text);
  const kind = detectKind(raw);
  if (kind === 'cockpit') return { data: normalize(raw, base), kind };
  if (kind === 'generateur') return { data: mergeGenerateur(base, raw), kind };
  if (kind === 'ventes') return { data: mergeVentes(base, raw), kind };
  throw new Error('Format de fichier non reconnu');
}

const safeParse = (text: string | null, base: AppData): AppData | null => {
  if (!text || !text.trim()) return null;
  try { return parseAny(text, base).data; } catch { return null; }
};

/** Contenu du dossier : cockpit.json, sinon l'ancien data.json (remis au format ancien s'il avait été réécrit). */
async function readFolder(h: FileSystemDirectoryHandle): Promise<AppData | null> {
  const own = safeParse(await readText(h, DATA_FILE), defaultData());
  if (own) return own;
  const legacyText = await readText(h, LEGACY_FILE);
  const legacy = safeParse(legacyText, defaultData());
  if (!legacy) return null;
  try {
    if (detectKind(JSON.parse(legacyText!)) === 'cockpit') await writeText(h, LEGACY_FILE, JSON.stringify(toLegacyGenerateur(legacy), null, 2));
  } catch { /* on ne bloque pas le chargement pour ça */ }
  return legacy;
}

/** La plus récente des deux copies (navigateur / dossier). */
function newest(local: AppData | null, folder: AppData | null): AppData | null {
  if (!local) return folder;
  if (!folder) return local;
  return (folder.updatedAt ?? 0) > (local.updatedAt ?? 0) ? folder : local;
}

function state(sync: SyncStatus, status: StorageState['status'] = 'ready'): StorageState {
  return { mode: handle ? 'folder' : 'browser', status, folderName: handle?.name ?? '', sync };
}

/** Au démarrage : charge la copie locale tout de suite, puis le dossier s'il est accessible sans rien demander. */
export async function initStorage(): Promise<{ state: StorageState; data: AppData | null }> {
  const local = safeParse(await localRead(), defaultData());
  if (!fsSupported || browserModeChosen()) return { state: state('none'), data: local ?? defaultData() };
  handle = await savedHandle().catch(() => null);
  if (!handle) {
    if (local?.onboardingDone) return { state: state('none'), data: local };
    return { state: state('none', 'needs-folder'), data: local };
  }
  folderGranted = (await permissionState(handle, false)) === 'granted';
  if (!folderGranted) return { state: state('paused'), data: local };
  const folder = await readFolder(handle);
  const data = newest(local, folder) ?? defaultData();
  if (folder !== data) await writeText(handle, DATA_FILE, JSON.stringify(data, null, 2)).catch(() => {});
  return { state: state('synced'), data };
}

/** Clic utilisateur : redonne l'accès au dossier et remet les deux copies d'équerre. */
export async function authorize(current: AppData | null): Promise<{ state: StorageState; data: AppData | null }> {
  if (!handle) return { state: state('none', current?.onboardingDone ? 'ready' : 'needs-folder'), data: current };
  folderGranted = (await permissionState(handle, true)) === 'granted';
  if (!folderGranted) return { state: state('paused'), data: current };
  const folder = await readFolder(handle);
  const data = newest(current, folder) ?? defaultData();
  if (folder !== data) await writeText(handle, DATA_FILE, JSON.stringify(data, null, 2)).catch(() => {});
  return { state: state('synced'), data };
}

/** Clic utilisateur : choisit (ou change) le dossier et charge ce qu'il contient. */
export async function chooseFolder(current: AppData | null): Promise<{ state: StorageState; data: AppData; existed: 'cockpit' | 'legacy' | null } | null> {
  const h = await pickFolder();
  if (!h) return null;
  handle = h;
  folderGranted = true;
  try { localStorage.removeItem(MODE_KEY); } catch { /* indisponible */ }
  const existed = (await readText(h, DATA_FILE)) !== null ? 'cockpit' : (await readText(h, LEGACY_FILE)) !== null ? 'legacy' : null;
  const folder = await readFolder(h);
  // Un dossier qui contient déjà des données prime sur la copie locale (changement de poste) ;
  // sinon on garde ce qu'on a et on l'y écrit.
  const data = folder ?? current ?? defaultData();
  await writeText(h, DATA_FILE, JSON.stringify(data, null, 2)).catch(() => {});
  return { state: state('synced'), data, existed };
}

/** Choix explicite : pas de dossier, tout reste dans le navigateur. */
export async function useBrowserStorage(current: AppData | null): Promise<{ state: StorageState; data: AppData }> {
  handle = null;
  folderGranted = false;
  await clearHandle().catch(() => {});
  try { localStorage.setItem(MODE_KEY, 'browser'); } catch { /* indisponible */ }
  return { state: state('none'), data: current ?? safeParse(await localRead(), defaultData()) ?? defaultData() };
}

/** Enregistre la copie locale, et le fichier du dossier quand l'accès est ouvert. Renvoie l'état de synchro. */
export async function save(data: AppData): Promise<SyncStatus> {
  data.updatedAt = Date.now();
  const content = JSON.stringify(data, null, 2);
  await localWrite(content);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) await chrome.storage.local.set({ mvComment: data.reglages.mvComment });
  if (!handle) return 'none';
  if (!folderGranted) folderGranted = (await permissionState(handle, false)) === 'granted';
  if (!folderGranted) return 'paused';
  try {
    await writeText(handle, DATA_FILE, content);
    return 'synced';
  } catch {
    folderGranted = false;
    return 'paused';
  }
}

/** Écrit un data.json au format de l'ancien générateur dans le dossier (ou le télécharge sans dossier). */
export async function exportLegacy(data: AppData): Promise<'folder' | 'download'> {
  const content = JSON.stringify(toLegacyGenerateur(data), null, 2);
  if (handle && folderGranted) { await writeText(handle, LEGACY_FILE, content); return 'folder'; }
  const { downloadJson } = await import('./fs');
  downloadJson(LEGACY_FILE, content);
  return 'download';
}
