// IndexedDB-backed storage for song drawings (browser-only).
// Usa banco separado do pdf-storage para evitar conflito de versão.

export type Point = { x: number; y: number };
export type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
export type DrawingMap = Record<string, Stroke[]>;

const DB_NAME = "showprod-drawings"; // banco separado — sem conflito com pdfs
const DB_VERSION = 1;
const STORE = "drawings";

// Cache em memória — camada primária, browser-only
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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function saveDrawing(songId: string, strokes: Stroke[]): Promise<void> {
  // Salva em memória imediatamente
  if (strokes.length > 0) {
    memCache[songId] = strokes;
  } else {
    delete memCache[songId];
  }

  // Persiste em IndexedDB
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
    // memCache ainda preserva para a sessão
  }
}

export async function loadDrawing(songId: string): Promise<Stroke[]> {
  // Retorna do cache de memória se disponível
  if (memCache[songId]?.length > 0) return memCache[songId];

  // Busca no IndexedDB
  try {
    const db = await openDb();
    const raw = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(songId);
      req.onsuccess = () => resolve(req.result as string | undefined);
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
  const entries = await Promise.all(
    songIds.map(async (id) => [id, await loadDrawing(id)] as const)
  );
  const map: DrawingMap = {};
  for (const [id, strokes] of entries) {
    if (strokes.length > 0) map[id] = strokes;
  }
  return map;
}

export function clearDrawing(songId: string): void {
  delete memCache[songId];
  openDb().then((db) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(songId);
  }).catch(() => {});
}
