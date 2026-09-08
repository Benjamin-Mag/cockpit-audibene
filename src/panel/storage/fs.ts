const IDB_NAME = 'cockpit-audibene';
const IDB_STORE = 'handles';
const KEY = 'dir';

export const fsSupported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    const req = fn(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const savedHandle = () => idb<FileSystemDirectoryHandle>('readonly', (s) => s.get(KEY)).then((h) => h ?? null);
export const saveHandle = (h: FileSystemDirectoryHandle) => idb('readwrite', (s) => { s.put(h, KEY); });
export const clearHandle = () => idb('readwrite', (s) => { s.delete(KEY); });

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const h = await window.showDirectoryPicker({ mode: 'readwrite' });
    await saveHandle(h);
    return h;
  } catch {
    return null;
  }
}

export async function permissionState(h: FileSystemDirectoryHandle, request: boolean): Promise<PermissionState> {
  try {
    const q = await h.queryPermission({ mode: 'readwrite' });
    if (q === 'granted' || !request) return q;
    return await h.requestPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

export async function readText(h: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const fh = await h.getFileHandle(name, { create: false });
    return await (await fh.getFile()).text();
  } catch {
    return null;
  }
}

export async function writeText(h: FileSystemDirectoryHandle, name: string, content: string): Promise<void> {
  const fh = await h.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

/** Ouvre un fichier JSON choisi par l'utilisateur (sélecteur natif, ou <input type=file> en repli). */
export function pickJsonFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function downloadJson(name: string, content: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
