import { type AppData, defaultData, variabiliserSignatures, variabiliserTextes } from '../model';
import { clearHandle, fsSupported, permissionState, pickFolder, readText, savedHandle, writeText } from './fs';
import { detectKind, mergeData, mergeGenerateur, mergePartage, mergeVentes, normalize, toLegacyGenerateur } from './legacy';

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
/** « Ne plus me demander l'autorisation du dossier » : propre à ce navigateur, jamais dans cockpit.json. */
const SILENCE_KEY = 'cockpit-dossier-silence';
/** Date des données au moment de la dernière écriture réussie du cockpit.json. */
const ECRIT_KEY = 'cockpit-dossier-ecrit';
/** « Plus tard » sur le rappel de sauvegarde en retard : date jusqu'à laquelle il reste masqué, propre à ce navigateur. */
const REPORT_KEY = 'cockpit-rappel-reporte';
const JOUR_MS = 86_400_000;
/** Au-delà de ce nombre de jours sans sauvegarde, le rappel sort même avec « Ne plus demander ». */
export const RETARD_JOURS = 7;

export type SyncStatus = 'synced' | 'paused' | 'blocked' | 'none';
export interface StorageState {
  mode: 'folder' | 'browser';
  status: 'ready' | 'needs-folder';
  folderName: string;
  /** Dossier : synchronisé, en pause (autorisation à redonner), écriture refusée par le fichier (lecture seule…) ou sans dossier. */
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

/** Le navigateur oublie l'autorisation du dossier à chaque fermeture du panneau : on peut cesser de la redemander. */
/** Rien à copier tant que les données n'ont pas bougé depuis la dernière écriture du dossier. */
export const dossierEcritLe = (): number => { try { return Number(localStorage.getItem(ECRIT_KEY)) || 0; } catch { return 0; } };
const marquerEcrit = (t: number) => { try { localStorage.setItem(ECRIT_KEY, String(t)); } catch { /* stockage refusé */ } };
/** Jours écoulés depuis la dernière sauvegarde réussie du dossier (0 si inconnue). */
export const joursSansSauvegarde = (): number => { const t = dossierEcritLe(); return t ? Math.floor((Date.now() - t) / JOUR_MS) : 0; };
export const rappelReporte = () => { try { return Number(localStorage.getItem(REPORT_KEY)) > Date.now(); } catch { return false; } };
export const reporterRappel = () => { try { localStorage.setItem(REPORT_KEY, String(Date.now() + JOUR_MS)); } catch { /* stockage refusé */ } };

export const dossierSilencieux = () => { try { return localStorage.getItem(SILENCE_KEY) === '1'; } catch { return false; } };
export const setDossierSilencieux = (v: boolean) => { try { if (v) localStorage.setItem(SILENCE_KEY, '1'); else localStorage.removeItem(SILENCE_KEY); } catch { /* stockage refusé */ } };

/** Interprète le contenu d'un fichier : Cockpit, ancien générateur ou ancien suivi ventes. */
export function parseAny(text: string, base: AppData): { data: AppData; kind: ReturnType<typeof detectKind> } {
  const raw: unknown = JSON.parse(text);
  const kind = detectKind(raw);
  if (kind === 'cockpit') return { data: normalize(raw, base), kind };
  if (kind === 'partage') return { data: mergePartage(base, raw), kind };
  if (kind === 'generateur') return { data: mergeGenerateur(base, raw), kind };
  if (kind === 'ventes') return { data: mergeVentes(base, raw), kind };
  throw new Error('Format de fichier non reconnu');
}

const safeParse = (text: string | null, base: AppData): AppData | null => {
  if (!text || !text.trim()) return null;
  try {
    const d = parseAny(text, base).data;
    d.reglages = variabiliserSignatures(d.reglages);
    variabiliserTextes(d);
    return d;
  } catch { return null; }
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

/** Réunion des deux copies (navigateur / dossier) — jamais de perte, voir mergeData. */
function reconcile(local: AppData | null, folder: AppData | null): AppData | null {
  if (!local) return folder;
  if (!folder) return local;
  return mergeData(local, folder);
}

/**
 * Écrit cockpit.json. Un échec alors que l'autorisation est accordée vient du fichier lui-même
 * (lecture seule, ouvert ailleurs, dossier déplacé) : « blocked », jamais « synced » (06/10, fichier en lecture seule).
 */
async function ecrireDossier(h: FileSystemDirectoryHandle, content: string): Promise<SyncStatus> {
  try {
    await writeText(h, DATA_FILE, content);
    return 'synced';
  } catch {
    folderGranted = (await permissionState(h, false)) === 'granted';
    return folderGranted ? 'blocked' : 'paused';
  }
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
  // Première ouverture depuis la v1.0.41 : on part du principe que le dossier est à jour,
  // sinon le bandeau reviendrait alors que rien n'a changé.
  if (!dossierEcritLe()) marquerEcrit(local?.updatedAt ?? Date.now());
  // Ni copie dans le navigateur ni accès au dossier : il faut un clic pour rouvrir le dossier.
  if (!folderGranted) return { state: state('paused', local ? 'ready' : 'needs-folder'), data: local };
  const folder = await readFolder(handle);
  const data = reconcile(local, folder) ?? defaultData();
  const sync = await ecrireDossier(handle, JSON.stringify(data, null, 2));
  await localWrite(JSON.stringify(data));
  if (sync === 'synced') marquerEcrit(data.updatedAt ?? Date.now());
  return { state: state(sync), data };
}

/** Clic utilisateur : redonne l'accès au dossier et remet les deux copies d'équerre. */
export async function authorize(current: AppData | null): Promise<{ state: StorageState; data: AppData | null }> {
  if (!handle) return { state: state('none', current?.onboardingDone ? 'ready' : 'needs-folder'), data: current };
  folderGranted = (await permissionState(handle, true)) === 'granted';
  if (!folderGranted) return { state: state('paused'), data: current };
  const folder = await readFolder(handle);
  const data = reconcile(current, folder) ?? defaultData();
  const sync = await ecrireDossier(handle, JSON.stringify(data, null, 2));
  await localWrite(JSON.stringify(data));
  if (sync === 'synced') marquerEcrit(data.updatedAt ?? Date.now());
  return { state: state(sync), data };
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
  const data = reconcile(current, folder) ?? defaultData();
  const sync = await ecrireDossier(h, JSON.stringify(data, null, 2));
  // Copie du navigateur tout de suite : Edge retire l'accès au dossier dès que le panneau se ferme,
  // et sans cette copie le panneau rouvert n'aurait plus aucune donnée (réinstallation, 26/09).
  await localWrite(JSON.stringify(data));
  if (sync === 'synced') marquerEcrit(data.updatedAt ?? Date.now());
  return { state: state(sync), data, existed };
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
  const sync = await ecrireDossier(handle, content);
  if (sync === 'synced') marquerEcrit(data.updatedAt);
  return sync;
}

/** Écrit un data.json au format de l'ancien générateur dans le dossier (ou le télécharge sans dossier). */
export async function exportLegacy(data: AppData): Promise<'folder' | 'download'> {
  const content = JSON.stringify(toLegacyGenerateur(data), null, 2);
  if (handle && folderGranted) { await writeText(handle, LEGACY_FILE, content); return 'folder'; }
  const { downloadJson } = await import('./fs');
  downloadJson(LEGACY_FILE, content);
  return 'download';
}
