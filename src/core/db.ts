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
 * Everything, as a JSON string.
 *
 * The only export route out of a local-only app. Without it the data is one
 * cleared browser away from gone, which is not a reasonable thing to do to
 * somebody's training history.
 */
export async function exportJson(): Promise<string> {
  const activities = await allActivities();
  return JSON.stringify({ v: SCHEMA_VERSION, exportedAt: Date.now(), activities }, null, 2);
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Merge an exported file back in.
 *
 * Existing ids are skipped rather than overwritten, so importing the same file
 * twice is harmless and importing an older backup cannot roll back an edit.
 */
export async function importJson(text: string): Promise<ImportResult> {
  const parsed = JSON.parse(text) as { activities?: unknown };
  if (!Array.isArray(parsed.activities)) throw new Error('No activities in that file.');

  const existing = new Set((await allActivities()).map((a) => a.id));
  let imported = 0;
  let skipped = 0;

  for (const raw of parsed.activities) {
    const activity = raw as Activity;
    if (!activity || typeof activity.id !== 'string' || typeof activity.distanceM !== 'number') {
      skipped++;
      continue;
    }
    if (existing.has(activity.id)) {
      skipped++;
      continue;
    }
    await saveActivity({
      ...activity,
      segments: Array.isArray(activity.segments) ? activity.segments : [],
      heart: Array.isArray(activity.heart) ? activity.heart : [],
      note: typeof activity.note === 'string' ? activity.note : '',
    });
    imported++;
  }

  return { imported, skipped };
}
