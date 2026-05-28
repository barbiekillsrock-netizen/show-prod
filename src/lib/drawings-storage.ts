// IndexedDB-backed storage for song drawings (browser-only).
// Mesmo padrão do pdf-storage.ts — funciona independente de SSR.

export type Point = { x: number; y: number };
export type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
export type DrawingMap = Record<string, Stroke[]>;

const DB_NAME = "showprod";
const DB_VERSION = 2; // bump para adicionar a store drawings
const STORE = "drawings";

// Cache em memória — sobrevive a remontagens React
const memCache: DrawingMap = {};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pdfs")) db.createObjectStore("pdfs");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveDrawing(songId: string, strokes: Stroke[]): Promise<void> {
  // 1. Salva em memória imediatamente (síncrono)
  if (strokes.length > 0) {
    memCache[songId] = strokes;
  } else {
    delete memCache[songId];
  }

  // 2. Persiste em IndexedDB
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      if (strokes.length > 0) {
        tx.objectStore(STORE).put(JSON.stringify(strokes), songId);
      } else {
        tx.objectStore(STORE).delete(songId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignora — memCache ainda tem os dados para essa sessão
  }
}

export async function loadDrawing(songId: string): Promise<Stroke[]> {
  // 1. Retorna do cache de memória se disponível
  if (memCache[songId]) return memCache[songId];

  // 2. Busca no IndexedDB
  try {
    const db = await openDb();
    const raw = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(songId);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (raw) {
      const parsed = JSON.parse(raw) as Stroke[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memCache[songId] = parsed;
        return parsed;
      }
    }
  } catch {
    // ignora
  }
  return [];
}

export async function loadDrawings(songIds: string[]): Promise<DrawingMap> {
  const map: DrawingMap = {};
  await Promise.all(
    songIds.map(async (id) => {
      const strokes = await loadDrawing(id);
      if (strokes.length > 0) map[id] = strokes;
    })
  );
  return map;
}

export function clearDrawing(songId: string): void {
  delete memCache[songId];
  // Async fire-and-forget
  openDb().then((db) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(songId);
  }).catch(() => {});
}
