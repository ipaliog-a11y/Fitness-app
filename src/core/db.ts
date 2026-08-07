/**
 * Runs on disk.
 *
 * IndexedDB rather than localStorage: a GPS track is thousands of points, and
 * localStorage's few megabytes of stringified JSON would fill within a season.
 * Nothing leaves the device — there is no server in this app, by design.
 */

import { byNewest, SCHEMA_VERSION, type Activity } from './activity';

const DB_NAME = 'runlog';
const STORE = 'activities';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Sorting in the database beats sorting thousands of records in JS
        // every time the history screen opens.
        store.createIndex('startedAt', 'startedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function allActivities(): Promise<Activity[]> {
  try {
    const rows = await run<Activity[]>('readonly', (store) => store.getAll());
    return rows.sort(byNewest);
  } catch {
    // A browser with IndexedDB blocked (some private modes) gets an empty
    // history rather than a dead screen.
    return [];
  }
}

export async function saveActivity(activity: Activity): Promise<void> {
  await run('readwrite', (store) => store.put(activity));
}

export async function deleteActivity(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
}

export async function clearAll(): Promise<void> {
  await run('readwrite', (store) => store.clear());
}

/**
 * Full backup JSON (activities + profile + shoes + routes + plan).
 *
 * Prefer {@link exportFullBackup} by name; this alias keeps older call sites.
 */
export async function exportJson(): Promise<string> {
  const { exportFullBackup } = await import('./backup');
  return exportFullBackup();
}

export interface ImportResult {
  imported: number;
  skipped: number;
  fullBackup?: boolean;
  profileRestored?: boolean;
}

/**
 * Merge a backup or legacy activities-only file.
 *
 * Existing activity ids are skipped rather than overwritten.
 */
export async function importJson(text: string): Promise<ImportResult> {
  const { importBackup } = await import('./backup');
  const result = await importBackup(text);
  return {
    imported: result.activitiesImported,
    skipped: result.activitiesSkipped,
    fullBackup: result.fullBackup,
    profileRestored: result.profileRestored,
  };
}
