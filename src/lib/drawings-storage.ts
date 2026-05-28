// Persiste anotações no localStorage por song ID
// Singleton — opera fora do ciclo React, imune a remontagens e hidratação SSR

type Point = { x: number; y: number };
type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
type DrawingMap = Record<string, Stroke[]>;

const PREFIX = "showprod:drawings:";

// Cache em memória para sobreviver a remontagens do React
const memoryCache: DrawingMap = {};

export function loadDrawing(songId: string): Stroke[] {
  // 1. Retorna do cache de memória se disponível
  if (memoryCache[songId]) return memoryCache[songId];

  // 2. Tenta localStorage
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + songId);
    if (raw) {
      const parsed = JSON.parse(raw) as Stroke[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache[songId] = parsed;
        return parsed;
      }
    }
  } catch {
    // ignora
  }
  return [];
}

export function loadDrawings(songIds: string[]): DrawingMap {
  const map: DrawingMap = {};
  for (const id of songIds) {
    const strokes = loadDrawing(id);
    if (strokes.length > 0) map[id] = strokes;
  }
  return map;
}

export function saveDrawing(songId: string, strokes: Stroke[]) {
  // Salva em memória imediatamente (síncrono, confiável)
  if (strokes.length > 0) {
    memoryCache[songId] = strokes;
  } else {
    delete memoryCache[songId];
  }

  // Persiste em localStorage (async-safe)
  if (typeof window === "undefined") return;
  try {
    if (strokes.length === 0) {
      window.localStorage.removeItem(PREFIX + songId);
    } else {
      window.localStorage.setItem(PREFIX + songId, JSON.stringify(strokes));
    }
  } catch {
    // ignora erro de quota
  }
}

export function clearDrawing(songId: string) {
  delete memoryCache[songId];
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + songId);
}
