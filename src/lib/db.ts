import { DEFAULT_SETTINGS, type Job, type Settings } from './types';

const DB_NAME = 'field-service';
const DB_VERSION = 1;
type StoreName = 'jobs' | 'photos' | 'meta';

export interface PhotoRecord { id: string; jobId: string; blob: Blob }

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('jobs', { keyPath: 'id' });
      const photos = db.createObjectStore('photos', { keyPath: 'id' });
      photos.createIndex('jobId', 'jobId');
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Test helper: drop the cached connection so a fresh database can be opened. */
export function resetDbConnection(): void {
  dbPromise = null;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const listJobs = (): Promise<Job[]> => run<Job[]>('jobs', 'readonly', (s) => s.getAll());
export const getJob = (id: string): Promise<Job | undefined> => run<Job | undefined>('jobs', 'readonly', (s) => s.get(id));
/** Save a job. `touch: false` keeps the stored updatedAt (used when restoring a backup). */
export const saveJob = async (job: Job, touch = true): Promise<void> => {
  await run('jobs', 'readwrite', (s) => s.put(touch ? { ...job, updatedAt: new Date().toISOString() } : job));
};

export async function deleteJob(id: string): Promise<void> {
  const photos = await listPhotos(id);
  await Promise.all(photos.map((p) => deletePhoto(p.id)));
  await run('jobs', 'readwrite', (s) => s.delete(id));
}

export const listPhotos = (jobId: string): Promise<PhotoRecord[]> =>
  run<PhotoRecord[]>('photos', 'readonly', (s) => s.index('jobId').getAll(jobId));
export const listAllPhotos = (): Promise<PhotoRecord[]> => run<PhotoRecord[]>('photos', 'readonly', (s) => s.getAll());
export const savePhoto = async (p: PhotoRecord): Promise<void> => {
  await run('photos', 'readwrite', (s) => s.put(p));
};
export const deletePhoto = async (id: string): Promise<void> => {
  await run('photos', 'readwrite', (s) => s.delete(id));
};

export async function getSettings(): Promise<Settings> {
  const saved = await run<Partial<Settings> | undefined>('meta', 'readonly', (s) => s.get('settings'));
  return { ...DEFAULT_SETTINGS, ...saved };
}
export const saveSettings = async (s: Settings): Promise<void> => {
  await run('meta', 'readwrite', (st) => st.put(s, 'settings'));
};

export async function getFlag(key: string): Promise<boolean> {
  return (await run<boolean | undefined>('meta', 'readonly', (s) => s.get(key))) === true;
}
export const setFlag = async (key: string, value: boolean): Promise<void> => {
  await run('meta', 'readwrite', (s) => s.put(value, key));
};

/** Take the next ticket number and bump the counter. Single user, single device. */
export async function nextJobNumber(): Promise<number> {
  const s = await getSettings();
  const n = s.nextNumber;
  await saveSettings({ ...s, nextNumber: n + 1 });
  return n;
}

export async function clearAll(): Promise<void> {
  for (const store of ['jobs', 'photos'] as const) await run(store, 'readwrite', (s) => s.clear());
}
